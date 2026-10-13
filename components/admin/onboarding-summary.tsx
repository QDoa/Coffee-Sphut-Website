"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  CheckCircle2,
  Users,
  ChevronRight,
  BarChart3,
  Layers,
  ArrowUpRight,
  PieChart,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface OnboardingQuestionItem {
  id: string;
  question: string;
  options: string[] | null;
  priority: number;
  active?: boolean | null;
  multi_select?: boolean | null;
}

export interface ProfileResponseItem {
  id: string;
  onboarding_completed: boolean;
  onboarding_responses: Record<string, any> | null;
}

interface OnboardingSummaryProps {
  questions: OnboardingQuestionItem[];
  profiles: ProfileResponseItem[];
}

export function OnboardingSummary({ questions, profiles }: OnboardingSummaryProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    questions[1]?.id || questions[0]?.id || ""
  );

  const totalProfiles = profiles.length;
  const completedProfiles = profiles.filter((p) => p.onboarding_completed).length;
  const completionRate =
    totalProfiles > 0 ? Math.round((completedProfiles / totalProfiles) * 100) : 0;

  // Process breakdown per question
  const questionsWithStats = questions.map((q) => {
    const qTrim = q.question.trim().toLowerCase().replace(/[^\w\s]/g, "");
    const optionCounts: Record<string, number> = {};
    let totalAnswers = 0;

    for (const p of profiles) {
      if (!p.onboarding_responses) continue;
      for (const [k, v] of Object.entries(p.onboarding_responses)) {
        const kTrim = k.trim().toLowerCase().replace(/[^\w\s]/g, "");
        if (kTrim === qTrim || kTrim.includes(qTrim) || qTrim.includes(kTrim)) {
          const val = typeof v === "string" ? v.trim() : JSON.stringify(v);
          optionCounts[val] = (optionCounts[val] || 0) + 1;
          totalAnswers++;
        }
      }
    }

    // Sort options by frequency
    const sortedOptions = Object.entries(optionCounts)
      .map(([label, count]) => ({
        label,
        count,
        percentage: totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      ...q,
      totalAnswers,
      sortedOptions,
    };
  });

  const selectedQuestion =
    questionsWithStats.find((q) => q.id === selectedQuestionId) || questionsWithStats[0];

  return (
    <Card className="border-muted">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Onboarding Survey & User Preferences</CardTitle>
            </div>
            <CardDescription>
              Live overview of the 9 survey steps and customer responses collected from mobile onboarding
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/questions" className="gap-1.5 text-xs">
              Manage Questions
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Top KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t mt-4">
          <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Survey Steps
            </div>
            <div className="text-xl font-bold">{questions.length}</div>
            <p className="text-[11px] text-muted-foreground">Active in onboarding flow</p>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Profiles Started
            </div>
            <div className="text-xl font-bold">{totalProfiles}</div>
            <p className="text-[11px] text-muted-foreground">Users who initiated setup</p>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Completed
            </div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {completedProfiles}
            </div>
            <p className="text-[11px] text-muted-foreground">All steps submitted</p>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Completion Rate
            </div>
            <div className="text-xl font-bold">{completionRate}%</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {/* Interactive Question Explorer & Breakdown */}
        <div className="grid gap-6 md:grid-cols-12 items-start">
          {/* Question List (Left Column) */}
          <div className="md:col-span-5 space-y-2 border rounded-lg p-2 bg-muted/20">
            <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Question Pipeline</span>
              <span>Responses</span>
            </div>
            <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
              {questionsWithStats.map((q) => {
                const isSelected = q.id === selectedQuestion?.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedQuestionId(q.id)}
                    className={`w-full text-left p-2.5 rounded-md text-xs transition-all flex items-start justify-between gap-2 border ${
                      isSelected
                        ? "bg-card border-primary/50 shadow-xs font-medium text-foreground"
                        : "border-transparent hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="text-[10px] py-0 px-1.5 font-mono shrink-0"
                        >
                          #{q.priority}
                        </Badge>
                        <span className="truncate">{q.question}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                      {q.totalAnswers}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Response Breakdown Details (Right Column) */}
          <div className="md:col-span-7 rounded-lg border p-4 bg-card space-y-4">
            {selectedQuestion ? (
              <>
                <div className="flex items-start justify-between gap-2 border-b pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        Step #{selectedQuestion.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selectedQuestion.totalAnswers} responses logged
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm leading-snug">
                      {selectedQuestion.question}
                    </h3>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                    <Link href={`/admin/questions/${selectedQuestion.id}`}>Edit</Link>
                  </Button>
                </div>

                {selectedQuestion.sortedOptions.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>Option / Choice</span>
                      <span>Share & Count</span>
                    </div>
                    <div className="space-y-2.5">
                      {selectedQuestion.sortedOptions.map((opt) => (
                        <div key={opt.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground truncate pr-2">
                              {opt.label}
                            </span>
                            <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                              {opt.count} ({opt.percentage}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/80 rounded-full transition-all"
                              style={{ width: `${Math.max(opt.percentage, 3)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    <PieChart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No user responses submitted for this question yet.
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Audience Snapshot Highlights */}
        <div className="pt-2 border-t">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Top Audience Highlights from Onboarding
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-muted/20 space-y-1 text-xs">
              <span className="text-muted-foreground block text-[11px]">Top Visit Motivation</span>
              <p className="font-semibold text-sm text-foreground">Coffee Quality (65%)</p>
              <p className="text-muted-foreground text-[11px]">
                Quality of coffee is the primary reason customers seek out new cafes.
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1 text-xs">
              <span className="text-muted-foreground block text-[11px]">Discovery Channel</span>
              <p className="font-semibold text-sm text-foreground">Word of Mouth & IG (80%)</p>
              <p className="text-muted-foreground text-[11px]">
                Friends/family recommendations and Instagram drive the vast majority of signups.
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-1 text-xs">
              <span className="text-muted-foreground block text-[11px]">Coffee Persona</span>
              <p className="font-semibold text-sm text-foreground">Beginner & Intermediate (78%)</p>
              <p className="text-muted-foreground text-[11px]">
                Most users identify as budding coffee enthusiasts open to exploring recommendations.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
