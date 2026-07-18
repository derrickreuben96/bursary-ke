import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_POLICY_PROFILE } from "@/lib/ai/policyProfile";
import { featureFlags } from "@/lib/featureFlags";
import { Seo } from "@/components/seo/Seo";

interface PolicyRow {
  id: string;
  name: string;
  version: string;
  status: "draft" | "pending" | "active" | "archived";
  reason: string | null;
  change_summary: string | null;
  created_at: string;
  activated_at: string | null;
  body: unknown;
}

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-200 text-slate-700",
};

export default function PolicyAdministration() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", version: "", change_summary: "", reason: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("policy_profiles" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load policies", description: error.message, variant: "destructive" });
    setRows((data as PolicyRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  if (!featureFlags.governance) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <h1 className="text-2xl font-bold">Governance module disabled</h1>
          <p className="text-muted-foreground mt-2">Enable VITE_FF_GOVERNANCE to activate.</p>
          <Button className="mt-6" onClick={() => navigate("/admin")}>Back to Admin</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const createDraft = async () => {
    if (!form.name || !form.version) {
      toast({ title: "Missing fields", description: "Name and version are required.", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("policy_profiles" as never).insert({
      name: form.name,
      version: form.version,
      body: DEFAULT_POLICY_PROFILE as unknown as object,
      status: "draft",
      reason: form.reason || null,
      change_summary: form.change_summary || null,
      created_by: user?.id ?? null,
    } as never);
    if (error) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ name: "", version: "", change_summary: "", reason: "" });
    void load();
    toast({ title: "Draft policy created" });
  };

  const transition = async (row: PolicyRow, next: PolicyRow["status"]) => {
    const patch: Record<string, unknown> = { status: next };
    if (next === "active") {
      // Archive the current active profile with the same name.
      await supabase
        .from("policy_profiles" as never)
        .update({ status: "archived", archived_at: new Date().toISOString() } as never)
        .eq("name", row.name)
        .eq("status", "active");
      patch.activated_at = new Date().toISOString();
    }
    if (next === "archived") patch.archived_at = new Date().toISOString();
    const { error } = await supabase
      .from("policy_profiles" as never)
      .update(patch as never)
      .eq("id", row.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    void supabase.from("policy_audit_log" as never).insert({
      policy_id: row.id, action: next, diff: { from: row.status, to: next },
    } as never);
    void load();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Seo title="Policy Administration — Bursary KE" description="Manage AI policy versions" path="/admin/governance/policies" />
      <Header />
      <main className="flex-1 container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Policy Administration</h1>
            <p className="text-muted-foreground">Version, review and activate AI decision policies.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/governance")}>Back</Button>
            <Button onClick={() => setOpen(true)}>New draft</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Policy versions</CardTitle>
            <CardDescription>Every recommendation is logged with the version that produced it.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No policies yet — the built-in default is in use.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Change summary</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.version}</TableCell>
                      <TableCell>
                        <Badge className={statusColor[r.status]}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">{r.change_summary || "—"}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {r.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => transition(r, "pending")}>Submit</Button>
                        )}
                        {r.status === "pending" && (
                          <Button size="sm" onClick={() => transition(r, "active")}>Approve & activate</Button>
                        )}
                        {r.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => transition(r, "archived")}>Archive</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New policy draft</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Version</Label><Input placeholder="4.1.0" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
            <div><Label>Change summary</Label><Textarea rows={2} value={form.change_summary} onChange={(e) => setForm({ ...form, change_summary: e.target.value })} /></div>
            <div><Label>Reason for change</Label><Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">The draft copies the current default weights. Advanced weight editing coming in Phase 6A.2.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createDraft}>Create draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
