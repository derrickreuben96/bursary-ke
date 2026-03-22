import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Shield, ArrowRight } from "lucide-react";
import { parentGuardianSchema, type ParentGuardianFormData } from "@/lib/validationSchemas";
import { useApplication } from "@/context/ApplicationContext";
import { PhoneConsentModal } from "./PhoneConsentModal";
import { wardsByCounty } from "@/lib/kenyanWards";

interface ParentGuardianFormProps {
  onNext: () => void;
}

export function ParentGuardianForm({ onNext }: ParentGuardianFormProps) {
  const { data, updateData } = useApplication();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<ParentGuardianFormData | null>(null);

  const counties = useMemo(() => Object.keys(wardsByCounty).sort(), []);

  const form = useForm<ParentGuardianFormData>({
    resolver: zodResolver(parentGuardianSchema),
    defaultValues: {
      nationalId: data.parentGuardian?.nationalId || "",
      fullName: data.parentGuardian?.fullName || "",
      phoneNumber: data.parentGuardian?.phoneNumber || "",
      email: data.parentGuardian?.email || "",
      county: data.parentGuardian?.county || "",
      ward: data.parentGuardian?.ward || "",
      consentNotifications: data.parentGuardian?.consentNotifications || false,
      consentDataUsage: data.parentGuardian?.consentDataUsage || false,
    },
  });

  const selectedCounty = form.watch("county");
  const wards = useMemo(
    () => (selectedCounty ? wardsByCounty[selectedCounty] || [] : []),
    [selectedCounty]
  );

  const onSubmit = (formData: ParentGuardianFormData) => {
    setPendingFormData(formData);
    setShowConsentModal(true);
  };

  const handleConsent = () => {
    if (pendingFormData) {
      updateData({
        parentGuardian: {
          ...pendingFormData,
          consentNotifications: true,
        },
      });
      setShowConsentModal(false);
      onNext();
    }
  };

  const handleDecline = () => {
    if (pendingFormData) {
      updateData({
        parentGuardian: {
          ...pendingFormData,
          consentNotifications: false,
        },
      });
      setShowConsentModal(false);
      onNext();
    }
  };

  const phoneNumber = form.watch("phoneNumber");

  return (
    <>
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

          {/* Full Name */}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          {/* County & Ward Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="county"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>County *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("ward", "");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select county" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {counties.map((county) => (
                        <SelectItem key={county} value={county}>
                          {county}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ward"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ward / Sub-County *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedCounty}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedCounty ? "Select ward" : "Select county first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {wards.map((ward) => (
                        <SelectItem key={ward} value={ward}>
                          {ward}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Your application will be directed to the commissioner for this ward.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
            <Button type="submit" size="lg" className="hover:scale-105 transition-transform">
              Next: Student Information
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </form>
      </Form>

      {/* Phone Consent Modal */}
      <PhoneConsentModal
        open={showConsentModal}
        onOpenChange={setShowConsentModal}
        onConsent={handleConsent}
        onDecline={handleDecline}
        phoneNumber={phoneNumber || ""}
      />
    </>
  );
}
