"use client";

import { useActionState, useState, Suspense } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import { googleLoginAction, loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { GoogleIcon } from "@/components/admin/google-icon";

const URL_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Please sign in with an authorized staff account.",
  forbidden: "You do not have administrative permissions for that page.",
  not_staff:
    "This Google account isn't on the Coffee Sphut staff list. Ask an admin to invite you.",
  oauth_failed: "Google sign-in was cancelled or failed. Please try again.",
};

function GoogleSubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="h-12 w-full"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <GoogleIcon className="mr-2 h-4 w-4" />
      )}
      {pending ? "Connecting to Google…" : "Continue with Google"}
    </Button>
  );
}

function LoginForm(): React.JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin";
  const urlError = searchParams.get("error");

  const [state, formAction, isPending] = useActionState<
    { error?: string } | null,
    FormData
  >(loginAction, null);

  const errorMessage =
    state?.error || (urlError ? (URL_ERROR_MESSAGES[urlError] ?? null) : null);

  return (
    <Card className="gap-7 rounded-3xl border-border bg-card py-8 shadow-none sm:py-10">
      <CardHeader className="gap-3 px-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Coffee Sphut admin
        </p>
        <h1 className="font-serif text-4xl font-normal tracking-tight">
          Welcome back.
        </h1>
        <CardDescription className="text-sm leading-relaxed">
          Sign in to look after your cafés, coffee stories, and community.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-6 sm:px-8">
        {errorMessage && (
          <div
            role="alert"
            id="login-error"
            className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <form action={googleLoginAction}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <GoogleSubmitButton />
        </form>

        <div className="relative">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              or continue with email
            </span>
          </div>
        </div>

        <form
          action={formAction}
          className="space-y-5"
          aria-describedby={errorMessage ? "login-error" : undefined}
        >
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="team@coffeesphut.com"
                required
                className="h-12 rounded-xl pl-11"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/admin/forgot-password"
                className="rounded text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                className="h-12 rounded-xl pl-11 pr-12"
                autoComplete="current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 size-10 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                aria-controls="password"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-12 w-full"
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div
          className="flex justify-center p-8"
          role="status"
          aria-label="Loading sign-in form"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
