// Ops & Reliability dashboard — admin-only.
// Surfaces audit_runs (regression evidence), sync_metrics (latency/failures),
// and workflow_backlog_snapshot (queue health). All data is non-PII.
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlayCircle, RefreshCw } from "lucide-react";

type AuditRun = {
  id: string; run_at: string; suite: string; total: number;
  passed: number; failed: number; duration_ms: number; status: string;
};
type Metric = { id: string; recorded_at: string; source: string; metric: string; value: number; severity: string };
type Backlog = { metric: string; value: number };

export default function AdminOpsDashboard() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [backlog, setBacklog] = useState<Backlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, m, b] = await Promise.all([
      (supabase.from("audit_runs") as unknown as { select: (s: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: AuditRun[] | null }> } } })
        .select("id,run_at,suite,total,passed,failed,duration_ms,status").order("run_at", { ascending: false }).limit(20),
      (supabase.from("sync_metrics") as unknown as { select: (s: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Metric[] | null }> } } })
        .select("id,recorded_at,source,metric,value,severity").order("recorded_at", { ascending: false }).limit(50),
      supabase.rpc("workflow_backlog_snapshot"),
    ]);
    setRuns(r.data ?? []);
    setMetrics(m.data ?? []);
    setBacklog(((b as { data: Backlog[] | null }).data) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const runAudit = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("lifecycle-audit", { body: {} });
      if (error) throw error;
      toast({
        title: `Audit ${data?.status ?? "complete"}`,
        description: `${data?.passed ?? 0}/${data?.total ?? 0} checks passed (${data?.durationMs ?? 0} ms)`,
      });
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Audit failed", description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setRunning(false);
    }
  };

  const sevColor = (s: string) =>
    s === "critical" || s === "error" ? "destructive" : s === "warn" ? "secondary" : "default";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ops & Reliability</h1>
            <p className="text-muted-foreground">Regression evidence, sync health, workflow backlog.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => void runAudit()} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Run lifecycle audit
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Workflow backlog</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {backlog.map((b) => (
              <div key={b.metric} className="p-4 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground">{b.metric.replace(/_/g, " ")}</div>
                <div className="text-2xl font-semibold">{Number(b.value)}</div>
              </div>
            ))}
            {backlog.length === 0 && <div className="text-muted-foreground">No data.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent audit runs</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead><TableHead>Suite</TableHead><TableHead>Status</TableHead>
                  <TableHead>Pass / Total</TableHead><TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.run_at).toLocaleString()}</TableCell>
                    <TableCell>{r.suite}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "pass" ? "default" : r.status === "fail" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.passed} / {r.total}</TableCell>
                    <TableCell>{r.duration_ms} ms</TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">No runs yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sync metrics (latest 50)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead><TableHead>Source</TableHead><TableHead>Metric</TableHead>
                  <TableHead>Value</TableHead><TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.recorded_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{m.source}</TableCell>
                    <TableCell>{m.metric}</TableCell>
                    <TableCell>{Number(m.value)}</TableCell>
                    <TableCell><Badge variant={sevColor(m.severity) as "default" | "secondary" | "destructive"}>{m.severity}</Badge></TableCell>
                  </TableRow>
                ))}
                {metrics.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">No metrics yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
