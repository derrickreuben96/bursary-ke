import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Seo } from "@/components/seo/Seo";
import { supabase } from "@/integrations/supabase/client";
import { featureFlags } from "@/lib/featureFlags";
import { computeDrift, type RecommendationSample } from "@/lib/ai/governance/drift";
import { Activity, Gauge, ShieldCheck, TrendingUp, Sliders, PlayCircle } from "lucide-react";

interface PolicyRow { id: string; name: string; version: string; status: string; activated_at: string | null }
interface RecLogRow { policy_version: string; needs_score: number; recommended_allocation: number; generated_at: string; reasons: unknown }
interface Notif { id: string; kind: string; severity: string; title: string; created_at: string; acknowledged_at: string | null }

export default function AIGovernanceDashboard() {
  const navigate = useNavigate();
  const [active, setActive] = useState<PolicyRow | null>(null);
  const [recCount, setRecCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [avgAlloc, setAvgAlloc] = useState(0);
  const [drift, setDrift] = useState<ReturnType<typeof computeDrift>>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: pol }, { data: rec }, { data: nf }] = await Promise.all([
        supabase.from("policy_profiles" as never).select("*").eq("status", "active").order("activated_at", { ascending: false }).limit(1),
        supabase.from("ai_recommendation_log" as never).select("*").order("generated_at", { ascending: false }).limit(500),
        supabase.from("governance_notifications" as never).select("*").is("acknowledged_at", null).order("created_at", { ascending: false }).limit(10),
      ]);
      const active = (pol as PolicyRow[] | null)?.[0] ?? null;
      setActive(active);
      const rows = (rec as RecLogRow[] | null) ?? [];
      setRecCount(rows.length);
      if (rows.length) {
        setAvgScore(Math.round(rows.reduce((n, r) => n + r.needs_score, 0) / rows.length));
        setAvgAlloc(Math.round(rows.reduce((n, r) => n + Number(r.recommended_allocation), 0) / rows.length));
      }
      const samples: RecommendationSample[] = rows.map((r) => ({
        policy_version: r.policy_version,
        cohort: "secondary",
        needs_score: r.needs_score,
        recommended_allocation: Number(r.recommended_allocation),
        generated_at: r.generated_at,
      }));
      setDrift(computeDrift(samples));
      setNotifs((nf as Notif[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  if (!featureFlags.governance) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <h1 className="text-2xl font-bold">Governance module disabled</h1>
          <p className="text-muted-foreground mt-2">Set VITE_FF_GOVERNANCE=true and redeploy to enable.</p>
          <Button className="mt-6" onClick={() => navigate("/admin")}>Back to Admin</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const tiles: Array<{ label: string; value: string; icon: JSX.Element; hint?: string }> = [
    { label: "Active policy", value: active ? `${active.name} v${active.version}` : "Built-in default", icon: <ShieldCheck className="h-5 w-5 text-emerald-600" /> },
    { label: "Recommendations (recent)", value: recCount.toString(), icon: <Activity className="h-5 w-5 text-primary" /> },
    { label: "Avg needs score", value: avgScore ? `${avgScore}/100` : "—", icon: <Gauge className="h-5 w-5 text-amber-600" /> },
    { label: "Avg recommended", value: avgAlloc ? `KES ${avgAlloc.toLocaleString()}` : "—", icon: <TrendingUp className="h-5 w-5 text-blue-600" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Seo title="AI Governance — Bursary KE" description="Policy governance, drift, fairness and simulation" path="/admin/governance" />
      <Header />
      <main className="flex-1 container py-8 space-y-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Governance</h1>
            <p className="text-muted-foreground">Policy versioning, simulation and health monitoring.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin")}>Back to Admin</Button>
            <Button variant="secondary" onClick={() => navigate("/admin/governance/policies")}><Sliders className="h-4 w-4 mr-2" />Policies</Button>
            <Button variant="secondary" onClick={() => navigate("/admin/governance/simulator")}><PlayCircle className="h-4 w-4 mr-2" />Simulator</Button>
            <Button variant="secondary" onClick={() => navigate("/admin/governance/budget")}>Budget</Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading governance metrics…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiles.map((t) => (
                <Card key={t.label}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
                    {t.icon}
                  </CardHeader>
                  <CardContent><p className="text-2xl font-semibold">{t.value}</p></CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recommendation drift</CardTitle>
                  <CardDescription>Compares recent recommendations against the earlier half of the window.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {drift.length === 0 && <p className="text-sm text-muted-foreground">Not enough data yet.</p>}
                  {drift.map((d) => (
                    <div key={d.cohort} className="flex items-center justify-between p-3 rounded border">
                      <div>
                        <p className="font-medium capitalize">{d.cohort.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          Δ score {d.score_delta > 0 ? "+" : ""}{d.score_delta} pp · Δ allocation {d.allocation_delta_pct > 0 ? "+" : ""}{d.allocation_delta_pct}%
                        </p>
                      </div>
                      <Badge variant={d.drift_detected ? "destructive" : "secondary"}>
                        {d.drift_detected ? d.severity : "stable"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Open notifications</CardTitle>
                  <CardDescription>Governance alerts awaiting acknowledgement.</CardDescription>
                </CardHeader>
                <CardContent>
                  {notifs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing to review.</p>
                  ) : (
                    <ul className="space-y-2">
                      {notifs.map((n) => (
                        <li key={n.id} className="flex items-start justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{n.title}</p>
                            <p className="text-xs text-muted-foreground">{n.kind} · {new Date(n.created_at).toLocaleString()}</p>
                          </div>
                          <Badge>{n.severity}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
