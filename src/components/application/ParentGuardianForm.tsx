import { useState, useEffect, useMemo } from "react";
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
import { Shield, ArrowRight, MapPin, FileText } from "lucide-react";
import { parentGuardianSchema, type ParentGuardianFormData } from "@/lib/validationSchemas";
import { useApplication } from "@/context/ApplicationContext";
import { PhoneConsentModal } from "./PhoneConsentModal";
import { wardsByCounty } from "@/lib/kenyanWards";
import { supabase } from "@/integrations/supabase/client";

interface BursaryAdvert {
  id: string;
  title: string;
  county: string;
  ward: string | null;
  deadline: string;
  budget_amount: number | null;
}

interface ParentGuardianFormProps {
  onNext: () => void;
}

export function ParentGuardianForm({ onNext }: ParentGuardianFormProps) {
  const { data, updateData } = useApplication();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<ParentGuardianFormData | null>(null);
  const [openAdverts, setOpenAdverts] = useState<BursaryAdvert[]>([]);

  const form = useForm<ParentGuardianFormData>({
    resolver: zodResolver(parentGuardianSchema),
    defaultValues: {
      fullName: data.parentGuardian?.fullName || "",
      nationalId: data.parentGuardian?.nationalId || "",
      phoneNumber: data.parentGuardian?.phoneNumber || "",
      email: data.parentGuardian?.email || "",
      county: data.parentGuardian?.county || "",
      ward: data.parentGuardian?.ward || "",
      selectedAdvertId: data.parentGuardian?.selectedAdvertId || data.advertId || "",
      consentNotifications: data.parentGuardian?.consentNotifications || false,
      consentDataUsage: data.parentGuardian?.consentDataUsage || false,
    },
  });

  const selectedCounty = form.watch("county");
  const selectedWard = form.watch("ward");

  // Fetch open bursary adverts
  useEffect(() => {
    supabase
      .from("bursary_adverts")
      .select("id, title, county, ward, deadline, budget_amount")
      .eq("is_active", true)
      .gte("deadline", new Date().toISOString())
      .then(({ data }) => {
        if (data) setOpenAdverts(data);
      });
  }, []);

  // Reset ward and advert when county changes
  useEffect(() => {
    form.setValue("ward", "");
    form.setValue("selectedAdvertId", "");
  }, [selectedCounty]);

  // Reset advert when ward changes
  useEffect(() => {
    form.setValue("selectedAdvertId", "");
  }, [selectedWard]);

  // Filter wards for selected county
  const availableWards = useMemo(() => {
    if (!selectedCounty) return [];
    return wardsByCounty[selectedCounty] || [];
  }, [selectedCounty]);

  // Filter adverts for selected county + ward
  const availableAdverts = useMemo(() => {
    if (!selectedCounty) return [];
    return openAdverts.filter((a) => {
      const countyMatch = a.county === selectedCounty;
      // Show county-wide adverts (no ward) + ward-specific adverts matching selected ward
      if (!selectedWard) return countyMatch;
      return countyMatch && (!a.ward || a.ward === selectedWard);
    });
  }, [selectedCounty, selectedWard, openAdverts]);

  // Counties that have open adverts
  const countiesWithAdverts = useMemo(() => {
    const counties = new Set(openAdverts.map((a) => a.county));
    return Object.keys(wardsByCounty).filter((c) => counties.has(c));
  }, [openAdverts]);

  const onSubmit = (formData: ParentGuardianFormData) => {
    setPendingFormData(formData);
    setShowConsentModal(true);
  };

  const handleConsent = () => {
    if (pendingFormData) {
      updateData({
        parentGuardian: { ...pendingFormData, consentNotifications: true },
        advertId: pendingFormData.selectedAdvertId,
      });
      setShowConsentModal(false);
      onNext();
    }
  };

  const handleDecline = () => {
    if (pendingFormData) {
      updateData({
        parentGuardian: { ...pendingFormData, consentNotifications: false },
        advertId: pendingFormData.selectedAdvertId,
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
                  <Input placeholder="e.g., 0712345678 or +254712345678" {...field} />
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
                  <Input type="email" placeholder="e.g., yourname@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* County & Ward Selection */}
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Location & Bursary Selection</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Select your county and ward to see available open bursaries in your area.
            </p>

            {/* County */}
            <FormField
              control={form.control}
              name="county"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>County *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your county" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countiesWithAdverts.length > 0 ? (
                        countiesWithAdverts.map((county) => (
                          <SelectItem key={county} value={county}>
                            {county}
                          </SelectItem>
                        ))
                      ) : (
                        Object.keys(wardsByCounty).map((county) => (
                          <SelectItem key={county} value={county}>
                            {county}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ward */}
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
                        <SelectValue placeholder={selectedCounty ? "Select your ward" : "Select county first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableWards.map((ward) => (
                        <SelectItem key={ward} value={ward}>
                          {ward}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Open Bursary Selection */}
            <FormField
              control={form.control}
              name="selectedAdvertId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Available Bursary *
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedWard}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedCounty
                              ? "Select county and ward first"
                              : !selectedWard
                              ? "Select ward first"
                              : availableAdverts.length === 0
                              ? "No open bursaries in this area"
                              : "Select a bursary to apply for"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableAdverts.map((advert) => (
                        <SelectItem key={advert.id} value={advert.id}>
                          <div className="flex flex-col">
                            <span>{advert.title}</span>
                            <span className="text-xs text-muted-foreground">
                              Deadline: {new Date(advert.deadline).toLocaleDateString("en-KE")} 
                              {advert.budget_amount && ` • Budget: KES ${advert.budget_amount.toLocaleString()}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedWard && availableAdverts.length === 0 && (
                    <p className="text-sm text-destructive">
                      No open bursaries available for {selectedWard}, {selectedCounty}. Please check back later.
                    </p>
                  )}
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
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
