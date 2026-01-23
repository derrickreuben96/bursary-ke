import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
import { ArrowLeft, ArrowRight, ClipboardCheck, Lock } from "lucide-react";
import { povertyQuestionnaireSchema, type PovertyQuestionnaireFormData } from "@/lib/validationSchemas";
import { useApplication } from "@/context/ApplicationContext";
import { formatKES } from "@/lib/formatters";

interface PovertyQuestionnaireProps {
  onNext: () => void;
  onBack: () => void;
}

const incomeLabels = [
  { value: 0, label: "Below KES 10,000" },
  { value: 25, label: "KES 10,000 - 30,000" },
  { value: 50, label: "KES 30,000 - 60,000" },
  { value: 75, label: "KES 60,000 - 100,000" },
  { value: 100, label: "Above KES 100,000" },
];

function getIncomeLabel(value: number): string {
  const closest = incomeLabels.reduce((prev, curr) =>
    Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
  );
  return closest.label;
}

export function PovertyQuestionnaire({ onNext, onBack }: PovertyQuestionnaireProps) {
  const { data, updateData } = useApplication();

  const form = useForm<PovertyQuestionnaireFormData>({
    resolver: zodResolver(povertyQuestionnaireSchema),
    defaultValues: {
      householdIncome: data.povertyQuestionnaire?.householdIncome ?? 50,
      numberOfDependents: data.povertyQuestionnaire?.numberOfDependents ?? 4,
      housingType: data.povertyQuestionnaire?.housingType,
      accessToUtilities: data.povertyQuestionnaire?.accessToUtilities ?? {
        electricity: true,
        water: true,
        internet: false,
      },
      parentalEmployment: data.povertyQuestionnaire?.parentalEmployment,
      otherChildrenInSchool: data.povertyQuestionnaire?.otherChildrenInSchool ?? 2,
      receivesOtherAid: data.povertyQuestionnaire?.receivesOtherAid ?? false,
      additionalCircumstances: data.povertyQuestionnaire?.additionalCircumstances || "",
    },
  });

  const householdIncome = form.watch("householdIncome");
  const numberOfDependents = form.watch("numberOfDependents");
  const otherChildrenInSchool = form.watch("otherChildrenInSchool");

  const onSubmit = (formData: PovertyQuestionnaireFormData) => {
    updateData({ povertyQuestionnaire: formData });
    onNext();
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

        {/* Household Income Slider */}
        <FormField
          control={form.control}
          name="householdIncome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly Household Income</FormLabel>
              <FormControl>
                <div className="pt-2">
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                    <span>Low</span>
                    <span className="font-medium text-foreground">
                      {getIncomeLabel(householdIncome)}
                    </span>
                    <span>High</span>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Number of Dependents */}
        <FormField
          control={form.control}
          name="numberOfDependents"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Household Members (including yourself)</FormLabel>
              <FormControl>
                <div className="pt-2">
                  <Slider
                    min={1}
                    max={15}
                    step={1}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                    className="w-full"
                  />
                  <div className="text-center mt-2">
                    <span className="font-semibold text-lg text-foreground">
                      {numberOfDependents}
                    </span>
                    <span className="text-muted-foreground"> members</span>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Housing Type */}
        <FormField
          control={form.control}
          name="housingType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type of Housing</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select housing type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="Owned">Owned (family owns the house)</SelectItem>
                  <SelectItem value="Rented">Rented accommodation</SelectItem>
                  <SelectItem value="Informal">Informal settlement</SelectItem>
                  <SelectItem value="Other">Other arrangement</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Access to Utilities */}
        <FormField
          control={form.control}
          name="accessToUtilities"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Access to Utilities (select all that apply)</FormLabel>
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="electricity"
                    checked={field.value.electricity}
                    onCheckedChange={(checked) =>
                      field.onChange({ ...field.value, electricity: checked })
                    }
                  />
                  <label htmlFor="electricity" className="text-sm">
                    Electricity
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="water"
                    checked={field.value.water}
                    onCheckedChange={(checked) =>
                      field.onChange({ ...field.value, water: checked })
                    }
                  />
                  <label htmlFor="water" className="text-sm">
                    Piped Water
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="internet"
                    checked={field.value.internet}
                    onCheckedChange={(checked) =>
                      field.onChange({ ...field.value, internet: checked })
                    }
                  />
                  <label htmlFor="internet" className="text-sm">
                    Internet Access
                  </label>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Parental Employment */}
        <FormField
          control={form.control}
          name="parentalEmployment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parental/Guardian Employment Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select employment status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="Both Employed">Both parents employed</SelectItem>
                  <SelectItem value="One Employed">One parent employed</SelectItem>
                  <SelectItem value="Self-Employed">Self-employed/Casual work</SelectItem>
                  <SelectItem value="Both Unemployed">Both parents unemployed</SelectItem>
                  <SelectItem value="Deceased/N/A">Deceased/Not applicable</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Other Children in School */}
        <FormField
          control={form.control}
          name="otherChildrenInSchool"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Children in School/College</FormLabel>
              <FormControl>
                <div className="pt-2">
                  <Slider
                    min={0}
                    max={10}
                    step={1}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                    className="w-full"
                  />
                  <div className="text-center mt-2">
                    <span className="font-semibold text-lg text-foreground">
                      {otherChildrenInSchool}
                    </span>
                    <span className="text-muted-foreground"> other children</span>
                  </div>
                </div>
              </FormControl>
              <FormDescription>
                Number of other siblings or dependents currently in school
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Receives Other Aid */}
        <FormField
          control={form.control}
          name="receivesOtherAid"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="font-normal">
                  I/We currently receive other forms of financial aid or bursaries
                </FormLabel>
              </div>
            </FormItem>
          )}
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
                  placeholder="Describe any special circumstances that affect your financial situation (e.g., medical conditions, recent loss of income, natural disaster)"
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
