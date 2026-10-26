"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";

interface CafeSaveError {
  error: string;
  cafeId?: string;
}

interface CafeFormProps {
  action: (formData: FormData) => Promise<CafeSaveError | void>;
  children: ReactNode;
}

export function CafeForm({
  action,
  children,
}: CafeFormProps): React.JSX.Element {
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [state, formAction, pending] = useActionState(
    async (
      previous: CafeSaveError | null,
      formData: FormData,
    ): Promise<CafeSaveError | null> => {
      const result = await action(formData);
      return result
        ? { ...result, cafeId: result.cafeId ?? previous?.cafeId }
        : null;
    },
    null,
  );
  useEffect(() => {
    if (state) errorRef.current?.focus();
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    // React resets uncontrolled fields after a form action resolves, even on
    // validation errors. Dispatch manually so failed saves retain the edits.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      aria-busy={pending}
      aria-describedby={state ? "cafe-save-error" : undefined}
    >
      {state?.cafeId && (
        <input type="hidden" name="persisted_cafe_id" value={state.cafeId} />
      )}
      {state && (
        <p
          ref={errorRef}
          tabIndex={-1}
          id="cafe-save-error"
          role="alert"
          className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive outline-none"
        >
          {state.error}
        </p>
      )}
      <fieldset disabled={pending} className="min-w-0 space-y-6">
        {children}
      </fieldset>
    </form>
  );
}
