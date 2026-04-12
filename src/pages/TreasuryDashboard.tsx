import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Landmark, LogOut, Search, Download, 
  Loader2, RefreshCw, Copy, FileText, CheckCircle2
} from "lucide-react";
import { TreasurySummaryCards } from "@/components/treasury/TreasurySummaryCards";

interface ApprovedApplication {
  id: string;
  tracking_number: string;
  student_name_masked: string;
  institution_name: string;
  student_type: string;
  status: string;
  allocated_amount: number;
  ecitizen_ref: string;
  county: string;
  allocation_date: string;
}

export default function TreasuryDashboard() {
  const [applications, setApplications] = useState<ApprovedApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [assignedCounty, setAssignedCounty] = useState<string | null>(null);
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("assigned_county")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setAssignedCounty(data.assigned_county);
    };
    fetchProfile();
  }, [user]);

  const fetchApprovedApplications = async () => {
    setIsLoading(true);
    // Use server-side RPC that enforces county filtering at database level
    const { data, error } = await supabase.rpc("get_treasury_applications");

    if (error) {
      console.error("Error fetching applications:", error);
      toast({ title: "Error", description: "Failed to load approved applications", variant: "destructive" });
    } else {
      setApplications((data as ApprovedApplication[]) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (assignedCounty) fetchApprovedApplications();

    const channel = supabase
      .channel("treasury-applications")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bursary_applications" },
        (payload) => {
          const newRecord = payload.new as any;
          if (newRecord?.released_to_treasury === true && newRecord?.status === "approved") {
            toast({ title: "🔔 New Applications Released", description: "The Commissioner has released new approved applications.", duration: 10000 });
          }
          fetchApprovedApplications();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [assignedCounty]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const copyEcitizenRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast({ title: "Copied", description: "eCitizen reference copied to clipboard" });
  };

  const [disbursingIds, setDisbursingIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; mode: "single" | "bulk"; app?: ApprovedApplication }>({ open: false, mode: "single" });

  const sendDisbursementNotifications = async () => {
    try {
      await supabase.functions.invoke("send-sms-notifications", {
        body: { trigger: "disbursement" },
      });
    } catch (err) {
      console.error("Disbursement notification error:", err);
    }
  };

  const executeDisbursement = async (app: ApprovedApplication) => {
    setDisbursingIds(prev => new Set(prev).add(app.id));
    try {
      const { data, error } = await supabase
        .from("bursary_applications")
        .update({ status: "disbursed" as any })
        .eq("id", app.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Update was blocked by access policy. Please try logging in again.");

      toast({ title: "✅ Marked as Disbursed", description: `${app.tracking_number} has been marked as disbursed.` });
      sendDisbursementNotifications();
      fetchApprovedApplications();
    } catch (err) {
      console.error("Disbursement error:", err);
      toast({ title: "Error", description: "Failed to mark as disbursed", variant: "destructive" });
    } finally {
      setDisbursingIds(prev => {
        const next = new Set(prev);
        next.delete(app.id);
        return next;
      });
    }
  };

  const executeBulkDisbursement = async () => {
    const pendingApps = applications.filter(a => a.status === "approved");
    if (pendingApps.length === 0) return;

    const ids = pendingApps.map(a => a.id);
    setDisbursingIds(new Set(ids));
    try {
      const { error } = await supabase
        .from("bursary_applications")
        .update({ status: "disbursed" as any })
        .in("id", ids);

      if (error) throw error;

      toast({ title: "✅ All Marked as Disbursed", description: `${pendingApps.length} applications marked as disbursed.` });
      sendDisbursementNotifications();
      fetchApprovedApplications();
    } catch (err) {
      console.error("Bulk disbursement error:", err);
      toast({ title: "Error", description: "Failed to mark applications as disbursed", variant: "destructive" });
    } finally {
      setDisbursingIds(new Set());
    }
  };

  const handleConfirmDisburse = () => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
    if (confirmDialog.mode === "single" && confirmDialog.app) {
      executeDisbursement(confirmDialog.app);
    } else {
      executeBulkDisbursement();
    }
  };

  const filteredApplications = applications.filter(app =>
    app.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.institution_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.county?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = applications.reduce((sum, app) => sum + (app.allocated_amount || 0), 0);

  const exportToCSV = async () => {
    const appIds = applications.map(a => a.id).filter(Boolean);
    let fairnessStats = { firstTime: 0, repeatUnfunded: 0, repeatFunded: 0, priorityAdjusted: 0 };
    
    if (appIds.length > 0) {
      const { data: fairnessData } = await supabase
        .from("fairness_tracking")
        .select("historical_status, priority_boost_applied")
        .in("application_id", appIds);

      if (fairnessData) {
        fairnessStats = {
          firstTime: fairnessData.filter(f => f.historical_status === "new").length,
          repeatUnfunded: fairnessData.filter(f => f.historical_status === "returning_unfunded").length,
          repeatFunded: fairnessData.filter(f => f.historical_status === "returning_funded").length,
          priorityAdjusted: fairnessData.filter(f => f.priority_boost_applied).length,
        };
      }
    }

    const headers = ["Tracking Number", "Institution", "Type", "Amount (KES)", "eCitizen Ref", "County", "Date"];
    const rows = applications.map(app => [
      app.tracking_number, app.institution_name, app.student_type,
      app.allocated_amount?.toString() || "0", app.ecitizen_ref || "",
      app.county, app.allocation_date ? new Date(app.allocation_date).toLocaleDateString() : ""
    ]);

    const fairnessSection = [
      [], ["FAIRNESS DISTRIBUTION REPORT"],
      ["First-time beneficiaries", fairnessStats.firstTime.toString()],
      ["Repeat applicants (previously unfunded)", fairnessStats.repeatUnfunded.toString()],
      ["Repeat applicants (previously funded)", fairnessStats.repeatFunded.toString()],
      ["Priority-adjusted cases", fairnessStats.priorityAdjusted.toString()],
    ];

    const csv = [headers, ...rows, ...fairnessSection].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `treasury-disbursements-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Disbursement list with fairness report exported to CSV" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Landmark className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">County Treasury Portal</h1>
              <p className="text-muted-foreground">
                {assignedCounty ? `${assignedCounty} County` : ""} | Approved Bursary Disbursements
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
            <Button variant="outline" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
          </div>
        </div>

        <TreasurySummaryCards totalApproved={applications.length} totalAmount={totalAmount} disbursedCount={applications.filter(a => a.status === "disbursed").length} />

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle>Approved Applications</CardTitle>
                <CardDescription>Applications ready for fund disbursement via eCitizen</CardDescription>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                {applications.some(a => a.status === "approved") && (
                  <Button size="sm" onClick={() => setConfirmDialog({ open: true, mode: "bulk" })} disabled={disbursingIds.size > 0}>
                    {disbursingIds.size > 0 ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Mark All Disbursed
                  </Button>
                )}
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search applications..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Button variant="outline" size="icon" onClick={fetchApprovedApplications}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filteredApplications.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No approved applications found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                   <TableHeader>
                    <TableRow>
                      <TableHead>Tracking #</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                      <TableHead>eCitizen Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-mono font-medium">{app.tracking_number}</TableCell>
                        <TableCell>{app.institution_name}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{app.student_type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={app.status === "disbursed" ? "default" : "outline"} className={app.status === "disbursed" ? "bg-emerald-600" : ""}>
                            {app.status === "disbursed" ? "Disbursed" : "Approved"}
                          </Badge>
                        </TableCell>
                        <TableCell>{app.county}</TableCell>
                        <TableCell className="text-right font-medium">{(app.allocated_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">{app.ecitizen_ref || "—"}</code>
                            {app.ecitizen_ref && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyEcitizenRef(app.ecitizen_ref)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {app.allocation_date ? new Date(app.allocation_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          {app.status === "approved" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmDialog({ open: true, mode: "single", app })}
                              disabled={disbursingIds.has(app.id)}
                            >
                              {disbursingIds.has(app.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Disburse
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Done</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Security Notice:</strong> This data is for official County Treasury use only. 
            All access is logged and audited. Student names are masked for privacy compliance.
          </p>
        </div>

        <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Disbursement</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog.mode === "single" && confirmDialog.app
                  ? `Are you sure you want to mark ${confirmDialog.app.tracking_number} (KES ${(confirmDialog.app.allocated_amount || 0).toLocaleString()}) as disbursed? This action cannot be undone.`
                  : `Are you sure you want to mark all ${applications.filter(a => a.status === "approved").length} pending applications as disbursed? This action cannot be undone.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDisburse}>
                Confirm Disbursement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
      <Footer />
    </div>
  );
}
