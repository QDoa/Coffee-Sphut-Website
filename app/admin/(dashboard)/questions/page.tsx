import Link from "next/link";
import { PlusCircle, HelpCircle, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { deleteQuestionAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function OnboardingQuestionsPage() {
  const staff = await requireStaff("editor");
  const supabase = await createClient();

  const { data: questions } = await supabase
    .from("OnboardingQuestion")
    .select("id, question, multi_select, options, priority, active, created_at")
    .order("priority", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboarding Survey Questions</h1>
          <p className="text-sm text-muted-foreground">
            Configure questions shown to users during app onboarding to personalize recommendations.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/questions/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Question
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Priority</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions && questions.length > 0 ? (
              questions.map((q) => {
                const optionCount = Array.isArray(q.options) ? q.options.length : 0;

                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm font-semibold text-muted-foreground">
                      #{q.priority}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/questions/${q.id}`}
                        className="font-medium hover:underline flex items-center gap-2"
                      >
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        {q.question}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {q.multi_select ? "Multiple Choice" : "Single Choice"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {optionCount} {optionCount === 1 ? "option" : "options"}
                    </TableCell>
                    <TableCell>
                      {q.active ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
                          <Check className="h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground">
                          <X className="h-3 w-3" /> Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/questions/${q.id}`}>Edit</Link>
                        </Button>
                        {staff.role === "admin" && (
                          <DeleteButton
                            action={async () => {
                              "use server";
                              await deleteQuestionAction(q.id);
                            }}
                            title={`Delete question "${q.question}"?`}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  No onboarding questions found. Click &quot;New Question&quot; to add one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
