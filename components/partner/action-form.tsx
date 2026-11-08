"use client";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Copy } from "lucide-react";
import { commandAction, type PortalActionState } from "@/app/partner/actions";
import { Button } from "@/components/ui/button";
interface Props {
  operation?: string;
  context?: Record<string, unknown>;
  children: ReactNode;
  label: string;
  secondaryLabel?: string;
  submitDisabled?: boolean;
  action?: (
    previous: PortalActionState,
    form: FormData,
  ) => Promise<PortalActionState>;
}

function InvitationLink({ href }: { href: string }) {
  const [copyMessage, setCopyMessage] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
      setCopyMessage("Invitation link copied.");
    } catch {
      setCopyMessage("Use the link’s context menu to copy its address.");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-background p-4 text-sm">
      <div className="space-y-1">
        <p className="font-medium">Invitation link ready</p>
        <p className="text-xs text-muted-foreground">
          Share this link with the invited manager. It expires in seven days.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="button" variant="outline" className="min-h-11" onClick={copyLink}>
          <Copy aria-hidden="true" />
          Copy invitation link
        </Button>
        <a href={href} className="py-2 text-primary underline underline-offset-4">
          Open invitation link
        </a>
      </div>
      {copyMessage && <p role="status" className="text-xs">{copyMessage}</p>}
    </div>
  );
}
export function ActionForm({
  operation,
  context = {},
  children,
  label,
  secondaryLabel,
  submitDisabled = false,
  action = commandAction,
}: Props) {
  const [state, dispatch, pending] = useActionState(action, {});
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error || state.message) feedback.current?.focus();
  }, [state]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitDisabled) return;
    if (event.currentTarget.querySelector('[data-upload-pending="true"]'))
      return;
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
        <Button type="submit" className="min-h-11" disabled={submitDisabled}>
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
      {state.inviteLink && <InvitationLink key={state.inviteLink} href={state.inviteLink} />}
    </form>
  );
}
