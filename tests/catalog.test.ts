import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { openStore } from "../src/lib/db";
import { CATALOG_ID_RENAMES } from "../src/lib/catalog-id-migrations";
import { REGIONS, CATEGORIES, type Design } from "../src/lib/types";

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const catalog: Design[] = readJson("catalog/cards.json");
const legacyIds = [
  "suica", "suica-welcome", "suica-monorail", "suica-rinkai", "pasmo",
  "pasmo-passport", "kitaca", "toica", "manaca-do", "manaca-mic", "icoca",
  "pitapa", "sugoca", "nimoca", "hayakaken", "totra", "odeca", "okica",
  "paspy-hiroden", "paspy-chugoku", "iruca", "sapica",
];
const curated = legacyIds.map((id) => {
  const card = catalog.find((card) => card.id === id);
  assert.ok(card, `Existing collection ID was removed: ${id}`);
  return { ...card, name: `Previous catalog label: ${id}` };
});

test("expanded catalog has valid metadata, stable identities and downloadable image references", () => {
  const ids = new Set(catalog.map((card) => card.id));
  assert.equal(ids.size, catalog.length, "duplicate design IDs");
  assert.ok(catalog.length >= 350, "expanded library was replaced by the old starter catalog");
  for (const id of ["toica-piyorin", "iruca-2000-series-launch", "nimoca-8000-series", "ica-railway-launch", "kosuzume-go-adult", "kururu-suica-partner"]) {
    assert.ok(ids.has(id), `Missing imported design: ${id}`);
  }
  for (const card of catalog) {
    assert.match(card.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.doesNotMatch(card.id, /^(eli|jamfunk|transitcards)-/);
    for (const field of ["id", "brand", "name", "issuer", "region", "category", "sourceUrl"] as const) {
      assert.ok(card[field]?.trim(), `${card.id}: missing ${field}`);
    }
    assert.ok([...REGIONS, "Unknown"].includes(card.region));
    assert.ok((CATEGORIES as readonly string[]).includes(card.category));
    assert.ok(["Current", "Discontinued", "Limited edition", "Unknown"].includes(card.issuance));
    assert.ok(["Active", "Retired", "Unknown"].includes(card.service));
    if (!card.image) continue;
    assert.match(card.image, /^\/cards\/[a-z0-9-]+\/[a-z0-9-]+\.(png|jpg|jpeg|svg|gif|webp)$/);
    assert.ok(!card.image.includes(".."));
    assert.ok(card.imageSourceUrl && card.imageCredit && card.imageLicense);
    const url = new URL(card.imageSourceUrl);
    assert.ok(["http:", "https:"].includes(url.protocol));
  }
});

test("renaming imported IDs preserves all personal fields, custom cards and unrelated archived entries", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ic-catalog-rename-"));
  const oldIds = new Map(Object.entries(CATALOG_ID_RENAMES).map(([oldId, newId]) => [newId, oldId]));
  const previousCatalog = catalog.map((card) => ({ ...card, id: oldIds.get(card.id) || card.id }));
  let store = openStore(directory, previousCatalog);
  try {
    for (const [index, card] of previousCatalog.entries()) {
      // Include explicit unowned rows with notes, as well as owned cards.
      store.update(card.id, { owned: index % 2 === 0, notes: `Keep ${card.id}`, acquiredDate: "2025-04-12" });
    }
    store.add({ ...catalog[0], id: "custom-personal", name: "Personal card" }, "Personal note");
    store.sqlite.prepare("INSERT INTO designs VALUES (?, ?, 0)").run("archived-card", JSON.stringify({ ...catalog[0], id: "archived-card" }));
    store.update("archived-card", { owned: true, notes: "Retain archived entry" });
    const before = store.sqlite.prepare("SELECT * FROM collection ORDER BY design_id").all() as Array<Record<string, unknown> & { design_id: string }>;
    const expected = before.map((row) => ({ ...row, design_id: CATALOG_ID_RENAMES[row.design_id] || row.design_id })).sort((a, b) => a.design_id.localeCompare(b.design_id));
    store.sqlite.close();
    store = openStore(directory, catalog);
    assert.equal(store.list().length, catalog.length + 2);
    const state = () => (store.sqlite.prepare("SELECT * FROM collection").all() as Array<Record<string, unknown> & { design_id: string }>).sort((a, b) => a.design_id.localeCompare(b.design_id));
    assert.deepEqual(state(), expected);
    for (const oldId of Object.keys(CATALOG_ID_RENAMES)) {
      assert.equal(store.sqlite.prepare("SELECT id FROM designs WHERE id = ?").get(oldId), undefined);
    }
    assert.deepEqual(store.sqlite.pragma("foreign_key_check"), []);
    store.sqlite.close();
    store = openStore(directory, catalog);
    assert.deepEqual(state(), expected, "migration must be idempotent");
  } finally {
    store.sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an ID rename conflict rolls back without overwriting either collection record", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ic-catalog-conflict-"));
  const card = catalog.find((card) => card.id === "ayuca-standard")!;
  const store = openStore(directory, [{ ...card, id: "eli-3" }]);
  store.update("eli-3", { owned: true, notes: "Old ID note" });
  store.sqlite.prepare("INSERT INTO designs VALUES (?, ?, 0)").run(card.id, JSON.stringify(card));
  store.update(card.id, { owned: false, notes: "New ID note" });
  const before = store.sqlite.prepare("SELECT * FROM collection ORDER BY design_id").all();
  store.sqlite.close();
  try {
    assert.throws(() => openStore(directory, catalog), /Both eli-3 and ayuca-standard have collection data/);
    const reopened = new Database(path.join(directory, "collection.sqlite"));
    try {
      assert.deepEqual(reopened.prepare("SELECT * FROM collection ORDER BY design_id").all(), before);
      assert.equal((reopened.prepare("SELECT count(*) AS count FROM designs").get() as { count: number }).count, 2);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("upgrading the original catalog retains ownership and notes for every existing ID", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ic-catalog-upgrade-"));
  let store = openStore(directory, curated);
  try {
    for (const card of curated) {
      store.update(card.id, { owned: true, notes: `Keep ${card.id}`, acquiredDate: "2024-03-15" });
    }
    const before = new Map(store.list().map((card) => [card.id, card]));
    store.sqlite.close();
    store = openStore(directory, catalog);
    assert.equal(store.list().length, catalog.length);
    for (const original of curated) {
      const card = store.list().find((card) => card.id === original.id)!;
      assert.ok(card, original.id);
      assert.equal(card.owned, true);
      assert.equal(card.notes, before.get(original.id)!.notes);
      assert.equal(card.acquiredDate, before.get(original.id)!.acquiredDate);
      assert.equal(card.addedAt, before.get(original.id)!.addedAt);
    }
    assert.equal(store.list().filter((card) => card.owned).length, curated.length);
  } finally {
    store.sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
