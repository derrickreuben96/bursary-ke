import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatKES } from "@/lib/formatters";
import { Loader2, Banknote, Send, RefreshCw } from "lucide-react";

interface Disbursement {
  id: string;
  student_id: string | null;
  school_name: string | null;
  county: string | null;
  amount: number;
  status: string;
  payment_reference: string | null;
  retry_count: number;
  last_error: string | null;
  triggered_at: string;
  completed_at: string | null;
}

interface ErpRow {
  id: string;
  disbursement_id: string;
  school_name: string | null;
  delivery_status: string;
  ack_timestamp: string | null;
  retry_count: number;
  created_at: string;
}

interface PendingStudent {
  id: string;
  student_full_name: string;
  institution_name: string;
  allocated_amount: number | null;
  parent_application_id: string;
}

export default function AdminDisbursements() {
  const { toast } = useToast();
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [erp, setErp] = useState<ErpRow[]>([]);
  const [pending, setPending] = useState<PendingStudent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: e }, { data: stu }] = await Promise.all([
      supabase.from("disbursements").select("*").order("triggered_at", { ascending: false }).limit(500),
      supabase.from("erp_notifications").select("*").order("created_at", { ascending: false }).limit(500),
      supabase
        .from("student_beneficiaries")
        .select("id, student_full_name, institution_name, allocated_amount, parent_application_id")
        .eq("status", "approved")
        .eq("released_to_treasury", true),
    ]);
    setDisbursements((d as Disbursement[]) || []);
    setErp((e as ErpRow[]) || []);
    // Exclude students that already have a non-failed disbursement
    const haveDisb = new Set(
      ((d as Disbursement[]) || [])
        .filter((x) => x.status !== "failed" && x.student_id)
        .map((x) => x.student_id as string)
    );
    setPending(((stu as PendingStudent[]) || []).filter((s) => !haveDisb.has(s.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const triggerSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("disbursement-trigger", {
        body: { student_ids: Array.from(selected) },
      });
      if (error) throw error;
      toast({
        title: "Disbursements queued",
        description: `${data?.created?.length ?? 0} payment(s) submitted to gateway.`,
      });
      setSelected(new Set());
      await load();
    } catch (e) {
      toast({ title: "Failed", description: (e as Error).message, variant: "destructive" });
    }
    setBusy(false);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      processing: "bg-blue-100 text-blue-700",
      paid: "bg-green-100 text-green-700",
      failed: "bg-destructive/15 text-destructive",
      cancelled: "bg-muted text-muted-foreground",
      sent: "bg-blue-100 text-blue-700",
      acknowledged: "bg-green-100 text-green-700",
    };
    return <Badge className={map[s] || ""}>{s}</Badge>;
  };

  const counts = {
    pending: disbursements.filter((d) => d.status === "pending" || d.status === "processing").length,
    paid: disbursements.filter((d) => d.status === "paid").length,
    failed: disbursements.filter((d) => d.status === "failed").length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Banknote className="h-7 w-7 text-primary" /> Disbursements
            </h1>
            <p className="text-muted-foreground text-sm">
              IPN engine — trigger payments and monitor school ERP sync.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Ready to Disburse ({pending.length})</TabsTrigger>
            <TabsTrigger value="processing">Processing ({counts.pending})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({counts.paid})</TabsTrigger>
            <TabsTrigger value="failed">Failed ({counts.failed})</TabsTrigger>
            <TabsTrigger value="erp">ERP Sync ({erp.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Approved students awaiting payment</CardTitle>
                    <CardDescription>Released by commissioner. Trigger to start payment.</CardDescription>
                  </div>
                  <Button onClick={triggerSelected} disabled={busy || selected.size === 0}>
                    {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    Trigger {selected.size > 0 && `(${selected.size})`}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No pending releases.</TableCell></TableRow>
                    ) : pending.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.student_full_name.split(" ")[0]} ***
                        </TableCell>
                        <TableCell className="text-sm">{s.institution_name}</TableCell>
                        <TableCell>{formatKES(Number(s.allocated_amount || 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {(["processing", "completed", "failed"] as const).map((key) => {
            const filter = key === "processing"
              ? (d: Disbursement) => d.status === "pending" || d.status === "processing"
              : key === "completed"
              ? (d: Disbursement) => d.status === "paid"
              : (d: Disbursement) => d.status === "failed";
            const rows = disbursements.filter(filter);
            return (
              <TabsContent key={key} value={key}>
                <Card>
                  <CardHeader><CardTitle className="capitalize">{key}</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>School</TableHead>
                          <TableHead>County</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Retries</TableHead>
                          <TableHead>Triggered</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">None.</TableCell></TableRow>
                        ) : rows.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs">{d.payment_reference}</TableCell>
                            <TableCell className="text-sm">{d.school_name}</TableCell>
                            <TableCell className="text-sm">{d.county}</TableCell>
                            <TableCell>{formatKES(Number(d.amount))}</TableCell>
                            <TableCell>{statusBadge(d.status)}</TableCell>
                            <TableCell>{d.retry_count}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(d.triggered_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}

          <TabsContent value="erp">
            <Card>
              <CardHeader>
                <CardTitle>School ERP Notifications</CardTitle>
                <CardDescription>IPN payloads sent to school systems after successful payment.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>School</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Acknowledged</TableHead>
                      <TableHead>Retries</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {erp.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No ERP notifications yet.</TableCell></TableRow>
                    ) : erp.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.school_name}</TableCell>
                        <TableCell>{statusBadge(r.delivery_status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.ack_timestamp ? new Date(r.ack_timestamp).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>{r.retry_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
