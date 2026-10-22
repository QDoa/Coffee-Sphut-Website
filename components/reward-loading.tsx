import { PublicPage } from "@/components/public-page";
import { Spinner } from "@/components/ui/spinner";

export function RewardLoading() {
  return (
    <PublicPage
      eyebrow="Coffee Sphut rewards"
      title="A little loyalty goes a long way."
      description="Find the details of your café reward here."
    >
      <div
        role="status"
        className="flex min-h-28 items-center gap-3 text-sm text-muted-foreground"
      >
        <Spinner aria-hidden="true" /> Loading reward details…
      </div>
    </PublicPage>
  );
}
