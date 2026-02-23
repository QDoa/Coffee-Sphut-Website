"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"
import { sendUnsubcribeRequest } from "@/app/unsubscribe/server";

function UnsubscribeButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button 
      type='submit' 
      size="lg" 
      className="mt-4 text-base"
      disabled={pending}
    >
      {pending ? "Unsubscribing..." : "Unsubscribe"}
    </Button>
  );
}

export default function Unsubscribe() {
  const formRef = useRef<HTMLFormElement>(null);

  async function unsubscribe(formData: FormData) {
    try {
      const { data, error } = await sendUnsubcribeRequest(formData)
      console.log("Unsubscribe response:", data, error)
      if (!error) {
        toast.success("You have successfully been removed from our waiting list");
        formRef.current?.reset();
      }
    } catch (error) {
      console.error("Error sending unsubscribe request:", error);
    }
  }

  return (
    <div className="py-16 sm:py-24">
      <div className="items-center mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-balance text-xl font-bold tracking-tight text-card-foreground sm:text-xl lg:text-xl">
            Do you want to unsubscribe?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
            Confirm your email address to unsubscribe.
          </p>
        </div>

        <div className="mt-4 flex justify-center">
          <form ref={formRef} action={unsubscribe} className="grid grid-cols-1 w-full max-w-md items-center sm:flex-row">
            <Input required type='email' placeholder="Enter your email" name='email'/>
            <UnsubscribeButton />
          </form>
        </div>
      </div>
    </div>
  );
}
