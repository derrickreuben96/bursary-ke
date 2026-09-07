import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { History, Loader2, ShieldCheck, AlertCircle, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useApplication, type ReusableStudent } from "@/context/ApplicationContext";
import { maskName } from "@/lib/maskData";

export interface ReusableParentProfile {
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
  email?: string | null;
  county?: string | null;
  ward?: string | null;
}

interface Props {
  /** Applies the retrieved, consented guardian details to the form. */
  onApply: (parent: ReusableParentProfile) => void;
}

/**
 * Returning-guardian data reuse (consent-gated).
 *
 * A guardian who has applied before should not retype details the county has
 * already verified. They authenticate with National ID + the phone number on
 * file (two factors), review exactly what will be reused, and must tick an
 * explicit consent box before anything is copied into the form.
 *
 * Only operationally reusable, verifiable facts are returned by the backend:
 * guardian identity/contact/location and the previously registered students.
 * Income, poverty answers and past decisions are never reused — those must be
 * declared afresh every cycle.
 */
export function ReturningGuardianPrefill({ onApply }: Props) {
  const { updateData } = useApplication();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [profile, setProfile] = useState<ReusableParentProfile | null>(null);
  const [students, setStudents] = useState<ReusableStudent[]>([]);
  const [lastAt, setLastAt] = useState<string | null>(null);

  const lookup = async () => {
    setError(null);
    setProfile(null);
    setStudents([]);
    setConsent(false);

    if (nationalId.trim().length < 6 || phone.trim().length < 9) {
      setError("Enter your National ID and the phone number used previously.");
      return;
    }

    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("get_reusable_guardian_profile", {
      _national_id: nationalId.trim(),
      _phone: phone.trim(),
      _consent: false,
    });
    setLoading(false);

    if (rpcError) {
      setError("We could not check your records right now. Please fill the form manually.");
      return;
    }
    const res = data as Record<string, unknown> | null;
    if (!res || res.error === "verification_failed") {
      setError("Those details do not match our records. Please check and try again.");
      return;
    }
    if (res.found === false) {
      setError("No previous application found for this National ID. Please fill the form below.");
      return;
    }

    setProfile((res.parent ?? null) as ReusableParentProfile | null);
    setStudents(((res.students ?? []) as ReusableStudent[]) || []);
    setLastAt((res.last_application_at as string) ?? null);
  };

  const apply = async () => {
    if (!profile || !consent) return;
    // Record the consent event server-side (audit trail).
    await supabase.rpc("get_reusable_guardian_profile", {
      _national_id: nationalId.trim(),
      _phone: phone.trim(),
      _consent: true,
    });
    updateData({ reusableStudents: students, reuseConsentGiven: true });
    onApply(profile);
    setOpen(false);
    toast({
      title: "Details reused",
      description: "Your verified information has been filled in. Please review and update anything that changed.",
    });
  };

  if (!open) {
    return (
      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <History className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Applied before?</p>
            <p className="text-sm text-muted-foreground">
              Reuse the details we already verified for you instead of starting from zero. You
              decide what is reused, and nothing is copied without your consent.
            </p>
            <a
              href="/guardian/profile"
              className="text-sm text-primary underline underline-offset-4 mt-1 inline-block"
            >
              View or edit my saved profile
            </a>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Retrieve my details
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-primary/30 bg-primary/5 space-y-4">
      <div className="flex items-start gap-3">
        <History className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">Retrieve my verified details</p>
          <p className="text-sm text-muted-foreground">
            Confirm your identity with your National ID and the phone number used on your previous
            application.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="reuse-nid">National ID</Label>
          <Input
            id="reuse-nid"
            inputMode="numeric"
            maxLength={8}
            placeholder="8-digit National ID"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reuse-phone">Phone number on file</Label>
          <Input
            id="reuse-phone"
            inputMode="tel"
            placeholder="e.g., 0712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={lookup} disabled={loading} size="sm">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Check my records
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {profile && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-background p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-foreground">
              Record found{lastAt ? ` — last applied ${new Date(lastAt).toLocaleDateString()}` : ""}
            </p>
          </div>

          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Name: {maskName(profile.full_name || "")}</li>
            <li>Phone: {profile.phone ? `${profile.phone.slice(0, 4)}****${profile.phone.slice(-2)}` : "—"}</li>
            <li>
              Location: {profile.county || "—"}
              {profile.ward ? ` / ${profile.ward}` : ""}
            </li>
            <li>
              Previously registered students:{" "}
              {students.length > 0
                ? students.map((s) => maskName(s.student_full_name)).join(", ")
                : "none"}
            </li>
          </ul>

          <p className="text-xs text-muted-foreground">
            Household income, poverty assessment answers and previous decisions are never reused —
            you will declare those again for this bursary window.
          </p>

          <div className="flex items-start gap-2">
            <Checkbox
              id="reuse-consent"
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
            />
            <Label htmlFor="reuse-consent" className="text-sm font-normal leading-snug">
              I consent to reusing my previously verified guardian details and student records for
              this application.
            </Label>
          </div>

          <Button type="button" size="sm" onClick={apply} disabled={!consent}>
            Use these details
          </Button>
        </div>
      )}
    </Card>
  );
}
