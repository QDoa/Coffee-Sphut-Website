"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { forgotPasswordAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export default function ForgotPasswordPage(): React.JSX.Element {
  const [state, formAction, isPending] = useActionState<
    { error?: string; success?: boolean } | null,
    FormData
  >(forgotPasswordAction, null);

  return (
    <Card className="gap-7 rounded-3xl border-border bg-card py-8 shadow-none sm:py-10">
      <CardHeader className="gap-3 px-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Coffee Sphut admin
        </p>
        <h1 className="font-serif text-4xl font-normal tracking-tight">
          Reset your password.
        </h1>
        <CardDescription className="text-sm leading-relaxed">
          Enter your team email to receive a secure password reset link.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 sm:px-8">
        {state?.success ? (
          <div className="space-y-5 text-center" role="status">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              If an account with that email exists, a password reset link has
              been sent. Please check your inbox.
            </p>
            <Button asChild variant="outline" className="h-12 w-full">
              <Link href="/admin/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Sign In
              </Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-5">
            {state?.error && (
              <div
                role="alert"
                id="reset-error"
                className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {state.error}
              </div>
            )}

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
                  aria-describedby={state?.error ? "reset-error" : undefined}
                />
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
                  Sending Link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/admin/login"
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
