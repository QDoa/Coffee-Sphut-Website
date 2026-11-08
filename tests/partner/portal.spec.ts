import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db } from "../../scripts/partner-portal/database";
function reviewCard(page: Page, name: string): Locator {
  return page.locator("section").filter({
    has: page.getByText(name, { exact: true }),
  });
}

async function openReview(page: Page, name: string): Promise<Locator> {
  const search = page.getByLabel("Search review requests");
  await search.fill(name);
  await page.getByRole("button", { name: "Search requests" }).click();
  await expect(page.getByRole("status")).toContainText("of 1 request");
  const card = reviewCard(page, name);
  const expand = card.getByRole("heading").getByRole("button");
  await expand.click();
  await expect(expand).toHaveAttribute("aria-expanded", "true");
  return card;
}

async function approveReview(page: Page, card: Locator): Promise<void> {
  await card.getByRole("button", { name: "Approve request", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve request" }).click();
  await expect(card).toHaveCount(0);
}

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
test("team invitations explain access, can be copied, and can be revoked", async ({
  page,
  context,
}) => {
  const email = `team-${randomUUID()}@example.test`;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/partner/team");
  const form = page.getByRole("region", { name: "Invite a manager" });
  await expect(form.getByRole("group", { name: "Assign cafés" })).toHaveCount(0);
  await form.getByLabel("Manager email").fill(email);
  await form.getByRole("radio", { name: /Café Manager/ }).check();
  const create = form.getByRole("button", { name: "Create invitation link" });
  await expect(create).toBeDisabled();
  await form.getByRole("checkbox", { name: /North Star • Riverside/ }).check();
  await create.click();
  await form.getByRole("button", { name: "Copy invitation link" }).click();
  await expect(form.getByText("Invitation link copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^http:\/\/127\.0\.0\.1:3100\/partner\/accept\?token=/,
  );

  const invitations = page.getByRole("region", { name: "Invitations" });
  const row = invitations.getByRole("listitem").filter({ hasText: email });
  await expect(row).toContainText("Pending");
  await expect(row).toContainText("North Star • Riverside");
  await row.getByRole("button", { name: /Revoke invitation for/ }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Revoke invitation for/ }).click();
  await dialog.getByRole("button", { name: "Revoke invitation" }).click();
  await expect(dialog).toHaveCount(0);
  await invitations.getByText(/Invitation history/).click();
  await expect(row).toContainText("Revoked");
  await expect(row.getByRole("button")).toHaveCount(0);
});

test("Owners can update a manager’s role and cafés without a new invitation", async ({
  page,
}) => {
  const memberId = randomUUID();
  const userId = randomUUID();
  const email = `edit-manager-${userId}@example.test`;
  const chain = "20000000-0000-4000-8000-000000000001";
  const client = await db("postgres");
  try {
    await client.query("insert into auth.users(id,email) values($1,$2)", [userId, email]);
    await client.query(
      "insert into public.partner_memberships(id,chain_id,user_id,role) values($1,$2,$3,'cafe_manager')",
      [memberId, chain, userId],
    );
    await client.query(
      "insert into public.partner_assignments(membership_id,chain_id,cafe_id) values($1,$2,101)",
      [memberId, chain],
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/partner/team");
    const members = page.getByRole("region", { name: "Team members" });
    const row = members.getByRole("listitem").filter({ hasText: email });
    const edit = row.getByRole("button", { name: /Edit access/ });
    const dialog = page.getByRole("dialog", { name: "Edit manager access" });
    const save = dialog.getByRole("button", { name: "Save access" });
    await expect(members.getByRole("button", { name: "Edit access for owner@example.test" })).toHaveCount(0);
    await edit.click();
    await expect(dialog).toBeInViewport();
    await expect(dialog.getByRole("radio", { name: /Café Manager/ })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: /North Star • Downtown/ })).toBeChecked();
    await expect(save).toBeDisabled();
    await dialog.getByRole("radio", { name: /Chain Manager/ }).check();
    await save.click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toContainText("Chain Manager");

    await edit.click();
    await dialog.getByRole("radio", { name: /Café Manager/ }).check();
    await expect(save).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /North Star • Riverside/ }).check();
    await save.click();
    await expect(row).toContainText("North Star • Riverside");
    await expect(row.getByRole("status")).toHaveText("Manager access updated.");
    await page.reload();
    await expect(row).toContainText("Café Manager");
    await edit.click();
    await expect(dialog.getByRole("checkbox", { name: /North Star • Riverside/ })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: /North Star • Downtown/ })).not.toBeChecked();
  } finally {
    await client.query("delete from public.partner_assignments where membership_id=$1", [memberId]);
    await client.query("delete from public.partner_memberships where id=$1", [memberId]);
    await client.query("delete from auth.users where id=$1", [userId]);
    await client.end();
  }
});

