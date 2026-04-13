import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu",
  "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa",
  "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
  "Trans-Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
];

const subscriptionSchema = z.object({
  county: z.string().min(1, "Please select a county"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
}).refine((data) => data.phone || data.email, {
  message: "Please provide either a phone number or email address",
});

interface SubscribeNotificationsProps {
  variant?: "button" | "inline";
}

export function SubscribeNotifications({ variant = "button" }: SubscribeNotificationsProps) {
  const [open, setOpen] = useState(false);
  const [county, setCounty] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const resetForm = () => {
    setCounty("");
    setPhone("");
    setEmail("");
    setErrors({});
    setIsSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = subscriptionSchema.safeParse({ county, phone: phone || undefined, email: email || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const path = err.path[0] as string || "form";
        fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Format phone number
      let formattedPhone = phone;
      if (phone) {
        formattedPhone = phone.replace(/\s/g, "");
        if (formattedPhone.startsWith("0")) {
          formattedPhone = "+254" + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith("+")) {
          formattedPhone = "+254" + formattedPhone;
        }
      }

      const { error } = await supabase
        .from("bursary_subscriptions")
        .insert({
          county,
          phone: formattedPhone || null,
          email: email || null,
        });

      if (error) {
        console.error("[Subscribe] Error:", error);
        toast({
          title: "Subscription failed",
          description: "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      setIsSuccess(true);
      toast({
        title: "Subscribed successfully!",
        description: `You'll receive alerts when new bursaries open in ${county}.`,
        action: (
          <a href="/unsubscribe" className="underline text-xs">
            Manage subscriptions
          </a>
        ),
      });

      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 2000);
    } catch (err) {
      console.error("[Subscribe] Unexpected error:", err);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const TriggerButton = variant === "inline" ? (
    <button className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
      <Bell className="h-4 w-4" />
      Get notified
    </button>
  ) : (
    <Button variant="outline" size="lg" className="gap-2 hover:scale-105 transition-transform">
      <Bell className="h-4 w-4" />
      Subscribe for Alerts
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        {TriggerButton}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Subscribe for Bursary Alerts
          </DialogTitle>
          <DialogDescription>
            Get notified via SMS or email when new bursary opportunities open in your county.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4 animate-fade-in">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-center text-muted-foreground">
              You're now subscribed! We'll notify you when new bursaries open in <strong>{county}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* County Selection */}
            <div className="space-y-2">
              <Label htmlFor="county">Select Your County *</Label>
              <Select value={county} onValueChange={setCounty}>
                <SelectTrigger id="county" className={errors.county ? "border-destructive" : ""}>
                  <SelectValue placeholder="Choose county..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {KENYAN_COUNTIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.county && <p className="text-xs text-destructive">{errors.county}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (SMS alerts)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0712 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {errors.form && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{errors.form}</p>
            )}

            <p className="text-xs text-muted-foreground">
              * At least one contact method (phone or email) is required.
            </p>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Subscribing...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Subscribe for Alerts
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
