import path from "node:path";
import { existsSync } from "node:fs";
import { downloadAssets } from "./download-assets.mjs";
// Keep local development and production on the same data directory even though
// the generated standalone server changes its working directory.
process.env.DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
process.env.ASSETS_DIR = path.resolve(process.env.ASSETS_DIR || "./assets");
if (process.env.DOWNLOAD_ASSETS !== "0") await downloadAssets();
const server = existsSync(new URL("../server.js", import.meta.url))
  ? new URL("../server.js", import.meta.url)
  : new URL("../.next/standalone/server.js", import.meta.url);
await import(server.href);
