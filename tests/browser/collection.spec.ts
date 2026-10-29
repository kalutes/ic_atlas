import { test, expect } from "@playwright/test";
import path from "node:path";
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";

test("claim, undo, notes, persistent ownership, filters and failed writes", async ({
  page,
  request,
}) => {
  await request.patch("/api/cards/suica", {
    headers: { origin },
    data: { owned: false, notes: "", acquiredDate: null },
  });
  await page.goto("/");
  const initial = Number(await page.getByTestId("owned-count").innerText());
  await page.getByTestId("card-suica").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Where to find it")).toBeVisible();
  await expect(
    dialog.getByText("Brand introduced", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Mark as owned", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Mark as not owned", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("owned-count")).toHaveText(String(initial + 1));
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Mark as owned", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("owned-count")).toHaveText(String(initial));
  await dialog
    .getByLabel("Collection notes")
    .fill("First trip to Tokyo — 日本");
  await dialog.getByLabel("Acquired on").fill("2024-04-12");
  await dialog.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByRole("status")).toContainText("Your notes are saved");
  await dialog
    .getByRole("button", { name: "Mark as owned", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Mark as not owned", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "My collection", exact: true })
      .getByTestId("card-suica"),
  ).toBeVisible();
  await page.getByTestId("card-suica").click();
  await expect(page.getByLabel("Collection notes")).toHaveValue(
    "First trip to Tokyo — 日本",
  );
  await expect(page.getByLabel("Acquired on")).toHaveValue("2024-04-12");
  await page.route("**/api/cards/suica", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Test write failure. Please try again." }),
    }),
  );
  await page
    .getByRole("button", { name: "Mark as not owned", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Test write failure");
  await expect(
    page.getByRole("button", { name: "Mark as not owned", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/cards/suica");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Search cards").fill("オキカ");
  await expect(page.getByTestId("card-okica")).toBeVisible();
  await expect(page.getByTestId("card-suica")).toHaveCount(0);
  await expect(page.getByTestId("owned-count")).toHaveText(String(initial + 1));
  await page.reload();
  await expect(page.getByLabel("Search cards")).toHaveValue("オキカ");
  await page.getByLabel("Search cards").fill("no such card xyz");
  await expect(page.getByText("No cards found.")).toBeVisible();
  await page
    .getByRole("button", { name: "Show all cards", exact: true })
    .click();
  await expect(page.getByTestId("card-okica")).toBeVisible();
});

test("personal design photo, claim, and metadata survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add missing design" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Brand", { exact: true }).fill("Suica");
  await dialog
    .getByLabel("Design name", { exact: true })
    .fill("Browser test edition");
  await dialog.getByLabel("Home region", { exact: true }).selectOption("Kanto");
  await dialog
    .getByLabel("Card front image")
    .setInputFiles(path.join(process.cwd(), "tests/fixtures/card.png"));
  await dialog.getByLabel("Notes", { exact: false }).fill("Photo upload test");
  await dialog.getByRole("button", { name: "Add to catalog" }).click();
  await expect(page.getByRole("dialog")).toContainText("Browser test edition");
  await expect(page.getByRole("dialog").locator(".card-art img")).toBeVisible();
  const src = await page
    .getByRole("dialog")
    .locator(".card-art img")
    .getAttribute("src");
  expect(src).toMatch(/^\/api\/uploads\//);
  await page
    .getByRole("button", { name: "Mark as owned", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark as not owned", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Search cards").fill("Browser test edition");
  await page
    .getByRole("button", { name: "View Suica Browser test edition" })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Mark as not owned", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Collection notes")).toHaveValue(
    "Photo upload test",
  );
});

test("mutation validation and origin restrictions", async ({ request }) => {
  expect(
    (
      await request.patch("/api/cards/suica", {
        headers: { origin: "https://other.example" },
        data: { owned: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch("/api/cards/suica", {
        headers: { origin },
        data: { owned: "yes" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch("/api/cards/suica", {
        headers: { origin },
        data: { acquiredDate: "2025-02-30" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.patch("/api/cards/does-not-exist", {
        headers: { origin },
        data: { owned: true },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/cards", {
        headers: { origin },
        multipart: {
          brand: "Test",
          name: "Bad image",
          region: "Unknown",
          category: "Standard",
          notes: "",
          image: {
            name: "fake.png",
            mimeType: "image/png",
            buffer: Buffer.from("not an image"),
          },
        },
      })
    ).status(),
  ).toBe(400);
});

test("desktop and mobile render real images with no overflow and keyboard dialog support", async ({
  page,
}) => {
  await page.goto("/");
  const images = page.locator(".card-art img");
  // The data test checks every local asset. Sample lazy loading here so browser
  // validation does not scroll hundreds of cards or capture a 100,000px image.
  const count = Math.min(await images.count(), 12);
  for (let i = 0; i < count; i++) {
    await images.nth(i).scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        images
          .nth(i)
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  // A phone should reach the collection immediately, even with a light OS theme.
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(
    page.getByRole("button", { name: "Filters", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  const firstTile = await page.locator(".card-tile").first().boundingBox();
  expect(firstTile!.y + firstTile!.height).toBeLessThan(650);
  for (const control of [
    page.getByRole("button", { name: "Add missing design" }),
    page.getByRole("button", { name: "Filters", exact: true }),
    page.locator(".segmented button").first(),
  ]) {
    const box = await control.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByLabel("Search cards")).toHaveCSS("font-size", "16px");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByLabel("Region", { exact: true })
    .selectOption("Kyushu / Okinawa");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByTestId("card-okica")).toBeVisible();
  await expect(page.getByTestId("card-suica")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();

  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.getByTestId("card-okica").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCSS("width", "390px");
  await expect(
    page.getByRole("button", { name: "Mark as owned", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/mobile-detail.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/mobile.png" });
});
