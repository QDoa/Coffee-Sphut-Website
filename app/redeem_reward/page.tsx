"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { redeemRewardRequest, rewardAvailable } from "@/app/redeem_reward/server";
import { useSearchParams } from 'next/navigation'

function RedeemRewardButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button 
      type='submit' 
      size="lg" 
      className="mt-4 text-base"
      disabled={pending}
    >
      {pending ? "Redeeming Reward..." : "Redeem Reward"}
    </Button>
  );
}

export default function RedeemReward() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const firstName = searchParams.get('firstName');
  const cafeChainName = searchParams.get('cafeChain');
  const rewardId = searchParams.get('rewardId') ?? '';
  const [isRewardAvailable, setIsRewardAvailable] = useState(false);
  const [checkingRewardAvailability, setCheckingRewardAvailability] = useState(true);

  async function redeemReward(formData: FormData) {
    try {
      const { data, error } = await redeemRewardRequest(formData, rewardId)
      console.log("Redeem Reward response:", data, error)
      if (!error) {
        toast.success(`You have successfully redeemed the reward for ${firstName} at ${cafeChainName}`);
        formRef.current?.reset();
        setIsRewardAvailable(false);
      }
      else {
        toast.error("Failed to redeem reward. Please check the cafe code and try again.");
      }
    } catch (error) {
      console.error("Error redeeming reward. Try again later.", error);
    }
  }


  rewardAvailable(rewardId).then((availability) => {
    setCheckingRewardAvailability(false);
    setIsRewardAvailable(availability);
    console.log("Reward availability checked");
  });

  if (checkingRewardAvailability) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="size-10"/>
      </div>
    )
  }
  if (isRewardAvailable) {
    return (
      <div className="py-16 sm:py-24">
        <div className="items-center mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-balance text-xl font-bold tracking-tight text-card-foreground sm:text-xl lg:text-xl">
              Coffee Sphut Reward Program
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
              Redeem reward for {firstName} at {cafeChainName}.
            </p>
          </div>
 
          <div className="mt-4 flex justify-center">
            <form ref={formRef} action={redeemReward} className="grid grid-cols-1 w-full max-w-md items-center sm:flex-row">
              <Input required type='text' placeholder="Enter cafe code" name='cafeCode'/>
              <RedeemRewardButton />
            </form>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="py-16 sm:py-24">
        <div className="items-center mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-balance text-xl font-bold tracking-tight text-card-foreground sm:text-xl lg:text-xl">
              Coffee Sphut Reward Program
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
              Reward is not available for redemption. Reward has been redeemed. Contact support if you believe this is an error.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
