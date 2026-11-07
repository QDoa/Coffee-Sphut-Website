import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("all partner screens render without sign-in in the loopback preview", async ({
  page,
}) => {
  for (const [route, title] of [
    ["overview", "Dashboard"],
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
test("removal archives an existing café after approval without submitting unsaved edits", async ({
  page,
}) => {
  const name = `Removal test ${randomUUID().slice(0, 8)}`;
  const address = "10 Preview Street";
  await page.goto("/partner/cafe");
  await page.getByLabel("Café name", { exact: true }).fill(name);
  await page.getByLabel("Address", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted");

  await page.goto("/partner/preview-review");
  const creation = page.locator("section").filter({
    has: page.getByRole("cell", { name, exact: true }),
  });
  await creation.getByRole("button", { name: "Approve request" }).click();
  await expect(creation).toHaveCount(0);

  const list = `/partner/cafes?q=${encodeURIComponent(name)}`;
  await page.goto(list);
  await page.getByRole("link", { name: "Details & edit request" }).click();
  await expect(page).toHaveURL(/\/partner\/cafe\?id=\d+$/);
  const cafeUrl = page.url();
  const addressField = page.getByLabel("Address", { exact: true });
  const remove = page.getByRole("button", { name: "Remove café", exact: true });
  const dialog = page.getByRole("alertdialog");
  await addressField.fill("Unsaved address");
  await remove.click();
  await dialog.getByRole("button", { name: "Keep café" }).click();
  await expect(addressField).toHaveValue("Unsaved address");
  await remove.click();
  await dialog.getByRole("button", { name: "Request removal" }).click();
  await expect(
    page.getByText("Café removal request", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("pending");

  await page.goto(cafeUrl);
  await expect(page.getByLabel("Active café")).toBeChecked();
  await expect(addressField).toHaveValue(address);
  await remove.click();
  await dialog.getByRole("button", { name: "Request removal" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "already has a request awaiting review",
  );

  await page.goto("/partner/preview-review");
  const removal = page.locator("section").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
  await expect(removal).toContainText("removes this café from public listings");
  await removal.getByRole("button", { name: "Approve request" }).click();
  await expect(removal).toHaveCount(0);

  await page.goto(cafeUrl);
  await expect(page.getByLabel("Active café")).not.toBeChecked();
  await expect(addressField).toHaveValue(address);
  await expect(remove).toHaveCount(0);
  await page.goto(list);
  await expect(page.getByText("Archived · history preserved")).toBeVisible();
});

test("stock movements preview balances in the selected item's unit before saving", async ({
  page,
}) => {
  await page.goto("/partner/inventory");
  await page
    .getByRole("button", { name: "Record movement", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const item = dialog.getByLabel("Item and café", { exact: true });
  await item.selectOption("40000000-0000-4000-8000-000000000001");
  const current = dialog
    .getByText("Current balance", { exact: true })
    .locator("..")
    .locator("dd");
  const preview = dialog
    .getByText("New balance (preview)", { exact: true })
    .locator("..")
    .locator("dd");
  const balance = Number((await current.textContent())?.replace(/[^\d.]/g, ""));
  const formatted = (value: number) =>
    `${value.toLocaleString("en", { maximumFractionDigits: 6 })} g`;
  const movementType = dialog.getByLabel("What happened?", { exact: true });
  await expect(movementType).toHaveValue("receipt");
  await expect(
    dialog.getByText("Add stock that arrived in a delivery."),
  ).toBeVisible();
  await expect(preview).toHaveText("—");
  const received = dialog.getByLabel("Quantity received");
  await expect(received).toHaveAccessibleDescription("g");
  await received.fill("20");
  await expect(preview).toHaveText(formatted(balance + 20));
  await expect(dialog.getByLabel("Adjust the balance")).toHaveCount(0);
  await movementType.selectOption({ label: "Stock count" });
  await dialog.getByLabel("Total counted").fill("0");
  await expect(preview).toHaveText("0 g");
  await movementType.selectOption({ label: "Manual adjustment" });
  await dialog.getByLabel("Adjust the balance").selectOption("subtract");
  await dialog
    .getByLabel("Quantity to adjust")
    .fill(String(Math.ceil(balance) + 1));
  await expect(
    dialog.getByText("This would take stock below zero."),
  ).toBeVisible();
  await movementType.selectOption({ label: "Stock received" });
  await expect(dialog.getByLabel("Adjust the balance")).toHaveCount(0);
  await item.selectOption("40000000-0000-4000-8000-000000000002");
  await expect(received).toHaveAccessibleDescription("ml");
  await expect(preview).toContainText("ml");
  await item.selectOption("40000000-0000-4000-8000-000000000001");
  await received.fill("20");
  await dialog.getByLabel("Reason / reference").fill("Browser stock received");
  await dialog
    .getByRole("button", { name: "Record movement", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close menu" })
    .click();
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  const savedMovement = page
    .getByRole("row")
    .filter({ hasText: "Browser stock received" })
    .first();
  await expect(
    savedMovement.getByRole("cell", { name: "Stock received", exact: true }),
  ).toBeVisible();
});
test("recipes can be created, found by ingredient, and edited from the library", async ({
  page,
}) => {
  const name = `Test recipe ${Date.now()}`;
  await page.goto("/partner/recipes");
  await page.getByRole("button", { name: "Add recipe", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Recipe name", { exact: true }).fill(name);
  await expect(
    editor.getByRole("button", { name: "Save recipe" }),
  ).toBeDisabled();
  await editor
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await editor
    .getByLabel("Ingredient 1", { exact: true })
    .selectOption("40000000-0000-4000-8000-000000000001");
  const quantity = editor.getByLabel("Quantity 1", { exact: true });
  await expect(quantity).toHaveAccessibleDescription("g");
  await quantity.fill("18");
  await editor
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await editor
    .getByLabel("Ingredient 2", { exact: true })
    .selectOption("40000000-0000-4000-8000-000000000001");
  await editor.getByLabel("Quantity 2", { exact: true }).fill("2");
  await editor
    .getByRole("button", { name: "Save recipe", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(`${name} saved.`);
  await expect(editor).toHaveCount(0);

  const card = page.getByRole("article", { name, exact: true });
  const search = page.getByLabel("Search recipes", { exact: true });
  await search.fill("House espresso beans");
  await expect(card).toContainText("18 g");
  await card.getByRole("button", { name: "Scale recipe", exact: true }).click();
  const target = card.getByLabel("Target servings", { exact: true });
  await expect(target).toHaveValue("1");
  await target.fill("2.5");
  await expect(card).toContainText("45 g");
  await expect(card).toContainText("Makes 1 serving");
  const cafe = card.getByLabel("Check stock at café", { exact: true });
  await cafe.selectOption("101");
  const onHand = card.getByText(/g on hand$/);
  await expect(onHand).toHaveCount(1);
  const available = Number(
    (await onHand.textContent())?.replace(/[^\d.]/g, ""),
  );
  const servings = Math.floor(available / 20) + 1;
  await target.fill(String(servings));
  await expect(
    card.getByText(
      `Short by ${(servings * 20 - available).toLocaleString("en", { maximumFractionDigits: 6 })} g`,
      { exact: true },
    ),
  ).toBeVisible();
  await cafe.selectOption("102");
  await expect(
    card.getByText("No matching stock item", { exact: true }).first(),
  ).toBeVisible();
  await expect(onHand).toHaveCount(0);
  await target.fill("0");
  await expect(
    card.getByText("Enter a valid number of servings greater than zero."),
  ).toBeVisible();
  await expect(card.getByText("45 g", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(card).toContainText("18 g");
  await search.fill(name);
  await card.getByRole("button", { name: `Edit ${name}` }).click();
  await expect(quantity).toHaveValue("18");
  await expect(editor.getByLabel("Servings per batch")).toHaveValue("1");
  await editor.getByLabel("Servings per batch").fill("2");
  await editor.getByLabel("Recipe status").selectOption("false");
  await editor
    .getByRole("button", { name: "Save recipe", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(card).toContainText("Makes 2 servings");
  await expect(card).toContainText("Inactive");

  const status = page.getByLabel("Filter recipes by status");
  await status.selectOption("active");
  await expect(
    page.getByText("No matching recipes", { exact: true }),
  ).toBeVisible();
  await status.selectOption("inactive");
  await expect(card).toBeVisible();
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
  await expect(page.locator('[name="rating"]')).toHaveCount(0);
  await expect(
    page
      .getByRole("group", { name: "Amenities", exact: true })
      .getByRole("checkbox"),
  ).toHaveCount(5);
  await page.getByLabel("Café name", { exact: true }).fill(name);
  await page.getByRole("checkbox", { name: "WiFi", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Work Station", exact: true })
    .check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(page.getByLabel("Café name", { exact: true })).toHaveValue(name);
  await page.goto("/partner/cafes");
  await page
    .getByRole("link", { name: `Resume draft: ${name}`, exact: true })
    .click();
  await expect(page.getByLabel("Café name", { exact: true })).toHaveValue(name);
  await expect(
    page.getByRole("checkbox", { name: "WiFi", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Work Station", exact: true }),
  ).toBeChecked();
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
  await page.setViewportSize({ width: 320, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator('[name="menu"]')).toHaveCount(0);
  const linkedPhoto = "https://example.test/cafe-photo.png";
  await page.route(linkedPhoto, (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  const coverLink = page.getByLabel("Or paste a cover image URL");
  await coverLink.fill(linkedPhoto);
  await expect(page.getByAltText("Store cover photo")).toBeVisible();
  await page
    .getByLabel("Cover image file", { exact: true })
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Cover awaiting review")).toBeVisible();
  await expect(coverLink).toHaveValue("");
  await expect
    .poll(() =>
      page
        .getByAltText("Cover awaiting review")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Add URL", exact: true }).click();
  const galleryLink = page.getByLabel("Gallery image URL", { exact: true });
  await galleryLink.fill(linkedPhoto);
  await galleryLink.press("Enter");
  await page.getByLabel("Gallery image files", { exact: true }).setInputFiles([
    { name: "interior.png", mimeType: "image/png", buffer: png },
    { name: "storefront.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.getByText("3 photos", { exact: true })).toBeVisible();
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
  await expect(page.locator('input[name="gallery"]')).toHaveValue(linkedPhoto);
  await expect(page.getByText("3 photos", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Submitted");
  await page.goto("/partner/preview-review");
  const request = page.locator("section").filter({ hasText: name });
  await expect(request.getByAltText("Proposed cover")).toBeVisible();
  await expect(request.getByAltText("Proposed gallery 2")).toBeVisible();
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
    .getByLabel("Cover image file", { exact: true })
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

test("dashboard chart and inventory filters are usable at mobile and desktop widths", async ({
  page,
}) => {
  for (const width of [320, 390, 897, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/partner/overview");
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Weekly completed rewards/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.partner-portal/dashboard-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/partner/inventory");
  await page.getByLabel("Search inventory").fill("Whole milk");
  await expect(
    page.getByRole("cell").filter({ hasText: "Whole milk" }),
  ).toHaveCount(1);
  await page.getByLabel("Filter by café").selectOption("102");
  await expect(
    page.getByText("No items match this view", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search inventory").fill("");
  await page.getByLabel("Filter by café").selectOption("");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close menu" })
    .click();
  await expect(
    page.getByRole("button", { name: "Add item", exact: true }),
  ).toBeFocused();
});
