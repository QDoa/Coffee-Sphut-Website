export interface PartnerReviewActor {
  userId: string;
  staffRole: "admin" | "editor" | null;
}

/**
 * Requires a freshly authorized internal staff actor and the immutable request
 * submitter. The database approval transaction must repeat this identity check.
 */
export function canReviewPartnerSubmission(
  actor: PartnerReviewActor | null,
  submitterUserId: string,
): boolean {
  return Boolean(
    actor?.userId &&
    submitterUserId &&
    (actor.staffRole === "admin" || actor.staffRole === "editor") &&
    actor.userId !== submitterUserId,
  );
}
