"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Coffee, Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { forgotPasswordAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState<
    { error?: string; success?: boolean } | null,
    FormData
  >(forgotPasswordAction, null);

  return (
    <Card className="shadow-lg border-muted">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Coffee className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Reset Password
        </CardTitle>
        <CardDescription>
          Enter your team email to receive a secure password reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.success ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              If an account with that email exists, a password reset link has been
              sent. Please check your inbox.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Sign In
              </Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
                {state.error}
              </div>
            )}

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

            <Button type="submit" className="w-full" disabled={isPending}>
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
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground underline"
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
