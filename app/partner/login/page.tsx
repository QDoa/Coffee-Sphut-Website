import { ActionForm } from "@/components/partner/action-form";
import { Panel, Field } from "@/components/partner/workspace";
import { signInAction, recoverAction } from "../actions";
export default async function PartnerLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="mx-auto max-w-lg space-y-8 px-5 py-16">
      <div>
        <p className="text-xs tracking-widest text-muted-foreground uppercase">
          Coffee Sphut partners
        </p>
        <h1 className="mt-3 font-serif text-4xl">Welcome back.</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Sign in to look after your cafés. Access is granted by your partner
          Owner or Coffee Sphut.
        </p>
      </div>
      {query.error && (
        <p role="alert">
          The sign-in link could not be completed. Please sign in or request
          another recovery link.
        </p>
      )}
      <Panel title="Partner sign-in">
        <ActionForm action={signInAction} label="Sign in">
          <input type="hidden" name="next" value={query.next || "/partner"} />
          <Field name="email" label="Email" type="email" required />
          <Field name="password" label="Password" type="password" required />
        </ActionForm>
      </Panel>
      <Panel title="Recover your account">
        <ActionForm action={recoverAction} label="Send recovery link">
          <Field name="email" label="Recovery email" type="email" required />
        </ActionForm>
      </Panel>
    </main>
  );
}
