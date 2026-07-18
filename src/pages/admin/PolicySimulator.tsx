import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/seo/Seo";
import { featureFlags } from "@/lib/featureFlags";
import { DEFAULT_POLICY_PROFILE } from "@/lib/ai/policyProfile";
import { simulatePolicy, type SimulationResult } from "@/lib/ai/simulator";
import type { Household } from "@/lib/household/types";
import { toast } from "@/hooks/use-toast";

// Static demo household to prove the simulator without touching live data.
// Real integrations can pass in fetched households later.
const demoHouseholds: Household[] = [
  {
    id: "demo-1",
    tracking_number: "BKE-DEMO01",
    parent_name_masked: "J***",
    county: "Nairobi",
    ward: "Karen",
    status: "under_review",
    created_at: new Date().toISOString(),
    students: [
      { id: "s1", name_masked: "A***", cohort: "secondary", institution_name: "Alliance High", disability_status: "none" },
      { id: "s2", name_masked: "B***", cohort: "higher_ed", institution_name: "UoN", disability_status: "none" },
    ],
  },
  {
    id: "demo-2",
    tracking_number: "BKE-DEMO02",
    parent_name_masked: "M***",
    county: "Kisumu",
    ward: "Kisumu Central",
    status: "approved",
    created_at: new Date().toISOString(),
    students: [
      { id: "s3", name_masked: "C***", cohort: "secondary", institution_name: "Maseno School", disability_status: "physical" },
    ],
  },
];

export default function PolicySimulator() {
  const navigate = useNavigate();
  const [budget, setBudget] = useState<string>("500000");
  const [result, setResult] = useState<SimulationResult | null>(null);

  if (!featureFlags.governance) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <h1 className="text-2xl font-bold">Governance module disabled</h1>
          <Button className="mt-6" onClick={() => navigate("/admin")}>Back to Admin</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const run = () => {
    const b = Number(budget);
    const out = simulatePolicy({
      profile: DEFAULT_POLICY_PROFILE,
      households: demoHouseholds,
      budget: Number.isFinite(b) && b > 0 ? b : undefined,
      household_ctx: {
        "demo-1": { monthly_income: 18000, single_parent: true, dependents: 4 },
        "demo-2": { monthly_income: 8000, parent_employment: "unemployed", disabled_member: true, dependents: 5 },
      },
      student_ctx: {
        s1: { school_type: "boarding", fee_balance: 45000, exam_class: true },
        s2: { accommodation: "hostel", fee_balance: 60000 },
        s3: { school_type: "boarding", fee_balance: 30000, walking_km: 6 },
      },
    });
    setResult(out);
    toast({ title: "Simulation complete", description: `${out.students_funded} students would be funded.` });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Seo title="Policy Simulator — Bursary KE" description="Dry-run AI policies before activation" path="/admin/governance/simulator" />
      <Header />
      <main className="flex-1 container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Policy Simulator</h1>
            <p className="text-muted-foreground">Runs the AI engine against a snapshot without touching live records.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin/governance")}>Back</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Uses the built-in default policy and a small demo household set.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label>Programme budget (KES)</Label>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" min={0} />
            </div>
            <Button onClick={run}>Run simulation</Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Result — Policy v{result.policy_version}</CardTitle>
              <CardDescription>Generated {new Date(result.generated_at).toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Stat label="Households" value={result.households_evaluated} />
              <Stat label="Students" value={result.students_evaluated} />
              <Stat label="Funded" value={result.students_funded} />
              <Stat label="Total allocation" value={`KES ${result.total_allocation.toLocaleString()}`} />
              <Stat label="Avg allocation" value={`KES ${result.avg_allocation.toLocaleString()}`} />
              <Stat label="Avg score" value={`${result.avg_needs_score}/100`} />
              {result.budget !== undefined && <Stat label="Budget used" value={`KES ${(result.budget_used ?? 0).toLocaleString()}`} />}
              {result.budget_deficit !== undefined && result.budget_deficit > 0 && (
                <Stat label="Deficit" value={`KES ${result.budget_deficit.toLocaleString()}`} />
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
