"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { sendDeleteAccountRequest } from "@/app/delete-account/server";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PublicPage } from "@/components/public-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DeleteAccountPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleDeleteAccount(formData: FormData): Promise<void> {
    setFeedback(null);
    try {
      const result = await sendDeleteAccountRequest(formData);
      if (result.error) throw result.error;
      const text = "Your account deletion request has been submitted.";
      setFeedback({ type: "success", text });
      toast.success(text);
      formRef.current?.reset();
    } catch {
      const text = "We couldn’t submit your request. Please try again.";
      setFeedback({ type: "error", text });
      toast.error(text);
    }
  }

  return (
    <PublicPage
      eyebrow="Your account"
      title="Request account deletion."
      description="Use the email address associated with your Coffee Sphut account to submit a deletion request."
    >
      <p className="mb-6 border-l-2 border-destructive pl-4 text-sm leading-relaxed text-muted-foreground">
        Deleting your account is permanent and cannot be undone.
      </p>
      <form ref={formRef} action={handleDeleteAccount} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="delete-email">Account email</Label>
          <Input
            id="delete-email"
            required
            type="email"
            autoComplete="email"
            name="email"
            placeholder="you@example.com"
            className="h-12 rounded-xl"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              required
              type="text"
              autoComplete="given-name"
              name="first_name"
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              required
              type="text"
              autoComplete="family-name"
              name="last_name"
              className="h-12 rounded-xl"
            />
          </div>
        </div>
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
        <FormSubmitButton
          variant="destructive"
          pendingLabel="Submitting request…"
        >
          Request account deletion
        </FormSubmitButton>
      </form>
    </PublicPage>
  );
}
