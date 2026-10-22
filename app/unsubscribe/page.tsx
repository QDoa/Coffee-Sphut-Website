"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { sendUnsubcribeRequest } from "@/app/unsubscribe/server";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PublicPage } from "@/components/public-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Unsubscribe() {
  const formRef = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function unsubscribe(formData: FormData): Promise<void> {
    setFeedback(null);
    try {
      const { error } = await sendUnsubcribeRequest(formData);
      if (error) throw error;
      const text = "You have been removed from our waiting list.";
      setFeedback({ type: "success", text });
      toast.success(text);
      formRef.current?.reset();
    } catch {
      const text = "We couldn’t unsubscribe you. Please try again.";
      setFeedback({ type: "error", text });
      toast.error(text);
    }
  }

  return (
    <PublicPage
      eyebrow="Email preferences"
      title="A little less in your inbox."
      description="Confirm your email address to stop receiving Coffee Sphut waiting-list updates."
    >
      <form ref={formRef} action={unsubscribe} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="unsubscribe-email">Email address</Label>
          <Input
            id="unsubscribe-email"
            required
            type="email"
            autoComplete="email"
            name="email"
            placeholder="you@example.com"
            className="h-12 rounded-xl"
          />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This removes your email from the waiting list. Your Coffee Sphut
          account is unaffected.
        </p>
        {feedback && (
          <p
            role={feedback.type === "error" ? "alert" : "status"}
            className={
              feedback.type === "error"
                ? "text-sm text-destructive"
                : "text-sm text-foreground"
            }
          >
            {feedback.text}
          </p>
        )}
        <FormSubmitButton pendingLabel="Unsubscribing…">
          Unsubscribe
        </FormSubmitButton>
      </form>
    </PublicPage>
  );
}
