export type PartnerRole = "owner" | "chain_manager" | "cafe_manager";

export type PartnerPermission =
  | "cafes.read"
  | "cafes.submit"
  | "cafes.create"
  | "rewards.read"
  | "inventory.read"
  | "inventory.write"
  | "recipes.read"
  | "recipes.write"
  | "team.manage"
  | "billing.manage";

export interface PartnerMembership {
  userId: string;
  chainId: string;
  role: PartnerRole;
  status: "active" | "invited" | "revoked";
  assignedCafeIds: readonly number[];
}

/** Effective access, resolved from authoritative subscription/activation data. */
export interface PartnerEntitlement {
  chainId: string;
  plan: "free" | "paid";
  activation: "confirmed" | "pending" | "failed";
}

/** Private cafe access state, never inferred from a public directory response. */
export interface PartnerCafeScope {
  id: number;
  chainId: string;
  isActive: boolean | null;
  subscriptionRestricted: boolean;
}

export interface PartnerAccessRequest {
  actorUserId: string;
  chainId: string;
  membership: PartnerMembership | null;
  entitlement: PartnerEntitlement | null;
  permission: PartnerPermission;
  cafe?: PartnerCafeScope;
}

const CAFE_PERMISSIONS: ReadonlySet<PartnerPermission> = new Set([
  "cafes.read",
  "cafes.submit",
  "rewards.read",
  "inventory.read",
  "inventory.write",
]);

const PAID_PERMISSIONS: ReadonlySet<PartnerPermission> = new Set([
  "inventory.read",
  "inventory.write",
  "recipes.read",
  "recipes.write",
]);

const MANAGER_PERMISSIONS: ReadonlySet<PartnerPermission> = new Set([
  "cafes.read",
  "cafes.submit",
  "cafes.create",
  "rewards.read",
  "inventory.read",
  "inventory.write",
  "recipes.read",
  "recipes.write",
]);

const OWNER_PERMISSIONS: ReadonlySet<PartnerPermission> = new Set([
  ...MANAGER_PERMISSIONS,
  "team.manage",
  "billing.manage",
]);

const CAFE_MANAGER_PERMISSIONS: ReadonlySet<PartnerPermission> = new Set([
  "cafes.read",
  "cafes.submit",
  "rewards.read",
  "inventory.read",
  "inventory.write",
  "recipes.read",
]);

function roleAllows(role: PartnerRole, permission: PartnerPermission): boolean {
  switch (role) {
    case "owner":
      return OWNER_PERMISSIONS.has(permission);
    case "chain_manager":
      return MANAGER_PERMISSIONS.has(permission);
    case "cafe_manager":
      return CAFE_MANAGER_PERMISSIONS.has(permission);
    default:
      return false;
  }
}

/**
 * Pure rules for server entry points, fed by fresh server-owned database records.
 * Never construct this context from form fields, JWT role/plan claims, public
 * cafe rows, or browser state. RLS/RPC checks must independently enforce access.
 * Slot allocation, stock integrity, and review transitions still require their
 * own transaction checks; a positive decision here does not perform a mutation.
 */
export function canPartnerAccess(request: PartnerAccessRequest): boolean {
  const { actorUserId, chainId, membership, entitlement, permission, cafe } =
    request;
  if (
    !actorUserId ||
    !chainId ||
    !membership ||
    membership.status !== "active" ||
    membership.userId !== actorUserId ||
    membership.chainId !== chainId ||
    !roleAllows(membership.role, permission)
  ) {
    return false;
  }

  // Missing/unknown access state never unlocks a partner feature. Pending or
  // failed Paid activation may retain Free features, but cannot grant Paid ones.
  if (!entitlement || entitlement.chainId !== chainId) return false;
  if (entitlement.plan !== "free" && entitlement.plan !== "paid") return false;
  if (
    PAID_PERMISSIONS.has(permission) &&
    (entitlement.plan !== "paid" || entitlement.activation !== "confirmed")
  ) {
    return false;
  }

  if (CAFE_PERMISSIONS.has(permission)) {
    if (
      !cafe ||
      !Number.isSafeInteger(cafe.id) ||
      cafe.id <= 0 ||
      cafe.chainId !== chainId ||
      cafe.subscriptionRestricted !== false ||
      typeof cafe.isActive !== "boolean"
    ) {
      return false;
    }
    if (
      membership.role === "cafe_manager" &&
      !membership.assignedCafeIds.includes(cafe.id)
    ) {
      return false;
    }
  } else if (cafe) {
    // Chain permissions have no cafe target. Reject ambiguous mixed contexts.
    return false;
  }

  return true;
}

/** Only approved live rows belong here; a draft must never enter this projection. */
export function isCafeDiscoverable(isActive: boolean | null): boolean {
  // Subscription restriction intentionally does not determine public discovery.
  return isActive === true;
}
