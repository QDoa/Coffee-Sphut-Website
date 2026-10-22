"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { addRewardTransaction } from "@/app/vendor_reward/server";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PublicPage } from "@/components/public-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VendorRewardClient() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const firstName = searchParams.get("firstName");
  const userId = searchParams.get("userId") ?? "";
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const validLink = Boolean(firstName && userId);

  async function punchRewardCard(formData: FormData): Promise<void> {
    setFeedback(null);
    try {
      const { error } = await addRewardTransaction(formData, userId);
      if (error) throw error;
      const text = `A stamp has been added to ${firstName}’s reward card.`;
      setFeedback({ type: "success", text });
      toast.success(text);
      formRef.current?.reset();
    } catch {
      const text =
        "We couldn’t add a stamp. Check your café code and try again.";
      setFeedback({ type: "error", text });
      toast.error(text);
    }
  }

  return (
    <PublicPage
      eyebrow="For café teams"
      title="Another cup. Another stamp."
      description={
        validLink
          ? `Add a visit to ${firstName}’s digital reward card using your café code.`
          : "Open a customer’s reward link to add a stamp to their card."
      }
    >
      {validLink ? (
        <form ref={formRef} action={punchRewardCard} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="stamp-cafe-code">Café code</Label>
            <Input
              id="stamp-cafe-code"
              required
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Enter your café code"
              name="cafeCode"
              className="h-12 rounded-xl"
            />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Use the code for the café where this customer is visiting.
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
          <FormSubmitButton pendingLabel="Adding stamp…">
            Add a coffee stamp
          </FormSubmitButton>
        </form>
      ) : (
        <div role="alert">
          <h2 className="font-serif text-2xl tracking-tight">
            This link is incomplete.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Please ask the customer to open their reward card in the app and
            share the link again.
          </p>
        </div>
      )}
    </PublicPage>
  );
}
