"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface QuestionFormProps {
  question?: {
    id: string;
    question: string;
    multi_select: boolean;
    options: string[];
    priority: number;
    active: boolean;
  } | null;
  action: (formData: FormData) => Promise<any>;
}

export function QuestionForm({ question, action }: QuestionFormProps) {
  const initialOptions: string[] = Array.isArray(question?.options)
    ? question.options
    : [];

  const [options, setOptions] = useState<string[]>(
    initialOptions.length > 0 ? initialOptions : ["Option 1", "Option 2"]
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addOption = () => {
    setOptions([...options, `Option ${options.length + 1}`]);
  };

  const removeOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, val: string) => {
    const updated = [...options];
    updated[idx] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const cleanOptions = options.map((s) => s.trim()).filter((s) => s.length > 0);
    formData.set("options", JSON.stringify(cleanOptions));

    try {
      const res = await action(formData);
      if (res?.error) {
        setError(res.error);
        setSubmitting(false);
      }
    } catch (err: any) {
      if (err?.message !== "NEXT_REDIRECT") {
        setError(err.message || "Failed to save question");
        setSubmitting(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm rounded bg-destructive/15 text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Question Configuration</CardTitle>
          <CardDescription>Survey question text, selection mode, and priority.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question">Question Text *</Label>
            <Input
              id="question"
              name="question"
              defaultValue={question?.question || ""}
              placeholder="What type of roast do you prefer?"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Display Order Priority</Label>
              <Input
                id="priority"
                name="priority"
                type="number"
                defaultValue={question?.priority ?? 0}
              />
              <p className="text-xs text-muted-foreground">Lower numbers show first.</p>
            </div>

            <div className="space-y-4 pt-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="multi_select"
                  name="multi_select"
                  defaultChecked={question?.multi_select || false}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="multi_select" className="cursor-pointer">
                  Allow multiple choices (Checkboxes)
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  defaultChecked={question ? question.active : true}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Active (Visible in onboarding flow)
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Choices / Options</CardTitle>
            <CardDescription>Available selectable choices for the user.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus className="h-4 w-4 mr-1" /> Add Choice
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-6">#{idx + 1}</span>
              <Input
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder="Option label"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeOption(idx)}
                disabled={options.length <= 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button asChild variant="outline">
          <Link href="/admin/questions">Cancel</Link>
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save Question"}
        </Button>
      </div>
    </form>
  );
}
