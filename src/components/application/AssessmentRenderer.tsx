/**
 * AssessmentRenderer
 * ------------------
 * Presentational component that renders the sections produced by the
 * configuration-driven assessment engine. It is intentionally decoupled
 * from scoring / submission — the parent owns the answer bag.
 *
 * Answers are stored under keys shaped like:
 *   engine.household.<qid>
 *   engine.per_student.<qid>::s<studentIndex>
 *
 * This keeps engine answers namespaced separately from the legacy
 * randomized scoring answers so nothing about existing scoring changes.
 */

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import type { StudentEntry } from "@/context/ApplicationContext";
import { buildAssessmentSections } from "@/lib/assessment/engine";

interface Props {
  students: StudentEntry[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export function AssessmentRenderer({ students, value, onChange }: Props) {
  const sections = useMemo(() => buildAssessmentSections(students), [students]);

  if (sections.length === 0) return null;

  const setAnswer = (key: string, v: string) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-accent/5 border-accent/20">
        <div className="flex gap-3">
          <Users className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Tailored Assessment</p>
            <p className="text-sm text-muted-foreground">
              The questions below are generated from your application. Household
              questions are asked once; student-specific questions are asked for
              each learner on this application.
            </p>
          </div>
        </div>
      </Card>

      {sections.map((section) => (
        <div key={section.key} className="space-y-3">
          <div className="border-b pb-2">
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            {section.subtitle && (
              <p className="text-xs text-muted-foreground">{section.subtitle}</p>
            )}
          </div>

          {section.questions.map((q) => {
            const hasOptions = Array.isArray(q.options) && q.options.length > 0;
            const current = value[q.storageKey] ?? "";
            return (
              <div key={q.storageKey} className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {q.displayText}
                  {q.required === false && (
                    <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                  )}
                </label>
                {hasOptions ? (
                  <Select value={current} onValueChange={(v) => setAnswer(q.storageKey, v)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {q.options!.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={current}
                    onChange={(e) => setAnswer(q.storageKey, e.target.value)}
                    className="bg-background"
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
