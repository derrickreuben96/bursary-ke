import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";

type BankRow = {
  id: string;
  code: string;
  category: string;
  applies_to: string;
  text_en: string;
  options: Array<{ v: string; label: string }> | null;
  weight_high_school: number;
  weight_higher_ed: number;
  is_active: boolean;
};

interface Props {
  pipeline: "basic_education" | "higher_education" | "mixed";
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

/**
 * DynamicPovertyBank
 * -------------------
 * Renders active questions from `public.poverty_question_bank` and stores answers
 * under keys of the form `bank.<code>` on the parent poverty answers object.
 * This surfaces bank questions to applicants without replacing legacy static scoring.
 */
export function DynamicPovertyBank({ pipeline, value, onChange }: Props) {
  const [rows, setRows] = useState<BankRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("poverty_question_bank")
        .select("id,code,category,applies_to,text_en,options,weight_high_school,weight_higher_ed,is_active")
        .eq("is_active", true);
      if (!cancelled) {
        if (!error && data) {
          setRows(data as unknown as BankRow[]);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        if (r.applies_to === "all") return true;
        if (pipeline === "higher_education") return r.applies_to === "higher_education";
        if (pipeline === "basic_education") return r.applies_to === "basic_education";
        return true; // mixed → show everything
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [rows, pipeline]);

  const setAnswer = (code: string, v: string) => {
    onChange({ ...value, [`bank.${code}`]: v });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading additional questions…
      </div>
    );
  }

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-accent/5 border-accent/20">
        <div className="flex gap-3">
          <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Additional Assessment Questions</p>
            <p className="text-sm text-muted-foreground">
              These questions help our fairness engine understand your household better.
              Answers are optional but strengthen your application.
            </p>
          </div>
        </div>
      </Card>

      {filtered.map((q) => {
        const key = `bank.${q.code}`;
        const current = value[key] ?? "";
        const hasOptions = Array.isArray(q.options) && q.options.length > 0;
        return (
          <div key={q.id} className="space-y-2">
            <label className="text-sm font-medium text-foreground">{q.text_en}</label>
            {hasOptions ? (
              <Select value={current} onValueChange={(v) => setAnswer(q.code, v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {q.options!.map((opt) => (
                    <SelectItem key={opt.v} value={opt.v}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                inputMode="numeric"
                placeholder="Enter a number"
                value={current}
                onChange={(e) => setAnswer(q.code, e.target.value.replace(/[^0-9.]/g, ""))}
                className="bg-background"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
