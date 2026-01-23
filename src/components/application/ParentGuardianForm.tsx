import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { Shield, ArrowRight } from "lucide-react";
import { parentGuardianSchema, type ParentGuardianFormData } from "@/lib/validationSchemas";
import { useApplication } from "@/context/ApplicationContext";

interface ParentGuardianFormProps {
  onNext: () => void;
}

export function ParentGuardianForm({ onNext }: ParentGuardianFormProps) {
  const { data, updateData } = useApplication();

  const form = useForm<ParentGuardianFormData>({
    resolver: zodResolver(parentGuardianSchema),
    defaultValues: {
      nationalId: data.parentGuardian?.nationalId || "",
      phoneNumber: data.parentGuardian?.phoneNumber || "",
      email: data.parentGuardian?.email || "",
      consentNotifications: data.parentGuardian?.consentNotifications || false,
      consentDataUsage: data.parentGuardian?.consentDataUsage || false,
    },
  });

  const onSubmit = (formData: ParentGuardianFormData) => {
    updateData({ parentGuardian: formData });
    onNext();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Security Notice */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Your data is protected</p>
              <p className="text-sm text-muted-foreground">
                All personal information is encrypted and stored securely. We comply with Kenya's Data Protection Act.
              </p>
            </div>
          </div>
        </Card>

        {/* National ID */}
        <FormField
          control={form.control}
          name="nationalId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>National ID Number *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter 8-digit National ID"
                  maxLength={8}
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    field.onChange(value);
                  }}
                />
              </FormControl>
              <FormDescription>
                Your National ID will be used for verification only and will be masked in displays.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Phone Number */}
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 0712345678 or +254712345678"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                We'll use this to send you application updates via SMS.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="e.g., yourname@example.com"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Receive application updates and future bursary notifications.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Consent Notifications */}
        <FormField
          control={form.control}
          name="consentNotifications"
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
                  I agree to receive notifications about future bursary opportunities
                </FormLabel>
              </div>
            </FormItem>
          )}
        />

        {/* Consent Data Usage */}
        <FormField
          control={form.control}
          name="consentDataUsage"
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
                  I agree to the{" "}
                  <a href="/data-protection" className="text-primary hover:underline">
                    Data Protection Policy
                  </a>{" "}
                  and consent to my information being used for bursary processing *
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg">
            Next: Student Information
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
