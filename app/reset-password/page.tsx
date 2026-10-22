"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { updatePasswordRequest } from "./server";
import { PublicPage } from "@/components/public-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function handleResetPassword(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error: updateError } = await updatePasswordRequest(password);
      if (updateError) {
        setError(
          updateError instanceof Error
            ? updateError.message
            : String(updateError),
        );
        return;
      }
      toast.success("Your password has been updated.");
      router.replace("/");
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t update your password. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PublicPage
      eyebrow="Account access"
      title="A fresh start."
      description="Choose a new password for your Coffee Sphut account."
    >
      <form onSubmit={handleResetPassword} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "password-error" : undefined}
              className="h-12 rounded-xl pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-0.5 size-11 rounded-lg"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
        {error && (
          <p
            id="password-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="h-12 w-full motion-safe:active:scale-[0.98]"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading && <Spinner aria-hidden="true" />}
          {isLoading ? "Saving password…" : "Save new password"}
        </Button>
      </form>
    </PublicPage>
  );
}
