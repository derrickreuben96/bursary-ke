import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Seo } from "@/components/seo/Seo";
import { AlertCircle, Loader2, Plus, Search, Users, GraduationCap, Bell } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Household Dashboard (Phase 4)
 * Public parent-facing landing that groups every application belonging to a
 * Parent National ID under one Household Tracking number (BK-HH-YYYY-NNNNN).
 *
 * This page is strictly additive:
 * - Existing /apply/secondary and /apply/university keep working unchanged.
 * - The "Add Applicant" button routes into those forms with ?household=... prefilled.
 * - Reads via SECURITY DEFINER RPC get_household_summary(_lookup, _verifier)
 *   so no PII table is exposed directly to the browser.
 */

type Applicant = {
  id: string;
  student_full_name: string;
  education_category?: string | null;
  student_type?: string | null;
  institution_name?: string | null;
  class_form?: string | null;
  year_of_study?: string | null;
  status?: string | null;
  allocated_amount?: number | null;
  released_to_treasury?: boolean | null;
};

type Application = {
  parent_application_id: string;
  tracking_number: string;
  status: string | null;
  current_stage?: string | null;
  created_at: string;
  updated_at: string;
  students: Applicant[];
};

type Notification = {
  id: string;
  event_type: string;
  title: string;
  body?: string | null;
  read_at?: string | null;
  created_at: string;
};

type HouseholdSummary = {
  household_id: string;
  household_tracking_id: string;
  parent_full_name?: string | null;
  parent_county?: string | null;
  parent_ward?: string | null;
  applications: Application[];
  notifications: Notification[];
  audit_log: unknown[];
};

export default function HouseholdDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState(searchParams.get("household") || "");
  const [verifier, setVerifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HouseholdSummary | null>(null);

  const load = async (l: string, v: string) => {
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_household_summary", {
        _lookup: l.trim().toUpperCase(),
        _verifier: v.trim(),
      });
      if (error) throw error;
      const payload = data as HouseholdSummary | { error?: string } | null;
      if (!payload) {
        setSummary(null);
        setError("No household found. Check your Household ID or National ID.");
        return;
      }
      if ((payload as { error?: string }).error === "verification_failed") {
        setError("We could not verify you. Enter the National ID or phone on file.");
        setSummary(null);
        return;
      }
      setSummary(payload as HouseholdSummary);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load household";
      setError(msg);
      toast({ title: "Lookup failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const prefill = searchParams.get("household");
    const ver = searchParams.get("verifier");
    if (prefill && ver) void load(prefill, ver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalApplicants = summary?.applications.reduce((n, a) => n + a.students.length, 0) ?? 0;
  const unreadNotifs = summary?.notifications.filter((n) => !n.read_at).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="My Household — Bursary KE"
        description="Manage every bursary application in your household from one dashboard."
      />
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">My Household</h1>
        </div>

        {!summary && (
          <Card className="p-6 max-w-2xl">
            <p className="text-sm text-muted-foreground mb-4">
              Enter your Household Tracking Number (<span className="font-mono">BK-HH-YYYY-NNNNN</span>) or
              Parent National ID, then confirm your identity with the phone number or National ID on file.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lookup">Household ID or Parent National ID</Label>
                <Input
                  id="lookup"
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  placeholder="BK-HH-2026-00001 or 12345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verifier">Verify with phone or National ID</Label>
                <Input
                  id="verifier"
                  value={verifier}
                  onChange={(e) => setVerifier(e.target.value)}
                  placeholder="0712345678 or 12345678"
                />
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={() => load(lookup, verifier)}
              disabled={loading || !lookup || !verifier}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Open my household
            </Button>
            {error && (
              <p className="mt-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
          </Card>
        )}

        {summary && (
          <>
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Household Tracking</p>
                  <p className="text-xl font-mono font-semibold">{summary.household_tracking_id}</p>
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Parent:</span>{" "}
                    <span className="font-medium">{summary.parent_full_name}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.parent_county} · {summary.parent_ward}
                  </p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Button
                    onClick={() =>
                      navigate(
                        `/apply/secondary?household=${encodeURIComponent(summary.household_tracking_id)}`
                      )
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Applicant
                  </Button>
                  <div className="flex gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <GraduationCap className="h-4 w-4" /> {totalApplicants} applicants
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Bell className="h-4 w-4" /> {unreadNotifs} unread
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b bg-muted/40">
                <h2 className="font-semibold">Applications</h2>
              </div>
              <div className="divide-y">
                {summary.applications.length === 0 && (
                  <p className="p-6 text-sm text-muted-foreground">No applications yet.</p>
                )}
                {summary.applications.map((app) => (
                  <div key={app.parent_application_id} className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{app.tracking_number}</span>
                        <Badge variant="outline" className="capitalize">
                          {app.status ?? "received"}
                        </Badge>
                      </div>
                      <Link
                        to={`/track?number=${encodeURIComponent(app.tracking_number)}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Track →
                      </Link>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {app.students.map((s) => (
                        <div key={s.id} className="rounded border p-3 text-sm bg-card">
                          <p className="font-medium">{s.student_full_name}</p>
                          <p className="text-muted-foreground">
                            {s.institution_name || "Institution pending"} ·{" "}
                            {s.education_category || s.student_type || ""}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">
                              {s.status ?? "pending"}
                            </Badge>
                            {s.released_to_treasury && (
                              <Badge className="bg-primary/10 text-primary">Released</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b bg-muted/40 flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <h2 className="font-semibold">Notifications</h2>
              </div>
              <div className="divide-y">
                {summary.notifications.length === 0 && (
                  <p className="p-6 text-sm text-muted-foreground">
                    You have no household notifications yet.
                  </p>
                )}
                {summary.notifications.map((n) => (
                  <div key={n.id} className="p-4">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
