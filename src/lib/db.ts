import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { CATALOG_ID_RENAMES } from "./catalog-id-migrations";
import {
  CATALOG_VERSION,
  type Card,
  type Design,
  type CollectionPatch,
} from "./types";

const designs = sqliteTable("designs", {
  id: text("id").primaryKey(),
  metadata: text("metadata", { mode: "json" }).$type<Design>().notNull(),
  custom: integer("custom", { mode: "boolean" }).notNull().default(false),
});
const collection = sqliteTable("collection", {
  designId: text("design_id")
    .primaryKey()
    .references(() => designs.id),
  owned: integer("owned", { mode: "boolean" }).notNull().default(false),
  acquiredDate: text("acquired_date"),
  addedAt: text("added_at"),
  notes: text("notes").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
export function dataDirectory() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR || "./data",
  );
}

// Catalog JSON metadata and personal state evolve independently under stable IDs.
export function openStore(directory: string, seed: Design[]) {
  mkdirSync(directory, { recursive: true });
  const sqlite = new Database(path.join(directory, "collection.sqlite"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const version = sqlite.pragma("user_version", { simple: true }) as number;
  if (version > 1) {
    sqlite.close();
    throw new Error(
      "Database is newer than this app. Restore the matching app version.",
    );
  }
  if (version < 1)
    sqlite.transaction(() => {
      sqlite.exec(`CREATE TABLE designs (id TEXT PRIMARY KEY, metadata TEXT NOT NULL, custom INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE collection (design_id TEXT PRIMARY KEY REFERENCES designs(id), owned INTEGER NOT NULL DEFAULT 0,
        acquired_date TEXT, added_at TEXT, notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version = 1;`);
    })();
  const db = drizzle(sqlite);
  const seedCatalog = sqlite.transaction(() => {
    for (const design of seed) {
      const previous = db
        .select()
        .from(designs)
        .where(eq(designs.id, design.id))
        .get();
      if (previous?.custom)
        throw new Error(
          `Catalog ID collides with a custom design: ${design.id}`,
        );
      db.insert(designs)
        .values({ id: design.id, metadata: design, custom: false })
        .onConflictDoUpdate({ target: designs.id, set: { metadata: design } })
        .run();
    }
    // Create the destination designs first, then move their personal state and
    // remove the obsolete IDs within the same transaction. Running this again
    // is a no-op once the old rows have been removed.
    const seededIds = new Set(seed.map((design) => design.id));
    for (const [oldId, newId] of Object.entries(CATALOG_ID_RENAMES)) {
      if (!seededIds.has(newId)) continue;
      const oldDesign = db
        .select()
        .from(designs)
        .where(eq(designs.id, oldId))
        .get();
      if (!oldDesign) continue;
      if (oldDesign.custom)
        throw new Error(`Catalog ID rename collides with a custom design: ${oldId}`);
      const oldState = db
        .select()
        .from(collection)
        .where(eq(collection.designId, oldId))
        .get();
      if (oldState) {
        const newState = db
          .select()
          .from(collection)
          .where(eq(collection.designId, newId))
          .get();
        if (newState)
          throw new Error(
            `Both ${oldId} and ${newId} have collection data. Resolve the duplicate before upgrading; no data was overwritten.`,
          );
        db.update(collection)
          .set({ designId: newId })
          .where(eq(collection.designId, oldId))
          .run();
      }
      db.delete(designs).where(eq(designs.id, oldId)).run();
    }
    sqlite
      .prepare(
        "INSERT INTO settings VALUES ('catalog_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(CATALOG_VERSION);
  });
  try {
    seedCatalog();
  } catch (error) {
    sqlite.close();
    throw error;
  }
  function list(): Card[] {
    return db
      .select()
      .from(designs)
      .leftJoin(collection, eq(designs.id, collection.designId))
      .all()
      .map((row) => ({
        ...row.designs.metadata,
        custom: row.designs.custom,
        owned: row.collection?.owned ?? false,
        acquiredDate: row.collection?.acquiredDate ?? null,
        addedAt: row.collection?.addedAt ?? null,
        notes: row.collection?.notes ?? "",
        updatedAt: row.collection?.updatedAt ?? null,
      }));
  }
  function update(id: string, patch: CollectionPatch) {
    return sqlite.transaction(() => {
      if (!db.select().from(designs).where(eq(designs.id, id)).get())
        throw new Error("Card not found");
      const old = db
        .select()
        .from(collection)
        .where(eq(collection.designId, id))
        .get();
      const owned = patch.owned ?? old?.owned ?? false;
      const now = new Date().toISOString();
      const values = {
        designId: id,
        owned,
        notes: patch.notes ?? old?.notes ?? "",
        acquiredDate:
          patch.acquiredDate !== undefined
            ? patch.acquiredDate
            : (old?.acquiredDate ?? null),
        addedAt: owned && !old?.owned ? now : (old?.addedAt ?? null),
        updatedAt: now,
      };
      db.insert(collection)
        .values(values)
        .onConflictDoUpdate({ target: collection.designId, set: values })
        .run();
      return list().find((c) => c.id === id)!;
    })();
  }
  function add(design: Design, notes: string) {
    return sqlite.transaction(() => {
      db.insert(designs)
        .values({ id: design.id, metadata: design, custom: true })
        .run();
      return update(design.id, { notes });
    })();
  }
  return { sqlite, list, update, add };
}
type Store = ReturnType<typeof openStore>;
const globalStore = globalThis as typeof globalThis & { icAtlasStore?: Store };
export function getStore() {
  if (!globalStore.icAtlasStore) {
    const seed = JSON.parse(
      readFileSync(path.join(process.cwd(), "catalog/cards.json"), "utf8"),
    ) as Design[];
    globalStore.icAtlasStore = openStore(dataDirectory(), seed);
  }
  return globalStore.icAtlasStore;
}
