"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  redeemRewardRequest,
  rewardAvailable,
} from "@/app/redeem_reward/server";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PublicPage } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Availability = "available" | "unavailable" | "error" | "redeemed";
interface RewardState {
  rewardId: string;
  availability: Availability;
}

export default function RedeemRewardClient() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const firstName = searchParams.get("firstName");
  const cafeChainName = searchParams.get("cafeChain");
  const rewardId = searchParams.get("rewardId") ?? "";
  const [reward, setReward] = useState<RewardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const availability =
    reward?.rewardId === rewardId ? reward.availability : "checking";

  useEffect(() => {
    if (!rewardId) return;
    let cancelled = false;
    rewardAvailable(rewardId)
      .then((available) => {
        if (!cancelled)
          setReward({
            rewardId,
            availability: available ? "available" : "unavailable",
          });
      })
      .catch(() => {
        if (!cancelled) setReward({ rewardId, availability: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [rewardId, retryCount]);

  async function redeemReward(formData: FormData): Promise<void> {
    setError(null);
    try {
      const { error } = await redeemRewardRequest(formData, rewardId);
      if (error) throw error;
      const text = `The reward has been redeemed${firstName ? ` for ${firstName}` : ""}${cafeChainName ? ` at ${cafeChainName}` : ""}.`;
      toast.success(text);
      formRef.current?.reset();
      setReward({ rewardId, availability: "redeemed" });
    } catch (failure) {
      const text =
        typeof failure === "string"
          ? failure
          : "We couldn’t redeem this reward. Please try again or contact Coffee Sphut support.";
      setError(text);
      toast.error(text);
    }
  }

  return (
    <PublicPage
      eyebrow="Coffee Sphut rewards"
      title="Good coffee comes back around."
      description={
        firstName && cafeChainName
          ? `Redeem a reward for ${firstName} at ${cafeChainName}.`
          : "Open a reward from the app to view its details and redeem it at the café."
      }
    >
      {!rewardId ? (
        <div role="alert">
          <h2 className="font-serif text-2xl tracking-tight">
            This link is incomplete.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Please open the reward in the Coffee Sphut app and try the link
            again.
          </p>
        </div>
      ) : availability === "checking" ? (
        <div
          role="status"
          className="flex min-h-28 items-center gap-3 text-sm text-muted-foreground"
        >
          <Spinner aria-hidden="true" /> Checking your reward…
        </div>
      ) : availability === "available" ? (
        <form ref={formRef} action={redeemReward} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="redeem-cafe-code">Café code</Label>
            <Input
              id="redeem-cafe-code"
              required
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              name="cafeCode"
              placeholder="Enter your café code"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "redeem-error" : undefined}
              className="h-12 rounded-xl"
            />
          </div>
          {error && (
            <p
              id="redeem-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <FormSubmitButton pendingLabel="Redeeming reward…">
            Redeem reward
          </FormSubmitButton>
        </form>
      ) : availability === "redeemed" ? (
        <div role="status">
          <h2 className="font-serif text-2xl tracking-tight">
            Reward redeemed.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            All done. Thank you for being part of the café community.
          </p>
        </div>
      ) : availability === "error" ? (
        <div role="alert">
          <h2 className="font-serif text-2xl tracking-tight">
            We couldn’t check this reward.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Please try again, or contact support if the issue continues.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 h-11"
            onClick={() => {
              setReward(null);
              setRetryCount((count) => count + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div role="status">
          <h2 className="font-serif text-2xl tracking-tight">
            This reward is unavailable.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            It may have already been redeemed. Contact support if you believe
            this is an error.
          </p>
        </div>
      )}
    </PublicPage>
  );
}
