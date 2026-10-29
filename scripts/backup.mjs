import Database from "better-sqlite3";
import { mkdir, cp, writeFile, access, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
const data = path.resolve(process.env.DATA_DIR || "./data");
const destination = path.resolve(
  process.argv[2] ||
    path.join(
      data,
      "backups",
      `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`,
    ),
);
if (destination === data || !path.relative(data, destination))
  throw new Error(
    "Backup destination must differ from the live data directory.",
  );
await mkdir(path.dirname(destination), { recursive: true });
await mkdir(destination, { recursive: false });
let db;
try {
  db = new Database(path.join(data, "collection.sqlite"), {
    readonly: true,
    fileMustExist: true,
  });
  await db.backup(path.join(destination, "collection.sqlite"));
  // Uploaded files are immutable and are written before their database record.
  // Copying after the consistent DB snapshot includes all referenced images.
  try {
    await access(path.join(data, "uploads"));
    await cp(path.join(data, "uploads"), path.join(destination, "uploads"), {
      recursive: true,
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeFile(
    path.join(destination, "backup.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        appVersion: "0.1.0",
        schemaVersion: db.pragma("user_version", { simple: true }),
        catalogVersion: db
          .prepare("SELECT value FROM settings WHERE key='catalog_version'")
          .get()?.value,
      },
      null,
      2,
    ),
  );
  console.log(`Backup saved: ${destination}`);
} catch (error) {
  await rm(destination, { recursive: true, force: true });
  throw error;
} finally {
  db?.close();
}
