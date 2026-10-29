import { constants } from "node:fs";
import { access, link, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const imagePattern = /^\/cards\/([a-z0-9-]+\/[a-z0-9-]+\.(?:png|jpe?g|svg|gif|webp))$/;
const formats = { png: "png", jpg: "jpeg", jpeg: "jpeg", svg: "svg", gif: "gif", webp: "webp" };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file) {
  try { const info = await stat(file); return info.isFile() && info.size > 0; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function sourceFor(card) {
  const url = new URL(card.imageSourceUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`Invalid image source for ${card.id}`);
  url.hash = "";
  return { url: url.href };
}

async function validateImage(bytes, extension) {
  const image = sharp(bytes, { limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.format !== formats[extension]) {
    throw new Error(`Source did not contain the expected ${extension} image`);
  }
  await image.stats();
}

async function storeImage(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.partial`;
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    // A hard link publishes the complete file atomically and never replaces an
    // existing cached file, including one written by another process.
    try { await link(temporary, file); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      const info = await stat(file);
      if (!info.isFile() || !info.size) throw new Error("Existing cache path is empty or not a file; remove it to retry");
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

/**
 * @param {object} [options]
 * @param {Array<{id: string, image: string, imageSourceUrl?: string}>} [options.catalog]
 * @param {string} [options.catalogPath]
 * @param {string} [options.assetsDir]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {(message: string) => void} [options.log]
 * @param {number} [options.concurrency]
 * @param {number} [options.requestTimeoutMs]
 * @param {number} [options.maxDurationMs]
 * @param {number} [options.intervalMs]
 */
export async function downloadAssets({
  catalog, catalogPath = path.resolve("catalog/cards.json"),
  assetsDir = path.resolve(process.env.ASSETS_DIR || "./assets"),
  fetchImpl = fetch, log = console.log, concurrency = 3,
  requestTimeoutMs = 20_000, maxDurationMs = 5 * 60_000, intervalMs = 250,
} = {}) {
  catalog ||= JSON.parse(await readFile(catalogPath, "utf8"));
  await mkdir(assetsDir, { recursive: true });
  await access(assetsDir, constants.W_OK);
  const groups = new Map(), destinations = new Map();
  for (const card of catalog) {
    if (!card.image) continue;
    const match = imagePattern.exec(card.image);
    if (!match) throw new Error(`Invalid local asset path: ${card.image}`);
    const source = sourceFor(card);
    const extension = path.extname(match[1]).slice(1);
    const key = JSON.stringify({ ...source, extension });
    if (destinations.has(match[1])) {
      if (destinations.get(match[1]) !== key) throw new Error(`Conflicting sources for ${card.image}`);
      continue;
    }
    destinations.set(match[1], key);
    const group = groups.get(key) || { source, extension, files: [] };
    group.files.push(path.join(assetsDir, match[1]));
    groups.set(key, group);
  }
  const summary = { cached: 0, downloaded: 0, failed: 0 };
  const queue = [...groups.values()];
  const deadline = Date.now() + maxDurationMs;
  const hostNext = new Map();
  async function fetchBytes(url) {
    const host = new URL(url).host;
    const scheduled = Math.max(Date.now(), hostNext.get(host) || 0);
    hostNext.set(host, scheduled + intervalMs);
    await delay(Math.max(0, scheduled - Date.now()));
    if (Date.now() >= deadline) throw new Error("Startup download time limit reached; restart or run assets:download to resume");
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, deadline - Date.now()))),
      headers: { "User-Agent": "IC-Atlas/0.1 (personal local image cache)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("Empty response");
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.byteLength;
      if (length > 32 * 1024 * 1024) throw new Error("Source exceeds 32 MB");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  async function worker() {
    while (queue.length) {
      const group = queue.shift();
      const missing = [];
      let cached;
      for (const file of group.files) {
        if (await exists(file)) { summary.cached++; cached ||= file; }
        else missing.push(file);
      }
      if (!missing.length) continue;
      try {
        let bytes;
        if (cached) bytes = await readFile(cached);
        else {
          // Retry transient failures once; permanent 404s remain missing and
          // are tried again on the next start, without breaking the app.
          for (let attempt = 0; attempt < 2; attempt++) {
            try { bytes = await fetchBytes(group.source.url); break; }
            catch (error) {
              if (attempt || (/HTTP 4\d\d/.test(error.message) && !/HTTP 429/.test(error.message)) || Date.now() >= deadline) throw error;
              await delay(500);
            }
          }
        }
        await validateImage(bytes, group.extension);
        for (const file of missing) {
          await storeImage(file, bytes);
          summary.downloaded++;
          if (summary.downloaded % 25 === 0) log(`Assets: ${summary.downloaded} images cached this run…`);
        }
      } catch (error) {
        summary.failed += missing.length;
        log(`Asset unavailable: ${path.relative(assetsDir, missing[0])} (${error.message})`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  log(`Assets: ${summary.cached} cached, ${summary.downloaded} downloaded, ${summary.failed} unavailable.`);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  downloadAssets().then((summary) => {
    if (summary.failed) process.exitCode = 1;
  }).catch((error) => {
    console.error("Could not prepare assets:", error.message);
    process.exitCode = 1;
  });
}
