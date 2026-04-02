import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  GraduationCap, LogOut, CheckCircle2, XCircle, Clock, 
  Loader2, RefreshCw, AlertTriangle, BarChart3, Users, Banknote,
  ShieldAlert, Star, History, Send, Play, Inbox, Archive, FileDown
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface Application {
  id: string;
  tracking_number: string;
  student_type: string;
  status: string;
  poverty_tier: string;
  ai_decision_reason: string | null;
  allocated_amount: number | null;
  parent_county: string;
  parent_ward: string | null;
  created_at: string;
  is_duplicate: boolean;
  student_name_masked: string;
  parent_name_masked: string;
  poverty_score: number | null;
  household_income: number | null;
  household_dependents: number | null;
  released_to_treasury: boolean;
}

interface StatusHistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
}

interface FairnessInfo {
  applicationId: string;
  isFairnessPriority: boolean;
  historicalStatus: string;
  fraudRiskLevel: string;
  fairnessPriorityScore: number;
  dataConsistencyScore: number;
  consistencyFlags: string[];
}

interface BursaryAdvert {
  id: string;
  title: string;
  county: string;
  ward: string | null;
  deadline: string;
  budget_amount: number | null;
  max_slots: number | null;
  is_active: boolean;
}

interface Stats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  duplicates: number;
  totalAllocated: number;
  fairnessPriorityCandidates: number;
  redFlagged: number;
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];

