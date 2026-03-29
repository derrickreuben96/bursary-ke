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

interface PovertyQuestionnaireProps {
  onNext: () => void;
  onBack: () => void;
}

export function PovertyQuestionnaire({ onNext, onBack }: PovertyQuestionnaireProps) {
  const { data, updateData } = useApplication();
  
  // Generate randomized questions once per session
  const questions = useMemo(() => getRandomizedQuestions(10), []);
  
  // Build dynamic schema based on questions
  const dynamicSchema = useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};
    questions.forEach(q => {
      schemaFields[q.id] = z.string().min(1, "Please select an option");
    });
    schemaFields.additionalCircumstances = z.string().max(500).optional();
    return z.object(schemaFields);
  }, [questions]);

  type DynamicFormData = z.infer<typeof dynamicSchema>;

  // Build default values
  const defaultValues = useMemo(() => {
    const values: Record<string, string> = {};
    questions.forEach(q => {
      values[q.id] = (data.povertyQuestionnaire as any)?.[q.id] || "";
    });
    values.additionalCircumstances = (data.povertyQuestionnaire as any)?.additionalCircumstances || "";
    return values;
  }, [questions, data.povertyQuestionnaire]);

  const form = useForm<DynamicFormData>({
    resolver: zodResolver(dynamicSchema),
    defaultValues,
  });

  const onSubmit = (formData: DynamicFormData) => {
    // Calculate poverty score from answers
    const { percentage } = calculatePovertyScoreFromAnswers(formData, questions);
    
    // Store the raw answers plus calculated metrics
    updateData({ 
      povertyQuestionnaire: {
        ...formData,
        householdIncome: percentage, // Store as percentage for backward compatibility
        numberOfDependents: 4, // Default for backward compatibility
        housingType: "Other" as const,
        accessToUtilities: { electricity: true, water: true, internet: false },
        parentalEmployment: "One Employed" as const,
        otherChildrenInSchool: 2,
        receivesOtherAid: false,
        _rawAnswers: formData,
        _questions: questions.map(q => q.id),
        _calculatedScore: percentage,
      } as any
    });
    onNext();
  };

  // Group questions by category for better UX
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, PovertyQuestion[]> = {};
    questions.forEach(q => {
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Info Card */}
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

        {/* Randomization Notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Shuffle className="h-4 w-4" />
          <span>Questions are randomized for each applicant to ensure fair assessment</span>
        </div>

        {/* Dynamic Questions grouped by category */}
        {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              {categoryLabels[category] || category}
            </h3>
            
            {categoryQuestions.map((question) => (
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
            ))}
          </div>
        ))}

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