test("Paid plan settings show plan features and the reporting timezone", async ({
  page,
}) => {
  await page.goto("/partner/billing");
  await expect(page.getByRole("heading", { name: "Paid plan" })).toBeVisible();
  const comparison = page.getByRole("table", { name: "Compare plans" });
  await expect(comparison.getByRole("row", { name: /Active cafés/ })).toContainText(
    "Unlimited",
  );
  await expect(page.getByRole("heading", { name: "Café access on Free" })).toHaveCount(0);
  const settings = page.getByRole("region", { name: "Reporting timezone" });
  await expect(settings.getByLabel("Timezone", { exact: true })).not.toHaveValue("");
  await settings.getByRole("button", { name: "Save timezone" }).click();
  await expect(settings.getByRole("status")).toContainText("Saved");
});

test("staff select named cafés and explicitly confirm an empty Free downgrade", async ({ page }) => {
  const client = await db("postgres");
  const chain = randomUUID();
  const name = `Plan picker ${chain.slice(0, 8)}`;
  try {
    await client.query('insert into public."Chains"(id,name) values($1,$2)', [chain, name]);
    await client.query("insert into public.partner_accounts(chain_id,plan) values($1,'paid')", [chain]);
    await client.query(
      'insert into public."Cafe"(chain_id,name,is_active) values($1,$2,true)',
      [chain, `${name} Café`],
    );
    await page.goto("/partner/preview-review");
    await page.getByRole("link", { name: "Jump to administrator tools" }).click();
    await page.getByText("Record a plan change", { exact: true }).click();
    await page.getByRole("combobox", { name: "Partner", exact: true }).selectOption(chain);
    await page.getByRole("combobox", { name: "Plan", exact: true }).selectOption("free");
    await page.getByLabel("Approval or subscription reference").fill("Synthetic pilot downgrade");
    const save = page.getByRole("button", { name: "Record plan change" });
    const cafe = page.getByRole("checkbox", { name: `${name} Café` });
    const confirm = page.getByRole("checkbox", { name: /I confirm this Free plan/ });
    await expect(cafe).toBeVisible();
    await expect(save).toBeDisabled();
    await confirm.check();
    await expect(save).toBeEnabled();
    await cafe.check();
    await expect(confirm).toHaveCount(0);
    await expect(save).toBeEnabled();
    await cafe.uncheck();
    await expect(confirm).not.toBeChecked();
    await expect(save).toBeDisabled();
    await confirm.check();
    await save.click();
    await expect(page.getByRole("region", { name: "Administrator tools" }).getByRole("status")
      .filter({ hasText: "Saved successfully." })).toBeVisible();
    const access = async () => (await client.query(
      "select a.plan,c.restricted from public.partner_accounts a join public.partner_cafe_access c using (chain_id) where a.chain_id=$1",
      [chain],
    )).rows;
    expect(await access()).toEqual([{ plan: "free", restricted: true }]);

    await cafe.check();
    await page.getByLabel("Approval or subscription reference").fill("Restore named café access");
    await save.click();
    await expect.poll(access).toEqual([{ plan: "free", restricted: false }]);
  } finally {
    await client.query("delete from public.partner_operations where input->>'chain_id'=$1", [chain]);
    await client.query("delete from public.partner_audit where chain_id=$1", [chain]);
    await client.query("delete from public.partner_cafe_access where chain_id=$1", [chain]);
    await client.query('delete from public."Cafe" where chain_id=$1', [chain]);
    await client.query("delete from public.partner_accounts where chain_id=$1", [chain]);
    await client.query('delete from public."Chains" where id=$1', [chain]);
    await client.end();
  }
});