function AIReasonCell({ reason }: { reason: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!reason) return <span className="text-muted-foreground">—</span>;
  const lines = reason.split("\n").filter(l => l.trim() !== "");
  const firstLine = lines[0] || "";
  const hasMore = lines.length > 1;
  return (
    <div className="space-y-1.5">
      {expanded ? (
        <div className="whitespace-pre-line text-sm leading-relaxed space-y-1 bg-muted/50 rounded-lg p-3 border border-border">
          {lines.map((line, i) => {
            const isHeader = line.startsWith("✅") || line.startsWith("❌") || line.startsWith("📊") || line.startsWith("💡") || line.startsWith("🔄");
            return (
              <p key={i} className={isHeader ? "font-semibold text-foreground" : "text-muted-foreground"}>
                {line}
              </p>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-foreground font-medium">{firstLine}</p>
      )}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-primary hover:underline focus:outline-none"
        >
          {expanded ? "▲ Collapse" : "▼ View full reasoning"}
        </button>
      )}
    </div>
  );
}

export default function CommissionerDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [fairnessMap, setFairnessMap] = useState<Map<string, FairnessInfo>>(new Map());
  const [statusHistory, setStatusHistory] = useState<Record<string, StatusHistoryEntry[]>>({});
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, rejected: 0, pending: 0, duplicates: 0, totalAllocated: 0, fairnessPriorityCandidates: 0, redFlagged: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [activeTab, setActiveTab] = useState("incoming");
  const [assignedWard, setAssignedWard] = useState<string | null>(null);
  const [assignedCounty, setAssignedCounty] = useState<string | null>(null);
  const [wardAdverts, setWardAdverts] = useState<BursaryAdvert[]>([]);
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch assigned ward from profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("assigned_ward, assigned_county")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setAssignedWard(data.assigned_ward);
        setAssignedCounty(data.assigned_county);
      }
    };
    fetchProfile();
  }, [user]);

  // Fetch ward-specific bursary adverts
  useEffect(() => {
    const fetchAdverts = async () => {
      if (!assignedWard && !assignedCounty) return;
      let query = supabase
        .from("bursary_adverts")
        .select("id, title, county, ward, deadline, budget_amount, max_slots, is_active");

      if (assignedWard) {
        query = query.eq("ward", assignedWard);
      } else if (assignedCounty) {
        query = query.eq("county", assignedCounty);
      }

      const { data } = await query;
      setWardAdverts(data || []);
    };
    fetchAdverts();
  }, [assignedWard, assignedCounty]);

  const fetchApplications = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .rpc("get_commissioner_applications");

    if (error) {
      console.error("Error fetching applications:", error);
      toast({ title: "Error", description: "Failed to load applications", variant: "destructive" });
    } else {
      let apps = (data || []).map((d: any) => ({
        ...d,
        parent_county: d.parent_county || '',
        parent_ward: d.parent_ward || null,
        released_to_treasury: d.released_to_treasury || false,
      })) as Application[];

      // Filter by assigned ward (primary) or county (fallback)
      if (assignedWard) {
        apps = apps.filter(a => a.parent_ward === assignedWard);
      } else if (assignedCounty) {
        apps = apps.filter(a => a.parent_county === assignedCounty);
      }
      setApplications(apps);

      // Fetch status history
      if (apps.length > 0) {
        const { data: historyData } = await supabase
          .from("application_status_history")
          .select("id, from_status, to_status, changed_at, application_id")
          .in("application_id", apps.map((a) => a.id))
          .order("changed_at", { ascending: true });

        if (historyData) {
          const grouped = historyData.reduce<Record<string, StatusHistoryEntry[]>>((acc, entry) => {
            const key = (entry as any).application_id as string;
            if (!acc[key]) acc[key] = [];
            acc[key].push(entry as StatusHistoryEntry);
            return acc;
          }, {});
          setStatusHistory(grouped);
        }
      }

      // Fetch fairness tracking data
      const appIds = apps.map(a => a.id).filter(Boolean);
      if (appIds.length > 0) {
        const { data: fairnessData } = await supabase
          .from("fairness_tracking")
          .select("application_id, is_fairness_priority_candidate, historical_status, fraud_risk_level, fairness_priority_score, data_consistency_score, consistency_flags")
          .in("application_id", appIds);

        const fMap = new Map<string, FairnessInfo>();
        (fairnessData || []).forEach((f: any) => {
          fMap.set(f.application_id, {
            applicationId: f.application_id,
            isFairnessPriority: f.is_fairness_priority_candidate,
            historicalStatus: f.historical_status,
            fraudRiskLevel: f.fraud_risk_level,
            fairnessPriorityScore: f.fairness_priority_score,
            dataConsistencyScore: f.data_consistency_score ?? 100,
            consistencyFlags: f.consistency_flags ?? [],
          });
        });
        setFairnessMap(fMap);

        const fairnessPriorityCandidates = apps.filter(a => fMap.get(a.id)?.isFairnessPriority).length;
        const redFlagged = apps.filter(a => fMap.get(a.id)?.historicalStatus === "red_flagged").length;

        setStats({
          total: apps.length,
          approved: apps.filter(a => a.status === "approved").length,
          rejected: apps.filter(a => a.status === "rejected").length,
          pending: apps.filter(a => ["received", "review", "verification"].includes(a.status)).length,
          duplicates: apps.filter(a => a.is_duplicate).length,
          totalAllocated: apps.reduce((sum, a) => sum + (a.allocated_amount || 0), 0),
          fairnessPriorityCandidates,
          redFlagged,
        });
      } else {
        setStats({ total: 0, approved: 0, rejected: 0, pending: 0, duplicates: 0, totalAllocated: 0, fairnessPriorityCandidates: 0, redFlagged: 0 });
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (assignedWard || assignedCounty) {
      fetchApplications();
    }
  }, [assignedWard, assignedCounty]);

  // Real-time subscription for incoming applications
  useEffect(() => {
    const channel = supabase
      .channel("commissioner-incoming")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bursary_applications" },
        () => {
          fetchApplications();
          toast({ title: "New Application", description: "A new application has been submitted to your ward." });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bursary_applications" },
        () => fetchApplications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [assignedWard, assignedCounty]);

  // Check if any advert deadline has passed
  const deadlinePassed = useMemo(() => {
    return wardAdverts.some(a => new Date(a.deadline) <= new Date());
  }, [wardAdverts]);

  const activeAdvert = useMemo(() => {
    return wardAdverts.find(a => a.is_active);
  }, [wardAdverts]);

  const hasUnreleasedApproved = useMemo(() => {
    return applications.some(a => a.status === "approved" && !a.released_to_treasury);
  }, [applications]);

  // Process applications (trigger allocation after deadline)
  const handleProcessApplications = async () => {
    if (!activeAdvert) {
      toast({ title: "No Advert", description: "No active bursary advert found for your ward.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // First run fairness evaluation
      await supabase.functions.invoke("fairness-engine", {
        body: { action: "evaluate", advertId: activeAdvert.id },
      });

      // Then trigger allocation
      const { data, error } = await supabase.functions.invoke("process-allocations", {
        body: { 
          advertId: activeAdvert.id, 
          budgetAmount: activeAdvert.budget_amount,
          ...(activeAdvert.max_slots ? { maxSlots: activeAdvert.max_slots } : {}),
        },
      });

      if (error) throw error;

      toast({
        title: "Processing Complete",
        description: data?.message || "Applications have been processed successfully.",
      });
      fetchApplications();
    } catch (error) {
      console.error("Processing error:", error);
      toast({ title: "Processing Failed", description: "Could not process applications. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Release approved applications to treasury
  const handleReleaseToTreasury = async () => {
    const approvedIds = applications
      .filter(a => a.status === "approved" && !a.released_to_treasury)
      .map(a => a.id);

    if (approvedIds.length === 0) {
      toast({ title: "Nothing to Release", description: "No approved applications pending release.", variant: "destructive" });
      return;
    }

    setIsReleasing(true);
    try {
      const { error } = await supabase
        .from("bursary_applications")
        .update({ released_to_treasury: true })
        .in("id", approvedIds);

      if (error) throw error;

      // Trigger SMS notifications for approved applicants
      try {
        await supabase.functions.invoke("send-sms-notifications", {
          body: { trigger: "release_to_treasury" },
        });
      } catch (smsErr) {
        console.error("SMS notification error (non-blocking):", smsErr);
      }

      toast({
        title: "Released to Treasury",
        description: `${approvedIds.length} approved application(s) sent to County Treasury for disbursement. Treasury has been notified.`,
      });
      fetchApplications();
    } catch (error) {
      console.error("Release error:", error);
      toast({ title: "Release Failed", description: "Could not release applications to treasury.", variant: "destructive" });
    } finally {
      setIsReleasing(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const statusData = [
    { name: "Approved", value: stats.approved },
    { name: "Rejected", value: stats.rejected },
    { name: "Pending", value: stats.pending },
    { name: "Duplicates", value: stats.duplicates },
  ].filter(d => d.value > 0);

  const getStatusBadge = (status: string, isDuplicate: boolean) => {
    if (isDuplicate) return <Badge variant="outline" className="bg-muted text-muted-foreground">Duplicate</Badge>;
    switch (status) {
      case "approved": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      case "received": case "review": case "verification":
        return <Badge variant="secondary">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const incomingApps = applications.filter(a => ["received", "review", "verification"].includes(a.status) && !a.is_duplicate);
  const approvedApps = applications.filter(a => a.status === "approved" && !a.is_duplicate);
  const rejectedApps = applications.filter(a => a.status === "rejected" || a.is_duplicate);

  const renderAppTable = (apps: Application[], showAmount = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking #</TableHead>
          <TableHead>Student</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Ward</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Fairness</TableHead>
          <TableHead>Fraud Risk</TableHead>
          {showAmount && <TableHead>Amount</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="min-w-[320px]">AI Decision Reasoning</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {apps.map((app) => {
          const f = fairnessMap.get(app.id);
          return (
            <React.Fragment key={app.id}>
              <TableRow>
                <TableCell className="font-mono text-xs">{app.tracking_number}</TableCell>
                <TableCell className="text-sm">{app.student_name_masked}</TableCell>
                <TableCell className="capitalize text-sm">{app.student_type}</TableCell>
                <TableCell className="text-sm">{app.parent_ward || app.parent_county}</TableCell>
                <TableCell><Badge variant="outline">{app.poverty_tier}</Badge></TableCell>
                <TableCell>
                  {f?.isFairnessPriority ? (
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      <Star className="h-3 w-3 mr-1" />+{f.fairnessPriorityScore}
                    </Badge>
                  ) : f?.historicalStatus === "returning_funded" ? (
                    <Badge variant="outline" className="text-amber-600"><History className="h-3 w-3 mr-1" />Returning</Badge>
                  ) : (
                    <Badge variant="secondary">New</Badge>
                  )}
                  {f?.dataConsistencyScore !== undefined && f.dataConsistencyScore < 90 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs mt-1">
                      ⚠ Consistency {f.dataConsistencyScore}%
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={f?.fraudRiskLevel === "high" ? "destructive" : f?.fraudRiskLevel === "medium" ? "secondary" : "outline"}>
                    {f?.fraudRiskLevel || "low"}
                  </Badge>
                </TableCell>
                {showAmount && (
                  <TableCell className="font-medium">KES {(app.allocated_amount || 0).toLocaleString()}</TableCell>
                )}
                <TableCell>{getStatusBadge(app.status, app.is_duplicate)}</TableCell>
                <TableCell className="min-w-[320px]">
                  <AIReasonCell reason={app.ai_decision_reason} />
                </TableCell>
              </TableRow>
              {statusHistory[app.id]?.length > 0 && (
                <TableRow>
                  <TableCell colSpan={showAmount ? 10 : 9} className="py-1 px-6">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Status History</p>
                      {statusHistory[app.id].map((entry) => (
                        <p key={entry.id} className="text-xs text-muted-foreground">
                          {entry.from_status ?? "submitted"} → {entry.to_status}{" "}
                          <span className="opacity-60">
                            {new Date(entry.changed_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </p>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <GraduationCap className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">County Education Commissioner</h1>
              <p className="text-muted-foreground">
                {assignedWard ? `Ward: ${assignedWard}` : ""} 
                {assignedCounty ? ` | County: ${assignedCounty}` : ""} 
                {" "}| Masked Data View
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchApplications}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />Logout
            </Button>
          </div>
        </div>

        {/* Deadline & Action Banner */}
        {activeAdvert && (
          <Card className="mb-6 border-blue-200 dark:border-blue-800">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">{activeAdvert.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Deadline: {new Date(activeAdvert.deadline).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
                    {activeAdvert.budget_amount && ` | Budget: KES ${activeAdvert.budget_amount.toLocaleString()}`}
                  </p>
                  {!deadlinePassed && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Application window is still open. Processing will be available after the deadline.
                    </p>
                  )}
                  {deadlinePassed && stats.pending > 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      <CheckCircle2 className="h-3 w-3 inline mr-1" />
                      Deadline has passed. You can now process {stats.pending} pending application(s).
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={handleProcessApplications}
                    disabled={!deadlinePassed || stats.pending === 0 || isProcessing}
                    variant={!deadlinePassed ? "outline" : "default"}
                    className={!deadlinePassed 
                      ? "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-60" 
                      : "bg-blue-600 hover:bg-blue-700"}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                    ) : (
                      <><Play className="h-4 w-4 mr-2" />Process Applications</>
                    )}
                  </Button>
                  <Button
                    onClick={handleReleaseToTreasury}
                    disabled={!hasUnreleasedApproved || isReleasing}
                    variant="default"
                  >
                    {isReleasing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Releasing...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" />Release to Treasury</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />Total</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2"><Inbox className="h-4 w-4" />Incoming</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{stats.pending}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Approved</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{stats.approved}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2"><XCircle className="h-4 w-4" />Rejected</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{stats.rejected}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2"><Banknote className="h-4 w-4" />Allocated</CardTitle></CardHeader>
            <CardContent><div className="text-lg font-bold text-blue-600">KES {stats.totalAllocated.toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2"><Star className="h-4 w-4" />Fairness</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-purple-600">{stats.fairnessPriorityCandidates}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Red Flagged</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{stats.redFlagged}</div></CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="incoming"><Inbox className="h-4 w-4 mr-2" />Incoming ({stats.pending})</TabsTrigger>
            <TabsTrigger value="summary"><BarChart3 className="h-4 w-4 mr-2" />Summary</TabsTrigger>
            <TabsTrigger value="approved"><CheckCircle2 className="h-4 w-4 mr-2" />Approved ({stats.approved})</TabsTrigger>
            <TabsTrigger value="rejected"><XCircle className="h-4 w-4 mr-2" />Rejected ({stats.rejected + stats.duplicates})</TabsTrigger>
            <TabsTrigger value="archive"><Archive className="h-4 w-4 mr-2" />Audit Archive</TabsTrigger>
          </TabsList>

          {/* Incoming Applications Tab */}
          <TabsContent value="incoming">
            <Card>
              <CardHeader>
                <CardTitle>Incoming Applications</CardTitle>
                <CardDescription>
                  Applications received for your ward. All personal data is masked for fraud prevention.
                  {!deadlinePassed && " Processing will be available after the bursary deadline."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : incomingApps.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending applications for your ward</p>
                  </div>
                ) : renderAppTable(incomingApps)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Application Distribution</CardTitle>
                  <CardDescription>Overview of all application statuses</CardDescription>
                </CardHeader>
                <CardContent>
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100} fill="#8884d8" dataKey="value">
                          {statusData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Allocation Summary</CardTitle>
                  <CardDescription>Automated decision statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-700 dark:text-green-400">Successful Allocations</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {stats.approved} students approved based on poverty assessment and fairness scoring.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-700 dark:text-red-400">Non-Successful</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {stats.rejected} applications not approved due to budget constraints or lower priority.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Duplicates</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{stats.duplicates} duplicate applications discarded.</p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-purple-700 dark:text-purple-400">Fairness Continuity</span>
                    </div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">
                      {stats.fairnessPriorityCandidates} previously unfunded applicants received priority boost.
                      {stats.redFlagged > 0 && ` ${stats.redFlagged} excluded due to red flags.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Approved Tab */}
          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Approved Applications</CardTitle>
                    <CardDescription>Applications approved by AI allocation system</CardDescription>
                  </div>
                  {hasUnreleasedApproved && (
                    <Button onClick={handleReleaseToTreasury} disabled={isReleasing}>
                      {isReleasing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Release to Treasury
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : approvedApps.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No approved applications yet</div>
                ) : renderAppTable(approvedApps, true)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rejected Tab */}
          <TabsContent value="rejected">
            <Card>
              <CardHeader>
                <CardTitle>Non-Successful Applications</CardTitle>
                <CardDescription>Applications rejected with AI reasoning</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : rejectedApps.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No rejected applications</div>
                ) : renderAppTable(rejectedApps)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Archive Tab */}
          <TabsContent value="archive">
            <Card>
              <CardHeader>
                <CardTitle>Audit Archive</CardTitle>
                <CardDescription>
                  All processed applications are retained here for audit and future reference. 
                  Data remains masked to ensure anonymity and prevent fraud.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : applications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No archived data available</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                      Total records: {applications.length} | 
                      Approved: {stats.approved} | 
                      Rejected: {stats.rejected} | 
                      Released to Treasury: {applications.filter(a => a.released_to_treasury).length}
                    </div>
                    {renderAppTable(applications, true)}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Security Notice:</strong> All personal data is masked to prevent fraud and ensure anonymity. 
            Application data cannot be edited. Processing is only available after the bursary deadline. 
            All actions are logged for audit compliance.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
