import { readdir, mkdir, cp, access } from "node:fs/promises";
import path from "node:path";
const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg)
  throw new Error(
    "Usage: node scripts/restore.mjs <backup-directory> <empty-data-directory>. Stop the app first.",
  );
const source = path.resolve(sourceArg),
  target = path.resolve(targetArg);
await access(path.join(source, "collection.sqlite"));
await access(path.join(source, "backup.json"));
await mkdir(target, { recursive: true });
if ((await readdir(target)).length)
  throw new Error("Restore target must be empty. The app must be stopped.");
await cp(
  path.join(source, "collection.sqlite"),
  path.join(target, "collection.sqlite"),
  { errorOnExist: true, force: false },
);
try {
  await access(path.join(source, "uploads"));
  await cp(path.join(source, "uploads"), path.join(target, "uploads"), {
    recursive: true,
  });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
console.log(
  `Restored to ${target}. Use the matching app version and dataset permissions before starting.`,
);
