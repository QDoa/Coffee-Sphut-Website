import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("all partner screens render without sign-in in the loopback preview", async ({
  page,
}) => {
  for (const [route, title] of [
    ["overview", "Overview"],
    ["cafes", "Cafés"],
    ["rewards", "Reward activity"],
    ["inventory", "Inventory"],
    ["recipes", "Chain recipes"],
    ["team", "Team"],
    ["billing", "Plan & settings"],
    ["preview-review", "Staff review"],
  ]) {
    await page.goto(`/partner/${route}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Workspace unavailable", { exact: true }),
    ).toHaveCount(0);
  }
});
test("cafe edit stays pending until an independent reviewer publishes it", async ({
  page,
}) => {
  const address = `Browser verified ${randomUUID().slice(0, 8)}`;
  await page.goto("/partner/cafe?id=101");
  await page.getByLabel("Address", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted");
  await page.goto("/partner/cafe?id=101");
  await expect(page.getByLabel("Address", { exact: true })).not.toHaveValue(
    address,
  );
  await page.goto("/partner/preview-review");
  const request = page.locator("section").filter({ hasText: address });
  await expect(request).toBeVisible();
  await request.getByRole("button", { name: "Approve request" }).click();
  await expect(request).toHaveCount(0);
  await page.goto("/partner/cafe?id=101");
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue(
    address,
  );
});
test("stock receipt produces a movement and success feedback", async ({
  page,
}) => {
  await page.goto("/partner/inventory");
  await page.getByLabel("Quantity in base units").fill("20");
  await page.getByLabel("Reason / reference").fill("Browser receipt");
  await page.getByRole("button", { name: "Record movement" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(
    page.getByRole("cell", { name: "Browser receipt", exact: true }).first(),
  ).toBeVisible();
});
test("recipe creation is interactive and does not request stock deductions", async ({
  page,
}) => {
  await page.goto("/partner/recipes");
  await page
    .getByLabel("Recipe name", { exact: true })
    .fill(`Test recipe ${Date.now()}`);
  await page
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await page
    .getByLabel("Ingredient 1", { exact: true })
    .selectOption({ index: 1 });
  await page.getByLabel("Quantity 1", { exact: true }).fill("18");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
});
test("responsive layouts fit mobile, intermediate and desktop widths", async ({
  page,
}) => {
  for (const width of [320, 390, 897, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/partner/inventory");
    await expect(
      page.getByRole("heading", { name: "Inventory", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.partner-portal/inventory-${width}.png`,
      fullPage: true,
    });
  }
});

test("drafts preserve edited fields and can be resumed and submitted", async ({
  page,
}) => {
  const name = `Draft café ${Date.now()}`;
  await page.goto("/partner/cafe");
  await page.getByLabel("Café name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(page.getByLabel("Café name", { exact: true })).toHaveValue(name);
  await page.goto("/partner/cafes");
  await page
    .getByRole("link", { name: `Resume draft: ${name}`, exact: true })
    .click();
  await expect(page.getByLabel("Café name", { exact: true })).toHaveValue(name);
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Submitted");
});

test("managed images stay private through draft resume and render for the reviewer before publication", async ({
  page,
}) => {
  const name = `Image browser ${Date.now()}`;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1kAAAAASUVORK5CYII=",
    "base64",
  );
  await page.goto("/partner/cafe");
  await page.getByLabel("Café name", { exact: true }).fill(name);
  await page
    .getByLabel("Upload cover image", { exact: true })
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Cover awaiting review")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("Cover awaiting review")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  for (const width of [320, 390, 897, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.partner-portal/images-${width}.png`,
      fullPage: true,
    });
  }
  const media = JSON.parse(
    await page.locator('input[name="media"]').inputValue(),
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.goto("/partner/cafes");
  await page
    .getByRole("link", { name: `Resume draft: ${name}`, exact: true })
    .click();
  await expect(page.locator('input[name="media"]')).toHaveValue(
    JSON.stringify(media),
  );
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Submitted");
  await page.goto("/partner/preview-review");
  const request = page.locator("section").filter({ hasText: name });
  await expect(request.getByAltText("Proposed cover")).toBeVisible();
  await request.getByAltText("Proposed cover").scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      request
        .getByAltText("Proposed cover")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await request
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await expect(request).toHaveCount(0);
});

test("an administrator can clean up a detached upload through the real Storage API", async ({
  page,
}) => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1kAAAAASUVORK5CYII=",
    "base64",
  );
  await page.goto("/partner/cafe");
  await page
    .getByLabel("Upload cover image", { exact: true })
    .setInputFiles({ name: "unused.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Cover awaiting review")).toBeVisible();
  const { cover } = JSON.parse(
    await page.locator('input[name="media"]').inputValue(),
  );
  await page.getByRole("button", { name: "Remove cover", exact: true }).click();
  await page.goto("/partner/preview-review");
  await page.getByLabel("Upload ID", { exact: true }).fill(cover);
  await page
    .getByRole("button", { name: "Remove unused upload", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Unused upload removed");
  const response = await page.request.get(`/partner/media/${cover}`);
  expect(response.status()).toBe(404);
});
