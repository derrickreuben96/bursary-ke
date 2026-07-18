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

export default function BudgetSimulator() {
  const navigate = useNavigate();
  const [budget, setBudget] = useState("2000000");
  const [avgAllocation, setAvgAllocation] = useState("25000");
  const [applicants, setApplicants] = useState("500");

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

  const b = Number(budget) || 0;
  const avg = Number(avgAllocation) || 1;
  const n = Number(applicants) || 0;
  const coverage = n > 0 ? Math.min(100, Math.round((b / avg / n) * 100)) : 0;
  const funded = Math.min(n, Math.floor(b / avg));
  const unfunded = Math.max(0, n - funded);

  return (
    <div className="min-h-screen flex flex-col">
      <Seo title="Budget Simulator — Bursary KE" description="Estimate coverage before allocation" path="/admin/governance/budget" />
      <Header />
      <main className="flex-1 container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Budget Simulator</h1>
            <p className="text-muted-foreground">Estimate coverage from budget, average allocation and applicant volume.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin/governance")}>Back</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>All figures are indicative — no live data is modified.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Programme budget (KES)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
            <div><Label>Avg allocation (KES)</Label><Input type="number" value={avgAllocation} onChange={(e) => setAvgAllocation(e.target.value)} /></div>
            <div><Label>Eligible applicants</Label><Input type="number" value={applicants} onChange={(e) => setApplicants(e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Projected outcome</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Coverage" value={`${coverage}%`} />
            <Stat label="Est. funded" value={funded.toLocaleString()} />
            <Stat label="Est. unfunded" value={unfunded.toLocaleString()} />
            <Stat label="Total needed" value={`KES ${(n * avg).toLocaleString()}`} />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded border">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
