import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, ClipboardCheck, Lock, Shuffle } from "lucide-react";
import { useApplication } from "@/context/ApplicationContext";
import { getRandomizedQuestions, calculatePovertyScoreFromAnswers, type PovertyQuestion } from "@/lib/povertyQuestions";
import { DynamicPovertyBank } from "./DynamicPovertyBank";
import { AssessmentRenderer } from "./AssessmentRenderer";

interface PovertyQuestionnaireProps {
  onNext: () => void;
  onBack: () => void;
}

export function PovertyQuestionnaire({ onNext, onBack }: PovertyQuestionnaireProps) {
  const { data, updateData } = useApplication();

  // Generate randomized questions once per session
  const questions = useMemo(() => getRandomizedQuestions(10), []);

  // How many students are on this application (1-3). Per-student questions
  // expand into one field per student.
  const studentList = (data.students && data.students.length > 0) ? data.students : [];
  const studentCount = Math.max(1, studentList.length);
  // Personalized label: "<Student Name> · <Institution>" so per-student
  // assessment questions always identify the specific learner being assessed.
  const studentLabel = (idx: number) => {
    const s = studentList[idx];
    const name = s?.studentName?.trim() || `Student ${idx + 1}`;
    const inst = s?.institution?.trim();
    return inst ? `${name} · ${inst}` : name;
  };

  // Pipeline: higher_education if any student is uni/college/tvet; basic_education if only secondary; mixed otherwise
  const pipeline = useMemo<"basic_education" | "higher_education" | "mixed">(() => {
    const cats = studentList.map((s) => (s as { educationCategory?: string }).educationCategory || s?.studentType);
    const hasHigher = cats.some((c) => c === "university" || c === "college" || c === "tvet" || c === "higher_education");
    const hasBasic = cats.some((c) => c === "secondary" || c === "high_school");
    if (hasHigher && !hasBasic) return "higher_education";
    if (hasBasic && !hasHigher) return "basic_education";
    return "mixed";
  }, [studentList]);

  // Preserve previously entered bank answers when reopening this step
  const prevPq = (data.povertyQuestionnaire || {}) as Record<string, unknown>;
  const initialBank: Record<string, string> = {};
  Object.entries(prevPq).forEach(([k, v]) => {
    if (k.startsWith("bank.") && typeof v === "string") initialBank[k] = v;
  });
  const [bankAnswers, setBankAnswers] = useState<Record<string, string>>(initialBank);

  // Build dynamic schema based on questions (per-student questions get one
  // field per student, e.g. `disability_student::s0`).
  const dynamicSchema = useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};
    questions.forEach((q) => {
      if (q.perStudent && studentCount > 1) {
        for (let i = 0; i < studentCount; i++) {
          schemaFields[`${q.id}::s${i}`] = z.string().min(1, "Please select an option");
        }
      } else {
        schemaFields[q.id] = z.string().min(1, "Please select an option");
      }
    });
    schemaFields.additionalCircumstances = z.string().max(500).optional();
    return z.object(schemaFields);
  }, [questions, studentCount]);

  type DynamicFormData = z.infer<typeof dynamicSchema>;

  const defaultValues = useMemo(() => {
    const values: Record<string, string> = {};
    const prev = (data.povertyQuestionnaire || {}) as Record<string, unknown>;
    questions.forEach((q) => {
      if (q.perStudent && studentCount > 1) {
        for (let i = 0; i < studentCount; i++) {
          const key = `${q.id}::s${i}`;
          values[key] = (prev[key] as string) || "";
        }
      } else {
        values[q.id] = (prev[q.id] as string) || "";
      }
    });
    values.additionalCircumstances = (prev.additionalCircumstances as string) || "";
    return values;
  }, [questions, data.povertyQuestionnaire, studentCount]);

  const form = useForm<DynamicFormData>({
    resolver: zodResolver(dynamicSchema),
    defaultValues,
  });

  const onSubmit = (formData: DynamicFormData) => {
    const { percentage } = calculatePovertyScoreFromAnswers(
      formData as Record<string, string>,
      questions,
      studentCount,
    );

    updateData({
      povertyQuestionnaire: {
        ...formData,
        ...bankAnswers,
        householdIncome: percentage,
        numberOfDependents: 4,
        housingType: "Other" as const,
        accessToUtilities: { electricity: true, water: true, internet: false },
        parentalEmployment: "One Employed" as const,
        otherChildrenInSchool: 2,
        receivesOtherAid: false,
        _rawAnswers: { ...formData, ...bankAnswers },
        _questions: questions.map((q) => q.id),
        _calculatedScore: percentage,
      } as never,
    });
    onNext();
  };

  const groupedQuestions = useMemo(() => {
    const groups: Record<string, PovertyQuestion[]> = {};
    questions.forEach((q) => {
      if (!groups[q.category]) groups[q.category] = [];
      groups[q.category].push(q);
    });
    return groups;
  }, [questions]);

  const categoryLabels: Record<string, string> = {
    income: "💰 Income & Financial Situation",
    housing: "🏠 Housing & Living Conditions",
    employment: "💼 Employment Status",
    health: "🏥 Health & Disability",
    education: "📚 Education",
    assets: "📦 Household Assets",
    vulnerability: "🛡️ Vulnerability Factors",
  };

  const renderQuestion = (question: PovertyQuestion) => {
    const isPerStudent = question.perStudent && studentCount > 1;
    if (!isPerStudent) {
      return (
        <FormField
          key={question.id}
          control={form.control}
          name={question.id as keyof DynamicFormData}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">{question.question}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                <FormControl>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background z-50">
                  {question.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    // Per-student: render one Select per student under a single grouped block
    return (
      <div key={question.id} className="rounded-lg border bg-secondary/30 p-3 space-y-3">
        <p className="text-sm font-medium text-foreground">{question.question}</p>
        <p className="text-xs text-muted-foreground">
          Answer this for each student on the application.
        </p>
        {Array.from({ length: studentCount }).map((_, idx) => {
          const fieldName = `${question.id}::s${idx}`;
          return (
            <FormField
              key={fieldName}
              control={form.control}
              name={fieldName as keyof DynamicFormData}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">
                    {studentLabel(idx)}
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select for this student" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background z-50">
                      {question.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
      </div>
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex gap-3">
            <ClipboardCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Poverty Assessment</p>
              <p className="text-sm text-muted-foreground">
                Answer honestly—this helps us prioritize those with the greatest need.
                Your responses are confidential and used only for allocation purposes.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Shuffle className="h-4 w-4" />
          <span>Questions are randomized for each applicant to ensure fair assessment</span>
        </div>

        {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              {categoryLabels[category] || category}
            </h3>
            {categoryQuestions.map(renderQuestion)}
          </div>
        ))}

        <DynamicPovertyBank
          pipeline={pipeline}
          value={bankAnswers}
          onChange={setBankAnswers}
        />




        {/* Additional Circumstances */}
        <FormField
          control={form.control}
          name="additionalCircumstances"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Circumstances (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe any special circumstances that affect your financial situation (e.g., medical conditions, recent loss of income, natural disaster, disability details)"
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                This information is confidential and will only be used for assessment
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" size="lg" onClick={onBack}>
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back
          </Button>
          <Button type="submit" size="lg">
            Next: Review
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
