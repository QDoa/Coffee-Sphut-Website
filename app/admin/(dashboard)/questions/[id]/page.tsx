import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { saveQuestionAction } from "../actions";
import { Button } from "@/components/ui/button";
import { QuestionForm } from "@/components/admin/question-form";
import { HistoryPanel } from "@/components/admin/history-panel";

interface QuestionEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestionEditPage({ params }: QuestionEditPageProps) {
  await requireStaff("editor");
  const { id } = await params;
  const isNew = id === "new";

  const supabase = await createClient();
  let question = null;

  if (!isNew) {
    const { data } = await supabase
      .from("OnboardingQuestion")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!data) notFound();
    question = data;
  }

  const formAction = saveQuestionAction.bind(null, isNew ? null : id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/questions">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Questions
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? "Create Survey Question" : "Edit Survey Question"}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuestionForm question={question} action={formAction} />
        </div>

        <div className="space-y-6">
          {!isNew && <HistoryPanel tableName="OnboardingQuestion" recordId={id} />}
        </div>
      </div>
    </div>
  );
}
