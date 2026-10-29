import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { downloadAssets } from "../scripts/download-assets.mjs";
import { GET } from "../src/app/cards/[...path]/route";

const fixture = readFileSync("tests/fixtures/card.png");
const card = (name: string, source = "https://example.com/front.png") => ({
  id: name, image: `/cards/test/${name}.png`, imageSourceUrl: source,
});

test("asset downloads deduplicate sources, skip cached files and resume without overwriting", async () => {
  const assetsDir = await mkdtemp(path.join(tmpdir(), "ic-assets-"));
  let requests = 0;
  const fetchImpl = async () => { requests++; return new Response(fixture); };
  const catalog = [card("first"), card("first"), card("same-front"), { id: "no-photo", image: "" }];
  const options = { catalog, assetsDir, fetchImpl, log: () => {}, intervalMs: 0 };
  try {
    assert.deepEqual(await downloadAssets(options), { cached: 0, downloaded: 2, failed: 0 });
    assert.equal(requests, 1);
    assert.deepEqual(await readFile(path.join(assetsDir, "test/first.png")), fixture);
    await rm(path.join(assetsDir, "test/same-front.png"));
    assert.deepEqual(await downloadAssets(options), { cached: 1, downloaded: 1, failed: 0 });
    assert.equal(requests, 1, "reuse another cached copy of the same source");
    const personalReplacement = Buffer.from("Keep this existing local file");
    await writeFile(path.join(assetsDir, "test/first.png"), personalReplacement);
    assert.deepEqual(await downloadAssets({ ...options, maxDurationMs: 0 }), { cached: 2, downloaded: 0, failed: 0 });
    assert.deepEqual(await readFile(path.join(assetsDir, "test/first.png")), personalReplacement);
    assert.equal(requests, 1, "cached starts must not need a network connection");
    assert.ok((await readdir(path.join(assetsDir, "test"))).every((name) => !name.endsWith(".partial")));
  } finally { await rm(assetsDir, { recursive: true, force: true }); }
});

test("unavailable and non-image sources leave no broken cached file and can be retried", async () => {
  const assetsDir = await mkdtemp(path.join(tmpdir(), "ic-assets-failure-"));
  const options = { assetsDir, log: () => {}, intervalMs: 0 };
  try {
    assert.deepEqual(await downloadAssets({ ...options, catalog: [card("missing")], fetchImpl: async () => new Response("Gone", { status: 404 }) }), { cached: 0, downloaded: 0, failed: 1 });
    assert.deepEqual(await downloadAssets({ ...options, catalog: [card("missing")], fetchImpl: async () => new Response("<html>Not an image</html>") }), { cached: 0, downloaded: 0, failed: 1 });
    assert.deepEqual(await downloadAssets({ ...options, catalog: [card("missing")], fetchImpl: async () => new Response(fixture.subarray(0, 40)) }), { cached: 0, downloaded: 0, failed: 1 });
    assert.deepEqual(await readdir(assetsDir), []);
    assert.deepEqual(await downloadAssets({ ...options, catalog: [card("missing")], fetchImpl: async () => new Response(fixture) }), { cached: 0, downloaded: 1, failed: 0 });
    assert.deepEqual(await downloadAssets({ ...options, catalog: [card("later")], maxDurationMs: 0, fetchImpl: async () => { throw new Error("Must not fetch after deadline"); } }), { cached: 0, downloaded: 0, failed: 1 });
  } finally { await rm(assetsDir, { recursive: true, force: true }); }
});

test("the downloader rejects escaping paths and conflicting manifest sources", async () => {
  const assetsDir = await mkdtemp(path.join(tmpdir(), "ic-assets-path-"));
  try {
    await assert.rejects(downloadAssets({ assetsDir, catalog: [{ ...card("bad"), image: "/cards/../../outside.png" }] }), /Invalid local asset path/);
    await assert.rejects(downloadAssets({ assetsDir, catalog: [card("same"), card("same", "https://example.com/different.png")] }), /Conflicting sources/);
    await assert.rejects(downloadAssets({ assetsDir, catalog: [card("bad", "file:///etc/passwd")] }), /Invalid image source/);
  } finally { await rm(assetsDir, { recursive: true, force: true }); }
});

test("card routes read the mounted assets directory and do not cache missing images", async () => {
  const assetsDir = await mkdtemp(path.join(tmpdir(), "ic-assets-route-"));
  const original = process.env.ASSETS_DIR;
  process.env.ASSETS_DIR = assetsDir;
  const get = (parts: string[]) => GET(new Request("http://localhost/cards/test/front.png"), { params: Promise.resolve({ path: parts }) });
  try {
    assert.equal((await get(["..", "front.png"])).status, 404);
    assert.equal((await get(["test", "front.png", "extra"])).status, 404);
    const missing = await get(["test", "front.png"]);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    await downloadAssets({ assetsDir, catalog: [card("front")], fetchImpl: async () => new Response(fixture), log: () => {}, intervalMs: 0 });
    const response = await get(["test", "front.png"]);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixture);
  } finally {
    if (original === undefined) delete process.env.ASSETS_DIR; else process.env.ASSETS_DIR = original;
    await rm(assetsDir, { recursive: true, force: true });
  }
});
