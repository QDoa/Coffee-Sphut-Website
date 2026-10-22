"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface FormSubmitButtonProps extends ComponentProps<typeof Button> {
  pendingLabel: string;
}

export function FormSubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...props}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={cn("h-12 w-full motion-safe:active:scale-[0.98]", className)}
    >
      {pending && <Spinner aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