test("cafe edit stays pending until an independent reviewer publishes it", async ({
  page,
}) => {
  const address = `Browser verified ${randomUUID().slice(0, 8)}`;
  await page.goto("/partner/cafe?id=101");
  const cafeName = await page.getByLabel("Café name", { exact: true }).inputValue();
  await page.getByLabel("Address", { exact: true }).fill(address);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted");
  await page.goto("/partner/cafe?id=101");
  await expect(page.getByLabel("Address", { exact: true })).not.toHaveValue(
    address,
  );
  await page.goto("/partner/preview-review");
  const request = await openReview(page, cafeName);
  await expect(request.getByText("Current", { exact: true }).first()).toBeVisible();
  await expect(request.getByText(address, { exact: true })).toBeVisible();
  await expect(request.getByText(/Unchanged fields/)).toBeVisible();
  await approveReview(page, request);
  await page.goto("/partner/cafe?id=101");
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue(
    address,
  );
});
test("staff can filter the review queue and reject a request with feedback", async ({
  page,
}) => {
  const name = `Review queue test ${randomUUID().slice(0, 8)}`;
  const feedback = "Please add the café’s street address.";
  await page.goto("/partner/cafe");
  await page.getByLabel("Café name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/partner/preview-review");
  await page.getByLabel("Search review requests").fill(name);
  const filter = page.getByLabel("Filter by request type");
  await filter.selectOption("removal");
  await page.getByRole("button", { name: "Search requests" }).click();
  await expect(page.getByText("No requests match these filters.")).toBeVisible();
  await filter.selectOption("new");
  const card = await openReview(page, name);
  await card.getByRole("button", { name: "Reject request" }).click();
  const dialog = page.getByRole("dialog");
  const reject = dialog.getByRole("button", { name: "Reject request" });
  await expect(reject).toBeDisabled();
  await dialog.getByLabel("Rejection reason").fill(feedback);
  await reject.click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(`Rejected the request for ${name}.`);

  await page.goto("/partner/cafes");
  const request = page.getByRole("region", { name: "Change requests" })
    .getByRole("listitem").filter({ hasText: name });
  await expect(request).toContainText("Changes requested");
  await expect(request).toContainText(feedback);
});

