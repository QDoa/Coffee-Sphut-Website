"use client";

import { useActionState, Suspense } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Coffee, Lock, Mail, Loader2 } from "lucide-react";
import { googleLoginAction, loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleIcon } from "@/components/admin/google-icon";

const URL_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Please sign in with an authorized staff account.",
  forbidden: "You do not have administrative permissions for that page.",
  not_staff:
    "This Google account isn't on the Coffee Sphut staff list. Ask an admin to invite you.",
  oauth_failed: "Google sign-in was cancelled or failed. Please try again.",
};

function GoogleSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <GoogleIcon className="mr-2 h-4 w-4" />
      )}
      Continue with Google
    </Button>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin";
  const urlError = searchParams.get("error");

  const [state, formAction, isPending] = useActionState<
    { error?: string } | null,
    FormData
  >(loginAction, null);

  const errorMessage =
    state?.error || (urlError ? URL_ERROR_MESSAGES[urlError] ?? null : null);

  return (
    <Card className="shadow-lg border-muted">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Coffee className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Coffee Sphut Admin
        </CardTitle>
        <CardDescription>
          Sign in with your team credentials to access the management portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium"
          >
            {errorMessage}
          </div>
        )}

        <form action={googleLoginAction}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <GoogleSubmitButton />
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              or continue with email
            </span>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="team@coffeesphut.com"
                required
                className="pl-9"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/admin/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="pl-9"
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
