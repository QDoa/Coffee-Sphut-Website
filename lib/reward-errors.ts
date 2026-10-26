interface RewardDatabaseError {
  code?: string;
  message: string;
}

export function rewardErrorMessage(
  error: RewardDatabaseError,
  operation: "stamp" | "redemption",
): string {
  if (error.code === "22023" && error.message === "Invalid cafe code") {
    return "That café code wasn’t recognised. Please check it with the café team.";
  }

  if (error.code === "22023" && error.message === "Reward is unavailable at this cafe") {
    return "This reward is unavailable at this café. It may already have been redeemed or belong to a different café chain.";
  }

  if (error.code === "22P02") {
    return "This reward link is invalid. Please reopen it from the Coffee Sphut app.";
  }

  if (error.code === "22023" && /^Cafe \d+ must have a positive loyalty threshold$/.test(error.message)) {
    return "This café’s rewards aren’t configured yet. Please ask the café team for help.";
  }

  if (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /invalid api key|invalid jwt|jwt expired/i.test(error.message)
  ) {
    return "Rewards are temporarily unavailable. Please contact Coffee Sphut support.";
  }

  return operation === "redemption"
    ? "We couldn’t redeem this reward. Please try again or contact Coffee Sphut support."
    : "We couldn’t add a stamp. Please try again or contact Coffee Sphut support.";
}
