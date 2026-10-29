// Integration test: uses an isolated Compose project and temporary local mounts.
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "node:http";
const root = await mkdtemp(path.join(process.cwd(), ".container-test-"));
const live = path.join(root, "live"),
  restored = path.join(root, "restored"),
  assets = path.join(root, "assets");
await mkdir(live);
await mkdir(restored);
await mkdir(path.join(assets, "suica"), { recursive: true });
const fixture = await readFile("tests/fixtures/card.png");
const origin = "http://127.0.0.1:3101";
const env = {
  ...process.env,
  IC_ATLAS_IMAGE: "ic-atlas:0.1.0",
  IC_ATLAS_DATA_DIR: live,
  IC_ATLAS_ASSETS_DIR: assets,
  DOWNLOAD_ASSETS: "1",
  APP_ORIGIN: origin,
  BIND_ADDRESS: "127.0.0.1",
  APP_PORT: "3101",
  APP_UID: String(process.getuid()),
  APP_GID: String(process.getgid()),
};
function docker(args) {
  const result = spawnSync("docker", args, { env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
function compose(...args) {
  return docker(["compose", "-f", "docker-compose.yml", "-f", path.join(root, "compose-assets.json"), "-p", "ic-atlas-mvp-check", ...args]);
}
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "Container did not become ready: " + compose("logs", "--tail=40"),
  );
}
async function cards() {
  return (await fetch(`${origin}/api/cards`)).json();
}
let customId, imageUrl;
let sourceRequests = 0;
const source = createServer((_request, response) => {
  sourceRequests++;
  response.writeHead(200, { "Content-Type": "image/png" });
  response.end(fixture);
});
await new Promise((resolve) => source.listen(0, "0.0.0.0", resolve));
try {
  docker([
    "run", "--rm", "--network", "none", "ic-atlas:0.1.0", "node", "-e",
    `const assert=require('node:assert/strict'),fs=require('node:fs');
    for(const file of ['/app/assets','/app/public/cards','/app/data','/app/.aws','/app/.codex','/app/.agents','/app/.env','/app/.env.local','/app/.git']) assert.equal(fs.existsSync(file),false,file);
    assert.equal(fs.readdirSync('/assets').length,0);
    assert.equal(fs.readdirSync('/data').length,0);`,
  ]);
  console.log("PASS: image excludes artwork, personal data and local credential directories.");
  const gateway = docker(["network", "inspect", "bridge", "--format", "{{(index .IPAM.Config 0).Gateway}}"]);
  const sourcePort = source.address().port;
  const catalog = JSON.parse(await readFile("catalog/cards.json", "utf8"));
  // A local fixture source proves a cold container download without depending
  // on third-party websites or distributing their artwork in the test image.
  const fixtureCatalog = catalog.map((card) => ({
    ...card,
    image: card.id === "suica" ? "/cards/suica/suica.png" : "",
    imageSourceUrl: card.id === "suica" ? `http://${gateway}:${sourcePort}/card.png` : card.imageSourceUrl,
  }));
  await writeFile(path.join(root, "cards.json"), JSON.stringify(fixtureCatalog));
  await writeFile(path.join(root, "compose-assets.json"), JSON.stringify({ services: { "ic-atlas": {
    volumes: [`${path.join(root, "cards.json")}:/app/catalog/cards.json:ro`],
  } } }));
  compose("up", "-d");
  await ready();
  assert.equal((await cards()).length, catalog.length);
  const cachedImage = await fetch(`${origin}/cards/suica/suica.png`);
  assert.equal(cachedImage.status, 200);
  assert.equal(cachedImage.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await cachedImage.arrayBuffer()), fixture);
  assert.equal(sourceRequests, 1, "cold startup should download the missing artwork once");
  const patch = await fetch(`${origin}/api/cards/suica`, {
    method: "PATCH",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      owned: true,
      notes: "Container persistence",
      acquiredDate: "2024-11-15",
    }),
  });
  assert.equal(patch.status, 200);
  const form = new FormData();
  for (const [key, value] of Object.entries({
    brand: "Test",
    name: "Container upload",
    region: "Unknown",
    category: "Standard",
    notes: "Restored photo",
  }))
    form.set(key, value);
  form.set(
    "image",
    new Blob([fixture], { type: "image/png" }),
    "card.png",
  );
  const created = await fetch(`${origin}/api/cards`, {
    method: "POST",
    headers: { origin },
    body: form,
  });
  assert.equal(created.status, 201);
  const custom = await created.json();
  customId = custom.id;
  imageUrl = custom.image;
  assert.equal((await fetch(origin + imageUrl)).status, 200);
  const backupOutput = compose(
    "exec",
    "-T",
    "ic-atlas",
    "node",
    "scripts/backup.mjs",
    "/data/backups/smoke",
  );
  assert.match(backupOutput, /Backup saved/);
  compose("up", "-d", "--force-recreate");
  await ready();
  assert.equal(sourceRequests, 1, "container recreation should reuse the mounted assets cache");
  let state = await cards();
  assert.equal(state.find((c) => c.id === "suica").owned, true);
  assert.equal(
    state.find((c) => c.id === "suica").notes,
    "Container persistence",
  );
  assert.equal(state.find((c) => c.id === customId).notes, "Restored photo");
  assert.equal((await fetch(`${origin}/cards/suica/suica.png`)).status, 200);
  console.log(
    "PASS: container recreation preserves ownership, notes, acquisition date, and custom uploads.",
  );
  compose("down");
  docker([
    "run",
    "--rm",
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "-v",
    `${path.join(live, "backups/smoke")}:/backup:ro`,
    "-v",
    `${restored}:/restore`,
    "ic-atlas:0.1.0",
    "node",
    "scripts/restore.mjs",
    "/backup",
    "/restore",
  ]);
  env.IC_ATLAS_DATA_DIR = restored;
  compose("up", "-d");
  await ready();
  state = await cards();
  assert.equal(state.find((c) => c.id === "suica").owned, true);
  assert.equal(state.find((c) => c.id === "suica").acquiredDate, "2024-11-15");
  assert.equal(state.find((c) => c.id === customId).notes, "Restored photo");
  const image = await fetch(origin + imageUrl);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/webp");
  const health = compose(
    "exec",
    "-T",
    "ic-atlas",
    "node",
    "-e",
    "console.log(process.getuid()); fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)})",
  );
  assert.equal(Number(health), process.getuid());
  assert.notEqual(Number(health), 0, "the app must not run as root");
  console.log(
    "PASS: backup restores into an empty mount with matching data and image; runtime is non-root.",
  );
} finally {
  try { compose("down"); }
  finally {
    await new Promise((resolve) => source.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}
