import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Seo } from "@/components/seo/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatKES } from "@/lib/formatters";
import { Banknote, Loader2, RefreshCw, Send, ArrowLeft, CheckCircle2 } from "lucide-react";

interface PendingStudent {
  id: string;
  tracking_number: string | null;
  student_name_masked: string | null;
  student_type: string | null;
  institution_name: string | null;
  allocated_amount: number | null;
  status: string;
  county: string | null;
}

interface PaymentRow {
  id: string;
  student_id: string | null;
  school_name: string | null;
  county: string | null;
  amount: number;
  status: string;
  payment_reference: string | null;
  triggered_at: string;
  completed_at: string | null;
}

export default function TreasuryDisbursements() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingStudent[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("ready");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [{ data: stu }, { data: disb }] = await Promise.all([
      supabase.rpc("get_treasury_student_beneficiaries"),
      supabase
        .from("disbursements")
        .select("id, student_id, school_name, county, amount, status, payment_reference, triggered_at, completed_at")
        .order("triggered_at", { ascending: false })
        .limit(500),
    ]);
    const rows = ((stu as unknown as PendingStudent[]) || []).filter(
      (s) => s.status === "approved" && Number(s.allocated_amount || 0) > 0,
    );
    const paid = (disb as PaymentRow[] | null) || [];
    const alreadyPaid = new Set(paid.filter((d) => d.status !== "failed" && d.student_id).map((d) => d.student_id as string));
    setPending(rows.filter((s) => !alreadyPaid.has(s.id)));
    setPayments(paid);
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === pending.length ? new Set() : new Set(pending.map((p) => p.id))));
  };

  const payNow = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("treasury_disburse_students" as never, {
      _student_ids: Array.from(selected),
    } as never);
    setBusy(false);
    if (error) {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
      return;
    }
    const res = data as unknown as { paid: number; skipped: number; total_amount: number };
    toast({
      title: "Payment references created",
      description: `${res?.paid ?? 0} student payment(s) queued — ${formatKES(Number(res?.total_amount || 0))}.`,
    });
    setSelected(new Set());
    setTab("paid");
    await load(true);
  };

  const markProcessed = async (id: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("treasury_mark_payment_processed" as never, { _disbursement_id: id } as never);
    setBusy(false);
    const res = data as unknown as { processed?: boolean; reference?: string } | null;
    if (error || !res?.processed) {
      toast({ title: "Could not process payment", description: error?.message ?? "Please refresh and try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Payment processed", description: `${res.reference ?? "Payment"} is complete.` });
    await load(true);
  };

  const totalSelected = pending
    .filter((p) => selected.has(p.id))
    .reduce((n, p) => n + Number(p.allocated_amount || 0), 0);

  const totalPaid = payments.filter((p) => p.status === "paid").reduce((n, p) => n + Number(p.amount), 0);

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Seo title="Treasury Disbursements — Bursary KE" description="Pay approved bursary beneficiaries and keep a payment record" path="/treasury/disbursements" />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Banknote className="h-7 w-7 text-primary" /> Disbursements
            </h1>
            <p className="text-sm text-muted-foreground">
              Pay approved students released to Treasury. Every payment creates a permanent record.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/treasury")}>
              <ArrowLeft className="h-4 w-4 mr-2" />Back to dashboard
            </Button>
            <Button variant="outline" onClick={() => load(false)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryTile label="Awaiting payment" value={pending.length.toString()} />
          <SummaryTile label="Selected total" value={formatKES(totalSelected)} />
          <SummaryTile label="Total paid" value={formatKES(totalPaid)} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="ready">Ready to pay ({pending.length})</TabsTrigger>
            <TabsTrigger value="paid">Payment records ({payments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="ready">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle>Approved students in your county</CardTitle>
                  <CardDescription>Released by the commissioner and ready for payment.</CardDescription>
                </div>
                <Button onClick={payNow} disabled={busy || selected.size === 0}>
                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Create payment {selected.size > 0 ? `(${selected.size})` : ""}
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={pending.length > 0 && selected.size === pending.length} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                    ) : pending.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nothing awaiting payment.</TableCell></TableRow>
                    ) : pending.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} /></TableCell>
                        <TableCell className="font-mono text-xs">{s.tracking_number}</TableCell>
                        <TableCell className="text-sm">{s.student_name_masked}</TableCell>
                        <TableCell className="text-sm">{s.institution_name}</TableCell>
                        <TableCell><Badge variant="secondary">{s.student_type}</Badge></TableCell>
                        <TableCell className="text-right">{formatKES(Number(s.allocated_amount || 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paid">
            <Card>
              <CardHeader>
                <CardTitle>Payment records</CardTitle>
                <CardDescription>Reference, amount and school for every payment made.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>School</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead><TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payments yet.</TableCell></TableRow>
                    ) : payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.payment_reference}</TableCell>
                        <TableCell className="text-sm">{p.school_name}</TableCell>
                        <TableCell className="text-sm">{p.county}</TableCell>
                        <TableCell className="text-right">{formatKES(Number(p.amount))}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(p.completed_at || p.triggered_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {p.status === "pending" || p.status === "processing" ? (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => markProcessed(p.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />Mark processed
                            </Button>
                          ) : <span className="text-xs text-muted-foreground">Complete</span>}
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
