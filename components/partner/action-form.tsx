"use client";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { commandAction, type PortalActionState } from "@/app/partner/actions";
import { Button } from "@/components/ui/button";
interface Props {
  operation?: string;
  context?: Record<string, unknown>;
  children: ReactNode;
  label: string;
  secondaryLabel?: string;
  action?: (
    previous: PortalActionState,
    form: FormData,
  ) => Promise<PortalActionState>;
}
export function ActionForm({
  operation,
  context = {},
  children,
  label,
  secondaryLabel,
  action = commandAction,
}: Props) {
  const [state, dispatch, pending] = useActionState(action, {});
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error || state.message) feedback.current?.focus();
  }, [state]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    if (submitter?.dataset.operation)
      data.set("operation", submitter.dataset.operation);
    startTransition(() => dispatch(data));
  }
  return (
    <form
      action={dispatch}
      onSubmit={submit}
      aria-busy={pending}
      className="space-y-4"
    >
      <input type="hidden" name="operation" value={operation || ""} />
      <input
        type="hidden"
        name="context"
        value={JSON.stringify({
          ...context,
          ...(state.savedRevision ? { revision: state.savedRevision } : {}),
          ...(state.savedId ? { id: state.savedId } : {}),
          request_id: state.nextRequestId || context.request_id,
        })}
      />
      <fieldset
        disabled={
          pending ||
          (operation === "submit_change" &&
            Boolean(state.message?.startsWith("Submitted")))
        }
        className="min-w-0 space-y-4"
      >
        {children}
        <Button type="submit" className="min-h-11">
          {pending ? "Saving…" : label}
        </Button>
        {secondaryLabel && (
          <Button
            type="submit"
            variant="outline"
            className="ml-3 min-h-11"
            data-operation="save_change"
          >
            {secondaryLabel}
          </Button>
        )}
      </fieldset>
      {(state.error || state.message) && (
        <p
          ref={feedback}
          tabIndex={-1}
          role={state.error ? "alert" : "status"}
          className={
            state.error
              ? "rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
              : "rounded-xl bg-primary/10 p-4 text-sm"
          }
        >
          {state.error || state.message}
        </p>
      )}
      {state.inviteLink && (
        <div className="break-all rounded-xl border p-4 text-sm">
          <p className="font-medium">
            Invitation link — share with the invited manager
          </p>
          <a className="underline" href={state.inviteLink}>
            {state.inviteLink}
          </a>
          <p className="mt-2 text-muted-foreground">
            Only the invited email can accept. Expires in seven days.
          </p>
        </div>
      )}
    </form>
  );
}
