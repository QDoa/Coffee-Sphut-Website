import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canPartnerAccess,
  isCafeDiscoverable,
  type PartnerAccessRequest,
  type PartnerPermission,
} from "./permissions";
import { canReviewPartnerSubmission } from "./reviews";

function fixture(
  permission: PartnerPermission = "cafes.read",
): PartnerAccessRequest {
  return {
    actorUserId: "user-a",
    chainId: "chain-a",
    membership: {
      userId: "user-a",
      chainId: "chain-a",
      role: "cafe_manager",
      status: "active",
      assignedCafeIds: [1],
    },
    entitlement: { chainId: "chain-a", plan: "paid", activation: "confirmed" },
    permission,
    cafe: {
      id: 1,
      chainId: "chain-a",
      isActive: true,
      subscriptionRestricted: false,
    },
  };
}

test("rejects a changed actor or tenant at every scope boundary", () => {
  const request = fixture();
  assert.ok(request.membership && request.entitlement && request.cafe);
  assert.equal(canPartnerAccess(request), true);
  assert.equal(canPartnerAccess({ ...request, actorUserId: "user-b" }), false);
  assert.equal(canPartnerAccess({ ...request, chainId: "chain-b" }), false);
  assert.equal(
    canPartnerAccess({
      ...request,
      membership: { ...request.membership, chainId: "chain-b" },
    }),
    false,
  );
  assert.equal(
    canPartnerAccess({
      ...request,
      entitlement: { ...request.entitlement, chainId: "chain-b" },
    }),
    false,
  );
  assert.equal(
    canPartnerAccess({
      ...request,
      cafe: { ...request.cafe, chainId: "chain-b" },
    }),
    false,
  );
});

test("revocation on the next context read removes access without waiting for session expiry", () => {
  const request = fixture();
  assert.ok(request.membership);
  assert.equal(canPartnerAccess(request), true);
  for (const status of ["revoked", "invited"] as const) {
    assert.equal(
      canPartnerAccess({
        ...request,
        membership: { ...request.membership, status },
      }),
      false,
    );
  }
  assert.equal(canPartnerAccess({ ...request, membership: null }), false);
});

test("cafe managers cannot access an unassigned cafe, even on confirmed Paid", () => {
  const request = fixture("inventory.read");
  assert.ok(request.cafe && request.membership);
  const unassigned = { ...request.cafe, id: 2 };
  assert.equal(canPartnerAccess({ ...request, cafe: unassigned }), false);
  for (const role of ["owner", "chain_manager"] as const) {
    assert.equal(
      canPartnerAccess({
        ...request,
        cafe: unassigned,
        membership: { ...request.membership, role },
      }),
      true,
    );
  }
});

test("Free, pending and failed Paid activation never unlock inventory or recipes", () => {
  const permissions = [
    "inventory.read",
    "inventory.write",
    "recipes.read",
    "recipes.write",
  ] as const;
  for (const permission of permissions) {
    const request = fixture(permission);
    assert.ok(request.membership && request.entitlement);
    request.membership.role = "owner";
    if (permission.startsWith("recipes.")) delete request.cafe;
    assert.equal(canPartnerAccess(request), true);
    assert.equal(
      canPartnerAccess({
        ...request,
        entitlement: { ...request.entitlement, plan: "free" },
      }),
      false,
    );
    for (const activation of ["pending", "failed"] as const) {
      assert.equal(
        canPartnerAccess({
          ...request,
          entitlement: { ...request.entitlement, activation },
        }),
        false,
      );
    }
  }
  const free = fixture("rewards.read");
  assert.ok(free.entitlement);
  free.entitlement.plan = "free";
  assert.equal(canPartnerAccess(free), true);
});

test("subscription locks apply even to an Owner and to archived history", () => {
  for (const isActive of [true, false]) {
    const request = fixture("rewards.read");
    assert.ok(request.membership && request.cafe);
    request.membership.role = "owner";
    request.cafe.isActive = isActive;
    request.cafe.subscriptionRestricted = true;
    assert.equal(canPartnerAccess(request), false);
  }
});

test("archival retains assigned details/report access and permits a reactivation submission", () => {
  for (const permission of [
    "cafes.read",
    "rewards.read",
    "cafes.submit",
  ] as const) {
    const request = fixture(permission);
    assert.ok(request.cafe && request.entitlement);
    request.cafe.isActive = false;
    request.entitlement.plan = "free";
    assert.equal(canPartnerAccess(request), true);
    assert.equal(isCafeDiscoverable(request.cafe.isActive), false);
  }
});

test("unknown lifecycle is not silently treated as active or archived", () => {
  const request = fixture();
  assert.ok(request.cafe);
  request.cafe.isActive = null;
  assert.equal(canPartnerAccess(request), false);
  assert.equal(isCafeDiscoverable(null), false);
  assert.equal(isCafeDiscoverable(true), true);
});

test("cafe managers can read shared recipes but cannot edit them or manage team/billing", () => {
  const request = fixture("recipes.read");
  delete request.cafe;
  assert.equal(canPartnerAccess(request), true);
  for (const permission of [
    "recipes.write",
    "cafes.create",
    "team.manage",
    "billing.manage",
  ] as const) {
    assert.equal(canPartnerAccess({ ...request, permission }), false);
  }
});

test("chain managers manage recipes but only Owners manage team and billing", () => {
  const request = fixture("recipes.write");
  assert.ok(request.membership);
  delete request.cafe;
  request.membership.role = "chain_manager";
  assert.equal(canPartnerAccess(request), true);
  for (const permission of ["team.manage", "billing.manage"] as const) {
    assert.equal(canPartnerAccess({ ...request, permission }), false);
    assert.equal(
      canPartnerAccess({
        ...request,
        permission,
        membership: { ...request.membership, role: "owner" },
      }),
      true,
    );
  }
});

test("rejects missing, ambiguous, and invalid cafe contexts", () => {
  const request = fixture();
  assert.ok(request.cafe);
  assert.equal(canPartnerAccess({ ...request, cafe: undefined }), false);
  assert.equal(canPartnerAccess({ ...request, entitlement: null }), false);
  for (const id of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(
      canPartnerAccess({ ...request, cafe: { ...request.cafe, id } }),
      false,
    );
  }
  assert.equal(
    canPartnerAccess({ ...request, permission: "recipes.read" }),
    false,
  );
});

test("an internal admin or editor cannot review their own immutable submission", () => {
  for (const staffRole of ["admin", "editor"] as const) {
    const actor = { userId: "submitter", staffRole };
    assert.equal(canReviewPartnerSubmission(actor, "submitter"), false);
    assert.equal(canReviewPartnerSubmission(actor, "another-partner"), true);
  }
});

test("partner membership alone does not authorize staff review", () => {
  assert.equal(
    canReviewPartnerSubmission({ userId: "owner", staffRole: null }, "partner"),
    false,
  );
  assert.equal(canReviewPartnerSubmission(null, "partner"), false);
  assert.equal(
    canReviewPartnerSubmission({ userId: "", staffRole: "admin" }, "partner"),
    false,
  );
  assert.equal(
    canReviewPartnerSubmission({ userId: "reviewer", staffRole: "admin" }, ""),
    false,
  );
});
