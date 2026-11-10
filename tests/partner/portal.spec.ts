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
test("partners can see requested values before and after approval", async ({ page }) => {
  const client = await db("postgres");
  const id = randomUUID();
  const name = `Request details fixture ${id.slice(0, 8)}`;
  const chain = "20000000-0000-4000-8000-000000000001";
  const owner = "10000000-0000-4000-8000-000000000001";
  let cafeId: number | undefined;
  try {
    const inserted = await client.query(
      `insert into public."Cafe"(chain_id,name,description,phone_number,is_active)
       values($1,$2,'Original description','555-0100',true) returning id,partner_revision`,
      [chain, name],
    );
    cafeId = Number(inserted.rows[0].id);
    await client.query(
      `insert into public.partner_changes(id,chain_id,cafe_id,baseline,payload,status,submitter)
       values($1,$2,$3,$4,$5,'pending',$6)`,
      [id, chain, cafeId, inserted.rows[0].partner_revision, {
        name, description: "New description for the café", phone_number: null,
      }, owner],
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/partner/cafes?tab=requests&request_q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name: `View request: ${name}` }).click();
    const requested = page.getByRole("region", { name: "Requested changes" });
    const description = requested.getByText("Description", { exact: true }).locator("..");
    await expect(description).toContainText("Original description");
    await expect(description).toContainText("New description for the café");
    const phone = requested.getByText("Phone number", { exact: true }).locator("..");
    await expect(phone).toContainText("555-0100");
    await expect(phone.getByText("—", { exact: true })).toBeVisible();
    await expect(requested.getByText("Café name", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const requestUrl = page.url();

    await page.goto("/partner/preview-review");
    await approveReview(page, await openReview(page, name));
    await client.query('update public."Cafe" set description=$1 where id=$2', ["A later edit", cafeId]);
    await page.goto(requestUrl);
    await expect(page.getByRole("status")).toContainText("approved this request");
    const submitted = page.getByRole("region", { name: "Submitted values" });
    await expect(submitted).toContainText("New description for the café");
    await expect(submitted).not.toContainText("A later edit");
    await expect(submitted.getByText("Current", { exact: true })).toHaveCount(0);
  } finally {
    await client.query("delete from public.partner_audit where action='review' and target=$1", [id]);
    await client.query("delete from public.partner_operations where action='review' and input->>'id'=$1", [id]);
    await client.query("delete from public.partner_media_publications where change_id=$1", [id]);
    await client.query("delete from public.partner_changes where id=$1", [id]);
    if (cafeId) {
      await client.query("delete from public.partner_cafe_access where cafe_id=$1", [cafeId]);
      await client.query('delete from public."Cafe" where id=$1', [cafeId]);
    }
    await client.end();
  }
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

  await page.goto("/partner/cafes?tab=requests");
  const request = page.getByRole("region", { name: "Change requests" })
    .getByRole("listitem").filter({ hasText: name });
  await expect(request).toContainText("Changes requested");
  await expect(request).toContainText(feedback);

  const bell = page.getByRole("link", { name: /^Review notifications, \d+ unread$/ });
  const unread = Number((await bell.getAttribute("aria-label"))?.match(/\d+/)?.[0]);
  await bell.click();
  await expect(page.getByRole("heading", { name: "Review notifications", exact: true })).toBeVisible();
  const update = page.getByRole("listitem").filter({ hasText: name });
  await expect(update).toContainText(feedback);
  await expect(update.getByText("Unread", { exact: true })).toBeVisible();
  await update.getByRole("button", { name: "Mark as read" }).click();
  await expect(update.getByText("Unread", { exact: true })).toHaveCount(0);
  await expect(page.getByText(`${unread - 1} unread`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(update.getByRole("button", { name: "Mark as read" })).toHaveCount(0);
  await update.getByRole("link", { name: "Open request" }).click();
  await expect(page.getByLabel("Café name", { exact: true })).toHaveValue(name);
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

    await page.goto("/partner/cafes?tab=requests");
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

  await page.getByRole("link", { name: /^Change requests/ }).click();
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
  await page.goto("/partner/cafes?tab=requests");
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
  await expect(card).toContainText("Makes 1 serving · 2 ingredients");
  await expect(card.getByRole("button", { name: "Scale recipe", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: "View recipe", exact: true }).click();
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
  await card.getByRole("button", { name: "View recipe", exact: true }).click();
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
    await page.getByRole("link", { name: /^Change requests.*pending/ }).click();
    await expect(page).toHaveURL(/tab=requests/);
    await expect(page.getByRole("region", { name: "Change requests" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Café directory" })).toHaveCount(0);
    if (width === 390) {
      await page.goto("/partner/cafes#cafe-change-requests");
      await expect(page.getByRole("region", { name: "Change requests" })).toBeVisible();
      await page.getByRole("link", { name: "Directory", exact: true }).click();
      await expect(page.getByRole("region", { name: "Café directory" })).toBeVisible();
    }
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
  await page.goto("/partner/cafes?tab=requests");
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
  await page.goto("/partner/cafes?tab=requests");
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
  await expect(page.getByRole("link", { name: "This week" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByText(/Reporting period \d{4}-\d{2}-\d{2} to/)).toBeVisible();
  await expect(page.getByLabel("From", { exact: true })).not.toHaveValue("");
  await page.getByLabel("From", { exact: true }).fill("2026-12-02");
  await page.getByLabel("Through", { exact: true }).fill("2026-12-01");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Choose an end date on or after the start date.")).toBeVisible();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-12-02");
  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(page.getByRole("link", { name: "Last 30 days" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByText(/Reporting period \d{4}-\d{2}-\d{2} to/)).toBeVisible();
  await expect(page.getByLabel("From", { exact: true })).not.toHaveValue("2026-12-02");
});

test("reward charts, café groups and CSV use the full filtered report", async ({ page }) => {
  const references = Array.from({ length: 55 }, () => randomUUID());
  const otherCafe = randomUUID();
  const client = await db("postgres");
  try {
    await client.query(
      `insert into public."Rewards"(id,user_id,chain_id,earned_store,redeemed_cafe_id,status,redeemed_at)
       select id,'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
              101,case when id=$2 then 101 else 102 end,'redeemed',now()
       from unnest($1::uuid[]) as ids(id)`,
      [[...references, otherCafe], otherCafe],
    );
    await page.goto("/partner/rewards?range=month");
    const trend = page.getByRole("region", { name: "Redemption trend" });
    await trend.getByText("View trend data").click();
    const plotted = (await trend.locator("dd").allTextContents())
      .reduce((sum, count) => sum + (Number(count.replaceAll(",", "")) || 0), 0);
    expect(plotted).toBeGreaterThanOrEqual(56);
    const breakdown = page.getByRole("region", { name: "Redemptions by café" });
    await expect(breakdown.getByRole("link", { name: /North Star • Downtown/ })).toBeVisible();
    const events = page.getByRole("region", { name: "Redemption events", exact: true });
    await expect(events.getByRole("list", { name: /Downtown/ })).toBeVisible();
    await expect(events.getByRole("list", { name: /Riverside/ })).toBeVisible();
    for (const width of [320, 390, 897, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await breakdown.getByRole("link", { name: /North Star • Riverside/ }).click();
    await expect(page.getByRole("combobox", { name: "Café", exact: true })).toHaveValue("102");
    await expect(events.getByRole("list", { name: /Downtown/ })).toHaveCount(0);
    await expect(events.getByRole("list", { name: /Riverside/ }).getByRole("listitem")).toHaveCount(50);
    const fullCafeCount = await breakdown.getByRole("listitem").innerText();
    await events.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/offset=50/);
    await expect(breakdown.getByRole("listitem")).toHaveText(fullCafeCount, { useInnerText: true });
    const eventReference = events.getByText("Reference", { exact: false }).first();
    await eventReference.click();
    await expect(events.locator("code").first()).toBeVisible();
    const from = await page.getByLabel("From", { exact: true }).inputValue();
    const to = await page.getByLabel("Through", { exact: true }).inputValue();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`reward-redemptions-${from}-${to}.csv`);
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const csv = Buffer.concat(chunks).toString("utf8");
    expect(csv).toContain('"Redemption timestamp (UTC)"');
    expect(csv).toContain('"North Star • Riverside","102"');
    for (const reference of references) expect(csv).toContain(reference);
    expect(csv).not.toContain(otherCafe);

    const invalid = await page.request.get("/partner/rewards/export?from=2026-12-02&to=2026-12-01");
    expect(invalid.status()).toBe(400);
    expect(invalid.headers()["cache-control"]).toBe("private, no-store");
    const inaccessible = await page.request.get("/partner/rewards/export?cafe_id=9007199254740991");
    expect(inaccessible.status()).toBe(403);
  } finally {
    await client.query('delete from public."Rewards" where id=any($1::uuid[])', [[...references, otherCafe]]);
    await client.end();
  }
});

test("sales report syncs Nigeria demo orders and compares POS and mobile sales by café", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/partner/sales");
  const demo = page.getByRole("region", { name: "Demo orders · Nigeria" });
  await expect(demo.getByText("North Star • Downtown", { exact: true })).toBeVisible();
  await expect(demo.getByText("North Star • Riverside", { exact: true })).toBeVisible();
  await demo.getByRole("button", { name: /sync demo orders/i }).click();
  await expect(demo.getByRole("status")).toHaveText(/Synced [\d,]+ demo orders\.|Demo orders are up to date/);
  await expect(demo.getByText("Last successful sync")).toBeVisible();
  await expect(demo.getByText("Connected", { exact: true })).toBeVisible();
  const totals = page.getByRole("region", { name: "Sales totals" });
  await expect(totals).toContainText("NGN");
  const before = await totals.innerText();
  await demo.getByRole("button", { name: "Sync demo orders", exact: true }).click();
  await expect(demo.getByRole("status")).toHaveText("Demo orders are up to date. No new orders.");
  await expect(totals).toHaveText(before, { useInnerText: true });
  await expect(page.getByRole("region", { name: "Top recipes by servings sold" })).toContainText("House latte");
  await expect(page.getByRole("link", { name: "CSV fallback" })).toBeVisible();
  await page.getByRole("link", { name: "Compare sales channels" }).click();
  const comparison = page.getByRole("region", { name: "POS vs mobile sales by café" });
  for (const name of ["North Star • Downtown", "North Star • Riverside"]) {
    const card = comparison.getByRole("heading", { name, exact: true }).locator("..");
    await expect(card.getByText("POS", { exact: true })).toBeVisible();
    await expect(card.getByText("Mobile", { exact: true })).toBeVisible();
    await expect(card.locator("dd")).toHaveText([/NGN.*[1-9]\d* orders/, /NGN.*[1-9]\d* orders/]);
  }
  await page.getByRole("combobox", { name: "Café", exact: true }).selectOption("102");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(comparison.getByRole("heading", { name: "North Star • Riverside" })).toBeVisible();
  await expect(comparison.getByRole("heading", { name: "North Star • Downtown" })).toHaveCount(0);
  const channelPicker = page.getByRole("combobox", { name: "Sales channel" });
  const recipes = page.getByRole("region", { name: "Top recipes by servings sold" });
  const channelTotals = comparison.locator("dd .font-medium");
  const [posNet, mobileNet] = await channelTotals.allTextContents();
  const servings = recipes.getByRole("listitem").first().locator("span").nth(1);
  const allServings = await servings.innerText();
  const allNet = await totals.locator("dd").first().innerText();
  await expect(channelPicker).toHaveValue("");
  await channelPicker.selectOption("mobile");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/channel=mobile/);
  await expect(totals.locator("dd").first()).toHaveText(mobileNet);
  await expect(recipes).toContainText("ranked by Mobile servings sold");
  const mobileServings = await servings.innerText();
  expect(mobileServings).not.toBe(allServings);
  await expect(channelTotals).toHaveText([posNet, mobileNet]);

  await channelPicker.selectOption("pos");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/channel=pos/);
  await expect(totals.locator("dd").first()).toHaveText(posNet);
  await expect(recipes).toContainText("ranked by POS servings sold");
  expect(await servings.innerText()).not.toBe(mobileServings);

  await channelPicker.selectOption("");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(totals.locator("dd").first()).toHaveText(allNet);
  await expect(servings).toHaveText(allServings);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("sales report imports daily POS data, handles corrections, and charts filtered sales", async ({ page }) => {
  const client = await db("postgres");
  const chain = "20000000-0000-4000-8000-000000000001";
  const name = `Sales fixture ${randomUUID().slice(0, 8)}`;
  let cafeId: string | undefined;
  try {
    cafeId = (await client.query(
      'insert into public."Cafe"(chain_id,name,is_active) values($1,$2,true) returning id',
      [chain, name],
    )).rows[0].id;
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/partner/sales?from=2024-05-01&to=2024-05-03");
    await expect(page.getByRole("heading", { name: "Sales report", exact: true })).toBeVisible();
    const form = page.locator("#sales-import");
    await form.getByRole("combobox", { name: "Café for this CSV" }).selectOption(String(cafeId));
    const [template] = await Promise.all([
      page.waitForEvent("download"),
      form.getByRole("link", { name: "Download CSV template" }).click(),
    ]);
    expect(template.suggestedFilename()).toBe("daily-pos-sales-template.csv");
    const importCurrency = form.getByRole("combobox", { name: "Currency for this CSV" });
    await expect(importCurrency).toHaveValue("NGN");
    await expect(importCurrency.locator("option").nth(1)).toHaveText("NGN · Nigerian Naira");
    for (const code of ["GHS", "KES", "ZAR", "XOF", "XAF", "UGX", "CAD"]) {
      await expect(importCurrency.locator(`option[value="${code}"]`)).toHaveCount(1);
    }
    const setFile = (gross: string, code?: string, date = "2024-05-02") => {
      const currencyColumn = code === undefined ? [] : ["currency"];
      const currencyCell = code === undefined ? [] : [code];
      const headers = ["date", ...currencyColumn, "gross_sales", "discounts", "refunds", "tax", "orders"];
      const row = [date, ...currencyCell, gross, "10", "5", "4.25", "12"];
      return form.getByLabel("POS CSV file").setInputFiles({
        name: "sales.csv", mimeType: "text/csv",
        buffer: Buffer.from(`${headers.join(",")}\r\n${row.join(",")}\r\n`),
      });
    };
    const save = form.getByRole("button", { name: "Import sales" });
    await importCurrency.selectOption("");
    await setFile("100");
    await save.click();
    await expect(form.getByRole("alert")).toContainText("Choose the currency for this CSV");
    await importCurrency.selectOption("NGN");
    await setFile("1,000");
    await save.click();
    await expect(form.getByRole("alert")).toContainText("Line 2");
    await setFile("100", "GHS");
    await save.click();
    await expect(form.getByRole("alert")).toContainText("Line 2 uses GHS, but you selected NGN");
    await expect(page.getByText("No sales match these filters.")).toBeVisible();
    await setFile("100");
    await save.click();
    await expect(form.getByRole("status")).toContainText("Saved sales for 1 day.");
    const cafes = page.getByRole("region", { name: "Net sales by café" });
    await expect(cafes).toContainText(name);
    await expect(cafes).toContainText(/NGN\s+85\.00/);
    await expect(page.getByRole("region", { name: "POS vs mobile sales by café" }))
      .toContainText("No POS or mobile order breakdown is available");
    const trend = page.getByRole("region", { name: "Net sales over time" });
    await trend.getByText("View trend data").click();
    await expect(trend.getByText("No data", { exact: true })).toHaveCount(2);
    await save.click();
    await expect(form.getByRole("status")).toContainText("No changes saved.");
    await setFile("125", "");
    await save.click();
    await expect(form.getByRole("alert")).toContainText("Replace existing days");
    await form.getByRole("checkbox", { name: /Replace existing days/ }).check();
    await save.click();
    await expect(cafes).toContainText(/NGN\s+110\.00/);

    await importCurrency.selectOption("");
    await setFile("200", "GHS", "2024-05-03");
    await save.click();
    await expect(form.getByRole("status")).toContainText("Saved sales for 1 day.");
    await expect(cafes).toContainText(/NGN\s+110\.00/);
    await page.getByRole("combobox", { name: "Café", exact: true }).selectOption(String(cafeId));
    await page.getByRole("combobox", { name: "Currency", exact: true }).selectOption("GHS");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(new RegExp(`cafe_id=${cafeId}`));
    await expect(page).toHaveURL(/currency=GHS/);
    await expect(cafes).toContainText(/GHS\s+185\.00/);
    for (const width of [320, 390, 897, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally {
    if (cafeId) {
      await client.query("delete from public.partner_audit where action='import_daily_sales' and target=$1", [cafeId]);
      await client.query("delete from public.partner_sales_daily where cafe_id=$1", [cafeId]);
      await client.query("delete from public.partner_cafe_access where cafe_id=$1", [cafeId]);
      await client.query('delete from public."Cafe" where id=$1', [cafeId]);
    }
    await client.end();
  }
});

test("sales report ranks imported recipe servings and follows the café filter", async ({ page }) => {
  const client = await db("postgres");
  const chain = "20000000-0000-4000-8000-000000000001";
  const suffix = randomUUID().slice(0, 8);
  const mocha = `Mocha, "iced" ${suffix}`;
  const latte = `Latte ${suffix}`;
  const cafeName = `Recipe sales café ${suffix}`;
  const recipeIds = [randomUUID(), randomUUID()];
  let cafeId: string | undefined;
  try {
    cafeId = (await client.query(
      'insert into public."Cafe"(chain_id,name,is_active) values($1,$2,true) returning id',
      [chain, cafeName],
    )).rows[0].id;
    await client.query(
      "insert into public.partner_recipes(id,chain_id,name,yield,ingredients) values($1,$3,$4,1,'[]'),($2,$3,$5,1,'[]')",
      [...recipeIds, chain, mocha, latte],
    );
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/partner/recipes");
    await page.getByRole("link", { name: "View recipe sales ranking" }).click();
    await expect(page).toHaveURL(/\/partner\/sales#recipe-sales$/);
    await page.goto("/partner/sales?from=2024-07-01&to=2024-07-03");
    const chart = page.getByRole("region", { name: "Top recipes by servings sold" });
    await chart.getByRole("link", { name: "Import recipe sales CSV" }).click();
    const form = page.locator("#recipe-sales-import");
    await form.getByRole("combobox", { name: "Café for recipe sales" }).selectOption(String(cafeId));
    const csvMocha = `"${mocha.replaceAll('"', '""')}"`;
    await form.getByLabel("Recipe sales CSV file").setInputFiles({
      name: "recipe-sales.csv", mimeType: "text/csv",
      buffer: Buffer.from(`date,recipe,servings_sold\r\n2024-07-02,${latte},7\r\n2024-07-02,${csvMocha},18\r\n`),
    });
    await form.getByRole("button", { name: "Import recipe sales" }).click();
    await expect(form.getByRole("status")).toHaveText("Saved 2 recipe sales rows.");
    await expect(chart.getByRole("listitem").first()).toContainText(mocha);
    await expect(chart.getByRole("listitem").first()).toContainText("18 servings sold");
    await expect(chart.getByRole("listitem").nth(1)).toContainText(latte);
    await expect(page.getByText("No sales match these filters.")).toBeVisible();
    const breakdown = chart.getByRole("listitem").first().locator("details");
    if (await breakdown.getAttribute("open") === null) await breakdown.locator("summary").click();
    await expect(breakdown.locator("dl > div").filter({ hasText: cafeName }).locator("dd")).toHaveText("18");
    await expect(breakdown.locator("dl > div").filter({ hasText: "North Star • Downtown" }).locator("dd")).toHaveText("No data");
    await page.getByRole("combobox", { name: "Café", exact: true }).selectOption(String(cafeId));
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(breakdown.locator("dt")).toHaveText([cafeName]);
    await page.getByRole("combobox", { name: "Café", exact: true }).selectOption("101");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(chart.getByText("No recipe servings sold", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    if (cafeId) {
      await client.query("delete from public.partner_recipe_sales_daily where cafe_id=$1", [cafeId]);
      await client.query("delete from public.partner_audit where action='import_recipe_sales' and target=$1", [cafeId]);
      await client.query("delete from public.partner_cafe_access where cafe_id=$1", [cafeId]);
      await client.query('delete from public."Cafe" where id=$1', [cafeId]);
    }
    await client.query("delete from public.partner_recipes where id=any($1::uuid[])", [recipeIds]);
    await client.end();
  }
});

test("restock planner uses the selected horizon and copies café-specific quantities", async ({ page, context }) => {
  const client = await db("postgres");
  const id = randomUUID();
  const name = `Restock fixture ${id.slice(0, 8)}`;
  const chain = "20000000-0000-4000-8000-000000000001";
  try {
    await client.query(
      `insert into public.partner_items(id,chain_id,cafe_id,name,code,type,unit,balance,threshold)
       values($1::uuid,$2,101,$3,$1::uuid::text,'ingredient','g',20,5)`, [id, chain, name],
    );
    await client.query(
      `insert into public.partner_movements(chain_id,cafe_id,item_id,quantity,resulting_balance,type,actor,reason,created_at)
       values($1,101,$2,111,111,'opening','10000000-0000-4000-8000-000000000001','Restock fixture',now()-interval '30 days'),
             ($1,101,$2,-91,20,'consumption','10000000-0000-4000-8000-000000000001','Restock fixture',now()-interval '2 days')`,
      [chain, id],
    );
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/partner/inventory");
    await page.getByRole("link", { name: "Restock planner", exact: true }).click();
    const planner = page.getByRole("region", { name: "Restock planner" });
    const cafe = planner.getByRole("combobox", { name: "Café", exact: true });
    await cafe.selectOption("101");
    const row = planner.getByRole("listitem").filter({ hasText: name });
    await expect(row.getByText("8 g", { exact: true })).toBeVisible();
    await planner.getByLabel("Days of coverage").fill("14");
    await expect(row.getByText("31 g", { exact: true })).toBeVisible();
    await planner.getByRole("button", { name: "Copy restock list" }).click();
    await expect(planner.getByRole("status")).toHaveText("Restock list copied.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`${name} (${id}) · 31 g`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await cafe.selectOption("102");
    await expect(row).toHaveCount(0);
  } finally {
    await client.query("delete from public.partner_movements where item_id=$1", [id]);
    await client.query("delete from public.partner_items where id=$1", [id]);
    await client.end();
  }
});

test("stocktake preserves entered counts on a conflict and then saves reviewed variances together", async ({ page }) => {
  const client = await db("postgres");
  const first = randomUUID();
  const second = randomUUID();
  const name = `Stocktake fixture ${first.slice(0, 8)}`;
  const note = `Closing count ${first}`;
  try {
    await client.query(
      `insert into public.partner_items(id,chain_id,cafe_id,name,code,type,unit,balance)
       values($1::uuid,'20000000-0000-4000-8000-000000000001',101,$3,$1::uuid::text,'ingredient','g',10),
             ($2::uuid,'20000000-0000-4000-8000-000000000001',101,$4,$2::uuid::text,'product','each',5)`,
      [first, second, name + " beans", name + " cups"],
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/partner/inventory?view=stocktake&cafe_id=101");
    const stocktake = page.getByRole("region", { name: "Stocktake mode" });
    await stocktake.getByLabel("Find items to count").fill(name);
    const beans = stocktake.getByLabel(new RegExp(`Counted .* ${name} beans`));
    const cups = stocktake.getByLabel(new RegExp(`Counted .* ${name} cups`));
    await beans.fill("8");
    await cups.fill("0");
    await expect(stocktake.getByText("−2 g difference")).toBeVisible();
    await expect(stocktake.getByText("−5 each difference")).toBeVisible();
    await stocktake.getByLabel("Stocktake note (optional)").fill(note);
    await client.query("update public.partner_items set balance=9 where id=$1", [first]);
    await stocktake.getByRole("button", { name: "Save 2 counts" }).click();
    await expect(stocktake.getByText("Balance changed. Recheck this count.")).toBeVisible();
    await expect(beans).toHaveValue("8");
    await expect(cups).toHaveValue("0");
    expect((await client.query("select 1 from public.partner_movements where reason=$1", [note])).rowCount).toBe(0);

    await beans.fill("7");
    await expect(stocktake.getByText("−2 g difference")).toBeVisible();
    await stocktake.getByRole("button", { name: "Save 2 counts" }).click();
    await expect(stocktake.getByRole("status")).toContainText("Saved 2 stock counts");
    await expect(beans).toHaveValue("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const counts = await client.query(
      "select item_id,quantity,resulting_balance from public.partner_movements where reason=$1 and type='count'", [note],
    );
    expect(counts.rows).toEqual(expect.arrayContaining([
      { item_id: first, quantity: "-2.000000", resulting_balance: "7.000000" },
      { item_id: second, quantity: "-5.000000", resulting_balance: "0.000000" },
    ]));
    expect(counts.rowCount).toBe(2);
  } finally {
    await client.query("delete from public.partner_movements where item_id=any($1)", [[first, second]]);
    await client.query("delete from public.partner_items where id=any($1)", [[first, second]]);
    await client.query("delete from public.partner_operations where action='stocktake' and input->>'reason'=$1", [note]);
    await client.query("delete from public.partner_audit where action='stocktake' and details->>'reason'=$1", [note]);
    await client.end();
  }
});

test("onboarding tracks workspace progress and links to the next setup task", async ({ page }) => {
  const client = await db("postgres");
  const chain = "20000000-0000-4000-8000-000000000001";
  const fixture = randomUUID();
  const recipes = await client.query("update public.partner_recipes set active=false where chain_id=$1 and active returning id", [chain]);
  try {
    await page.goto("/partner/overview");
    const checklist = page.getByRole("region", { name: "Onboarding checklist" });
    const progress = checklist.getByRole("progressbar", { name: "Onboarding progress" });
    const before = Number(await progress.getAttribute("value"));
    await expect(checklist.getByText("Save your first chain recipe")).toBeVisible();
    await checklist.getByRole("link", { name: "Open recipes" }).click();
    await expect(page).toHaveURL(/\/partner\/recipes$/);
    await client.query(
      `insert into public.partner_recipes(id,chain_id,name,yield,ingredients)
       select $1,$2,'Onboarding fixture',1,jsonb_build_array(jsonb_build_object('item_id',id,'quantity',1,'unit',unit))
       from public.partner_items where chain_id=$2 and type='ingredient' and active limit 1`,
      [fixture, chain],
    );
    await page.goto("/partner/overview");
    if (!(await progress.isVisible())) await checklist.getByText("Onboarding checklist", { exact: true }).click();
    await expect(progress).toHaveAttribute("value", String(before + 1));
    await expect(checklist.getByRole("link", { name: "Open recipes" })).toHaveCount(0);
  } finally {
    await client.query("delete from public.partner_recipes where id=$1", [fixture]);
    await client.query("update public.partner_recipes set active=true where id=any($1)", [recipes.rows.map(({ id }) => id)]);
    await client.end();
  }
});

test("stock watch explains threshold alerts and opens the exact café item", async ({ page }) => {
  const client = await db("postgres");
  const id = randomUUID();
  const name = `Stock watch fixture ${id.slice(0, 8)}`;
  try {
    await client.query(
      `insert into public.partner_items(id,chain_id,cafe_id,name,code,type,unit,balance,threshold)
       values($1,'20000000-0000-4000-8000-000000000001',101,$2,$3,'ingredient','g',1,2)`,
      [id, name, `test-${id}`],
    );
    await page.goto("/partner/overview");
    const alert = page.getByRole("link", { name: new RegExp(`View ${name}`) });
    await expect(alert.locator("../..")).toContainText("Alert threshold 2 g");
    await alert.click();
    await expect(page).toHaveURL(new RegExp(`item_id=${id}`));
    await expect(page.getByLabel("Filter by café")).toHaveValue("101");
    await expect(page.getByText(`Showing ${name}`, { exact: true })).toBeVisible();
    await expect(page.getByText("1 items shown", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Show all café items" }).click();
    await expect(page.getByText(`Showing ${name}`, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Manage House espresso beans" })).toBeVisible();
  } finally {
    await client.query("delete from public.partner_items where id=$1", [id]);
    await client.end();
  }
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
