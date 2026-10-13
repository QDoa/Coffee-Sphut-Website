import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { saveChainAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HistoryPanel } from "@/components/admin/history-panel";

interface ChainEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChainEditPage({ params }: ChainEditPageProps) {
  await requireStaff("editor");
  const { id } = await params;
  const isNew = id === "new";

  let chain = null;
  if (!isNew) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("Chains")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data) notFound();
    chain = data;
  }

  const formAction = async (formData: FormData) => {
    "use server";
    const res = await saveChainAction(isNew ? null : id, formData);
    if (res?.error) throw new Error(res.error);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/chains">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Chains
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isNew ? "New Chain Brand" : `Edit Chain: ${chain?.name}`}</CardTitle>
          <CardDescription>
            Configure brand name and loyalty card stamp threshold.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Chain Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={chain?.name || ""}
                required
                placeholder="e.g. Monogram Coffee"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loyalty_threshold">Loyalty Threshold (Punches for Reward)</Label>
              <Input
                id="loyalty_threshold"
                name="loyalty_threshold"
                type="number"
                min={1}
                defaultValue={chain?.loyalty_threshold ?? 10}
                required
              />
              <p className="text-xs text-muted-foreground">
                Number of punches required before a reward is automatically issued. Individual cafes can override this if needed.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button asChild variant="outline">
                <Link href="/admin/chains">Cancel</Link>
              </Button>
              <Button type="submit">Save Chain</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!isNew && <HistoryPanel tableName="Chains" recordId={id} />}
    </div>
  );
}
