import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Seo } from "@/components/seo/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { maskName } from "@/lib/maskData";
import { AlertCircle, Loader2, ShieldCheck, UserCog, Save } from "lucide-react";

interface Parent {
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
  email?: string | null;
  county?: string | null;
  ward?: string | null;
}

interface SavedStudent {
  student_full_name: string;
  student_type?: string | null;
  institution_name?: string | null;
}

export default function GuardianProfile() {
  const { toast } = useToast();
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [students, setStudents] = useState<SavedStudent[]>([]);
  const [form, setForm] = useState<Parent>({});

  const verify = async () => {
    setError(null);
    setParent(null);
    if (nationalId.trim().length < 6 || phone.trim().length < 9) {
      setError("Enter your National ID and the phone number on your previous application.");
      return;
    }
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc("get_reusable_guardian_profile", {
      _national_id: nationalId.trim(),
      _phone: phone.trim(),
      _consent: false,
    });
    setLoading(false);
    if (rpcErr) {
      setError("We could not reach your records right now. Please try again shortly.");
      return;
    }
    const res = data as Record<string, unknown> | null;
    if (!res || res.error === "verification_failed") {
      setError("Those details do not match our records.");
      return;
    }
    if (res.found === false) {
      setError("No saved profile found for this National ID.");
      return;
    }
    const p = (res.parent ?? {}) as Parent;
    setParent(p);
    setForm(p);
    setStudents(((res.students ?? []) as SavedStudent[]) || []);
  };

  const save = async () => {
    setSaving(true);
    const { data, error: rpcErr } = await supabase.rpc("update_guardian_profile" as never, {
      _national_id: nationalId.trim(),
      _phone: phone.trim(),
      _updates: {
        parent_full_name: form.full_name ?? "",
        parent_phone: form.phone ?? "",
        parent_email: form.email ?? "",
        parent_county: form.county ?? "",
        parent_ward: form.ward ?? "",
      },
    } as never);
    setSaving(false);
    const res = data as unknown as { updated?: boolean; error?: string; parent?: Parent } | null;
    if (rpcErr || !res || res.error) {
      toast({ title: "Could not save", description: "Please check your details and try again.", variant: "destructive" });
      return;
    }
    setParent(res.parent ?? form);
    if (res.parent?.phone) setPhone(res.parent.phone);
    toast({ title: "Profile updated", description: "Your saved details have been updated." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Seo
        title="My Guardian Profile — Bursary KE"
        description="View and update the guardian details saved from your previous bursary applications."
        path="/guardian/profile"
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-7 w-7 text-primary" /> My guardian profile
          </h1>
          <p className="text-muted-foreground text-sm">
            View the details we already hold for you and keep them up to date, so your next application
            starts already filled in.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Confirm it's you</CardTitle>
            <CardDescription>Use your National ID and the phone number on your last application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="gp-nid">National ID</Label>
                <Input
                  id="gp-nid"
                  inputMode="numeric"
                  maxLength={8}
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))}
                  placeholder="8-digit National ID"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gp-phone">Phone number on file</Label>
                <Input
                  id="gp-phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 0712345678"
                />
              </div>
            </div>
            <Button onClick={verify} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              View my profile
            </Button>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {parent && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Saved details
                </CardTitle>
                <CardDescription>Edit anything that has changed, then save.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" value={form.full_name ?? ""} onChange={(v) => setForm({ ...form, full_name: v })} />
                  <div className="space-y-1">
                    <Label>National ID</Label>
                    <Input value={parent.national_id ?? ""} readOnly disabled />
                  </div>
                  <Field label="Phone number" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
                  <Field label="Email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
                  <Field label="County" value={form.county ?? ""} onChange={(v) => setForm({ ...form, county: v })} />
                  <Field label="Ward" value={form.ward ?? ""} onChange={(v) => setForm({ ...form, ward: v })} />
                </div>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save changes
                </Button>
                <p className="text-xs text-muted-foreground">
                  Household income, assessment answers and past decisions are never changed here — those are
                  declared afresh in each application.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Students on file</CardTitle>
                <CardDescription>These can be reused when you start a new application.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students saved yet.</p>
                ) : students.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded border p-3">
                    <div>
                      <p className="text-sm font-medium">{maskName(s.student_full_name)}</p>
                      <p className="text-xs text-muted-foreground">{s.institution_name || "—"}</p>
                    </div>
                    <Badge variant="secondary">{s.student_type || "student"}</Badge>
                  </div>
                ))}
                <div className="pt-2 flex gap-2">
                  <Button asChild variant="outline" size="sm"><Link to="/apply/secondary">Start secondary application</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link to="/apply/university">Start university application</Link></Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
