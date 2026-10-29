import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { openStore } from "../src/lib/db";
import { statistics, type Design } from "../src/lib/types";
const sample: Design = {
  id: "suica-test",
  brand: "Suica",
  name: "Standard",
  japaneseName: "スイカ",
  issuer: "JR East",
  region: "Kanto",
  category: "Standard",
  compatibility: "Nationwide member",
  issuance: "Current",
  service: "Active",
  image: "",
  sourceUrl: "",
  imageSourceUrl: "",
  imageCredit: "",
  imageLicense: "",
  verifiedDate: "2026-10-26",
  aliases: "",
  color: "#00aa00",
};

test("ownership is idempotent; catalog updates, notes, custom designs and restore preserve personal data", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "ic-atlas-test-"));
  const directory = path.join(root, "live");
  let store = openStore(directory, [sample]);
  try {
    assert.equal(store.list()[0].owned, false);
    const first = store.update(sample.id, {
      owned: true,
      notes: "Tokyo memory",
      acquiredDate: "2024-01-20",
    });
    assert.equal(
      store.update(sample.id, { owned: true }).addedAt,
      first.addedAt,
    );
    store.update(sample.id, { owned: false });
    assert.equal(store.list()[0].notes, "Tokyo memory");
    store.update(sample.id, { owned: true });
    store.add(
      {
        ...sample,
        id: "custom-test",
        brand: "Personal",
        region: "Unknown",
        image: "/api/uploads/example.webp",
      },
      "Custom memory",
    );
    store.update("custom-test", { owned: true });
    mkdirSync(path.join(directory, "uploads"));
    writeFileSync(
      path.join(directory, "uploads/example.webp"),
      "immutable photo fixture",
    );
    store.sqlite.close();
    store = openStore(directory, [{ ...sample, name: "Updated catalog name" }]);
    assert.equal(
      store.list().find((c) => c.id === sample.id)?.name,
      "Updated catalog name",
    );
    assert.equal(
      store.list().find((c) => c.id === sample.id)?.notes,
      "Tokyo memory",
    );
    assert.equal(
      store.list().find((c) => c.id === sample.id)?.acquiredDate,
      "2024-01-20",
    );
    assert.equal(store.list().find((c) => c.id === "custom-test")?.owned, true);
    assert.deepEqual(statistics(store.list()), {
      owned: 2,
      total: 2,
      brands: 2,
      totalBrands: 2,
      nationwide: 1,
      regions: 1,
      percent: 100,
    });
    assert.throws(
      () => store.update("not-a-card", { owned: true }),
      /Card not found/,
    );
    const backup = path.join(root, "backup");
    execFileSync(process.execPath, ["scripts/backup.mjs", backup], {
      env: { ...process.env, DATA_DIR: directory },
    });
    const restore = path.join(root, "restored");
    execFileSync(process.execPath, ["scripts/restore.mjs", backup, restore]);
    const restored = openStore(restore, [
      { ...sample, name: "Updated catalog name" },
    ]);
    assert.deepEqual(restored.list(), store.list());
    assert.equal(
      readFileSync(path.join(restore, "uploads/example.webp"), "utf8"),
      "immutable photo fixture",
    );
    assert.throws(() =>
      execFileSync(process.execPath, ["scripts/restore.mjs", backup, restore], {
        stdio: "pipe",
      }),
    );
    restored.sqlite.close();
  } finally {
    store.sqlite.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("brand progress counts variants only once and unknown regions do not count", () => {
  const cards = [
    sample,
    { ...sample, id: "suica-variant" },
    { ...sample, id: "okica", brand: "OKICA", region: "Kyushu / Okinawa" },
  ].map((c) => ({
    ...c,
    custom: false,
    owned: true,
    acquiredDate: null,
    addedAt: null,
    notes: "",
    updatedAt: null,
  }));
  assert.equal(statistics(cards).nationwide, 1);
  assert.equal(statistics(cards).brands, 2);
  assert.equal(statistics(cards).regions, 2);
});