test("older drafts open directly and both queues search and paginate on the server", async ({ page }) => {
  const client = await db("postgres");
  const chain = "20000000-0000-4000-8000-000000000001";
  const owner = "10000000-0000-4000-8000-000000000001";
  const prefix = `Queue fixture ${randomUUID().slice(0, 8)}`;
  const draftName = `${prefix} draft 1`;
  try {
    const { rows } = await client.query(
      `insert into public.partner_changes(chain_id,submitter,payload,status,created_at)
       select $1,$2,jsonb_build_object('name',$3 || ' draft ' || n),'draft',
         now()-interval '1 hour'+n*interval '1 second'
       from generate_series(1,105) n returning id,payload->>'name' as name`,
      [chain, owner, prefix],
    );
    const draft = rows.find((row) => row.name === draftName);
    await client.query(
      `insert into public.partner_changes(chain_id,submitter,payload,status,created_at)
       select $1,$2,jsonb_build_object('name',$3 || ' pending ' || n),'pending',
         now()-interval '2 hours'+n*interval '1 second'
       from generate_series(1,25) n`,
      [chain, owner, prefix],
    );

    await page.goto(`/partner/cafe?change=${draft.id}`);
    await expect(page.getByLabel("Café name", { exact: true })).toHaveValue(draftName);
    const mismatched = await page.request.get(`/partner/cafe?change=${draft.id}&id=101`);
    expect(mismatched.status()).toBe(404);

    const existingDraft = (await client.query(
      `insert into public.partner_changes(chain_id,cafe_id,submitter,payload,status,created_at)
       values($1,101,$2,jsonb_build_object('name',$3::text),'draft',now()-interval '3 hours')
       returning id`,
      [chain, owner, `${prefix} existing café`],
    )).rows[0].id;
    await page.goto(`/partner/cafe?change=${existingDraft}&id=101`);
    await expect(page.getByLabel("Café name", { exact: true })).toHaveValue(`${prefix} existing café`);

    await page.goto("/partner/cafes");
    const requests = page.getByRole("region", { name: "Change requests" });
    await requests.getByLabel("Search change requests").fill(`${prefix} draft`);
    await requests.getByLabel("Filter change requests by status").selectOption("draft");
    await requests.getByRole("button", { name: "Search requests" }).click();
    await expect(requests.getByText("Showing 1–20 of 105 requests")).toBeVisible();
    await expect(requests.getByRole("listitem")).toHaveCount(20);
    await requests.getByRole("link", { name: "Next page" }).click();
    await expect(requests.getByText("Showing 21–40 of 105 requests")).toBeVisible();
    await requests.getByLabel("Search change requests").fill(draft.id);
    await requests.getByRole("button", { name: "Search requests" }).click();
    await expect(requests.getByText("Showing 1–1 of 1 request")).toBeVisible();
    await expect(requests.getByRole("link", { name: `Resume draft: ${draftName}` })).toBeVisible();

    await page.goto("/partner/preview-review");
    await page.getByLabel("Search review requests").fill(prefix);
    await page.getByLabel("Filter by request type").selectOption("new");
    await page.getByRole("button", { name: "Search requests" }).click();
    await expect(page.getByRole("status")).toContainText("Showing 1–20 of 25 requests");
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page.getByRole("status")).toContainText("Showing 21–25 of 25 requests");
    await expect(reviewCard(page, `${prefix} pending 25`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(0);
  } finally {
    await client.query("delete from public.partner_changes where chain_id=$1 and payload->>'name' like $2", [chain, `${prefix}%`]);
    await client.end();
  }
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
  await approveReview(page, await openReview(page, name));

  const list = `/partner/cafes?q=${encodeURIComponent(name)}`;
  await page.goto(list);
  const directory = page.getByRole("region", { name: "Café directory" });
  await expect(directory.getByLabel("Search cafés")).toHaveValue(name);
  await expect(directory.getByRole("status")).toContainText("Showing 1 of");
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
  await expect(page.getByRole("status")).toContainText("awaiting review");

  await page.goto(list);
  await directory.getByRole("link", { name: "View pending request" }).click();
  await expect(page.getByRole("status")).toContainText("awaiting review");

  await page.goto(cafeUrl);
  await expect(page.getByLabel("Active café")).toBeChecked();
  await expect(addressField).toHaveValue(address);
  await remove.click();
  await dialog.getByRole("button", { name: "Request removal" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "already has a request awaiting review",
  );

  await page.goto("/partner/preview-review");
  const removal = await openReview(page, name);
  await expect(removal).toContainText("removes this café from public listings");
  await approveReview(page, removal);

  await page.goto(cafeUrl);
  await expect(page.getByLabel("Active café")).not.toBeChecked();
  await expect(addressField).toHaveValue(address);
  await expect(remove).toHaveCount(0);
  await page.goto(list);
  await expect(page.getByText("Archived · history preserved")).toBeVisible();
  const cafeFilter = directory.getByLabel("Filter cafés by status");
  await cafeFilter.selectOption("active");
  await expect(directory.getByText("No cafés match these filters")).toBeVisible();
  await directory.getByRole("button", { name: "Clear café filters" }).click();
  await expect(cafeFilter).toHaveValue("all");
  await directory.getByLabel("Search cafés").fill(address);
  await cafeFilter.selectOption("archived");
  await expect(directory.getByRole("heading", { name, exact: true })).toBeVisible();

  const requests = page.getByRole("region", { name: "Change requests" });
  await requests
    .getByLabel("Filter change requests by status")
    .selectOption("approved");
  await requests.getByLabel("Search change requests").fill(name);
  await requests.getByRole("button", { name: "Search requests" }).click();
  const approvedRequests = requests.getByRole("listitem").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
  await expect(approvedRequests).toHaveCount(2);
  await expect(
    approvedRequests.first().getByText("Approved", { exact: true }),
  ).toBeVisible();
  await approvedRequests
    .first()
    .getByRole("link", { name: `View request: ${name}` })
    .click();
  await expect(page.getByRole("status")).toContainText("approved this request");
});

test("a partner can discard a draft and withdraw a café removal request", async ({
  page,
}) => {
  const name = `Withdraw test ${randomUUID().slice(0, 8)}`;
  const requests = page.getByRole("region", { name: "Change requests" });
  const confirm = page.getByRole("alertdialog");
  await page.goto("/partner/cafe");
  await page.getByLabel("Café name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.goto("/partner/cafes");
  const discard = requests.getByRole("button", {
    name: `Discard draft for ${name}`,
  });
  await discard.click();
  await confirm.getByRole("button", { name: "Keep draft" }).click();
  await expect(discard).toBeVisible();
  await discard.click();
  await confirm
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await expect(requests.getByRole("status")).toHaveText("Draft discarded.");
  await expect(requests.getByRole("heading", { name, exact: true })).toHaveCount(0);

  await page.goto("/partner/cafe");
  await page.getByLabel("Café name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted");
  await page.goto("/partner/preview-review");
  await approveReview(page, await openReview(page, name));

  await page.goto(`/partner/cafes?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name: "Details & edit request" }).click();
  await expect(page).toHaveURL(/\/partner\/cafe\?id=\d+$/);
  const cafeUrl = page.url();
  await page.getByRole("button", { name: "Remove café", exact: true }).click();
  await confirm.getByRole("button", { name: "Request removal" }).click();
  await page
    .getByRole("button", { name: `Withdraw removal request for ${name}` })
    .click();
  await confirm
    .getByRole("button", { name: "Withdraw removal request", exact: true })
    .click();
  await expect(requests.getByRole("status")).toHaveText(
    "Café removal request withdrawn.",
  );
  await expect(
    requests.getByRole("button", { name: `Withdraw removal request for ${name}` }),
  ).toHaveCount(0);
  await page.goto(cafeUrl);
  await expect(page.getByLabel("Active café")).toBeChecked();
});

test("mobile stock rows show warnings and open movements with the item selected", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/partner/inventory");
  const stock = page.getByRole("list", { name: "Stock items" });
  const firstRow = stock.getByRole("listitem").first();
  await expect(firstRow).toBeInViewport();
  const row = stock.getByRole("listitem").filter({ hasText: "House espresso beans" });
  await expect(row).toContainText("North Star");
  await expect(row).toContainText(/\d.* g/);
  await row.getByRole("button", { name: "Record movement for House espresso beans" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Item and café", { exact: true })).toHaveValue(
    "40000000-0000-4000-8000-000000000001",
  );
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
    await page.goto("/partner/cafes");
    await expect(
      page.getByRole("region", { name: "Café directory" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Jump to change requests" }).click();
    await expect(page).toHaveURL(/#cafe-change-requests$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const [route, title] of [
      ["team", "Team"],
      ["billing", "Plan & settings"],
      ["preview-review", "Staff review"],
    ]) {
      await page.goto(`/partner/${route}`);
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
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
  const request = await openReview(page, name);
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
  await approveReview(page, request);
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
  await page.getByRole("link", { name: "Jump to administrator tools" }).click();
  await expect(page).toHaveURL(/#review-admin-tools$/);
  const admin = page.getByRole("region", { name: "Administrator tools" });
  await admin.getByText("Upload cleanup", { exact: true }).click();
  await admin.getByLabel("Upload ID", { exact: true }).fill(cover);
  await admin
    .getByRole("button", { name: "Remove unused upload", exact: true })
    .click();
  await expect(admin.getByRole("status")).toContainText("Unused upload removed");
  const response = await page.request.get(`/partner/media/${cover}`);
  expect(response.status()).toBe(404);
});

test("reward presets show their dates and invalid ranges keep the filters available", async ({ page }) => {
  await page.goto("/partner/rewards");
  await page.getByRole("link", { name: "This week" }).click();
  await expect(page.getByText(/Reporting period \d{4}-\d{2}-\d{2} to/)).toBeVisible();
  await expect(page.getByLabel("From", { exact: true })).not.toHaveValue("");
  await page.getByLabel("From", { exact: true }).fill("2026-12-02");
  await page.getByLabel("Through", { exact: true }).fill("2026-12-01");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Choose an end date on or after the start date.")).toBeVisible();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-12-02");
  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(page.getByText(/Reporting period \d{4}-\d{2}-\d{2} to/)).toBeVisible();
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
