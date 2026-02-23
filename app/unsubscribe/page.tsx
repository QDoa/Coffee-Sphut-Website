"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Form from 'next/form'
import { Input } from "@/components/ui/input"
import { sendUnsubcribeRequest } from "@/app/unsubscribe/server";

export default function Unsubscribe() {
  const [ completed, setCompleted ] = useState(false)

  async function unsubcribe(formData: FormData) {
    try {
      const { data, error } = await sendUnsubcribeRequest(formData)
      console.log("Unsubscribe response:", data, error)
      if (!error) {
        setCompleted(true);
      }
    } catch (error) {
      console.error("Error sending unsubscribe request:", error);
    }
  }

  return completed ? (
    <div className="py-16 sm:py-24">
      <div className="items-center mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-balance text-xl font-bold tracking-tight text-card-foreground sm:text-xl lg:text-xl">
            Your email has been successfully unsubscribed. You will no longer receive updates from us.
          </h2>
        </div>
      </div>
    </div>
  ) : (
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
          <Form action={unsubcribe} className="grid grid-cols-1 w-full max-w-md items-center sm:flex-row">
            <Input required type='email' placeholder="Enter your email" name='email'/>
            <Button type='submit' size="lg" className="mt-4 text-base" >
              Unsubscribe
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
