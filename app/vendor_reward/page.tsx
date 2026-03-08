"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"
import { addRewardTransaction } from "@/app/vendor_reward/server";

import { useSearchParams } from 'next/navigation'

function PunchRewardCardButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button 
      type='submit' 
      size="lg" 
      className="mt-4 text-base"
      disabled={pending}
    >
      {pending ? "Punching card..." : "Punch reward card"}
    </Button>
  );
}

export default function VendorReward() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const frirstName = searchParams.get('firstName');
  const userId = searchParams.get('userId');

  async function punchRewardCard(formData: FormData) {
    try {
      const { data, error } = await addRewardTransaction(formData, userId)
      console.log("Punch reward card response:", data, error)
      if (!error) {
        toast.success("You have successfully punched {firstName} reward card");
        formRef.current?.reset();
      }
      else {
        toast.error("Failed to punch reward card.");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  return (
    <div className="py-16 sm:py-24">
      <div className="items-center mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-balance text-xl font-bold tracking-tight text-card-foreground sm:text-xl lg:text-xl">
            Coffee Sphut Reward Program
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
            Punch {frirstName}'s reward card by entering your cafe code.
          </p>
        </div>

        <div className="mt-4 flex justify-center">
          <form ref={formRef} action={punchRewardCard} className="grid grid-cols-1 w-full max-w-md items-center sm:flex-row">
            <Input required type='text' placeholder="Enter cafe code" name='cafeCode'/>
            <PunchRewardCardButton />
          </form>
        </div>
      </div>
    </div>
  );
}
