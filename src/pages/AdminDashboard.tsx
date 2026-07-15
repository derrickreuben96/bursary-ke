import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { fetchDashboardStats } from "@/lib/applicationService";
import { adminDashboardData } from "@/lib/mockData";
import { formatKES, formatNumber, formatPercentage } from "@/lib/formatters";
import { maskEmail } from "@/lib/maskData";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useHouseholds } from "@/lib/household/useHouseholds";
import { HouseholdList } from "@/components/household/HouseholdList";
import type { HouseholdAction } from "@/lib/household/workflowEngine";
import { DangerZoneResetCard } from "@/components/admin/DangerZoneResetCard";
import { ResetAuditLogPanel } from "@/components/admin/ResetAuditLogPanel";
import { downloadAiSummaryPdf } from "@/lib/aiSummaryPdf";
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Banknote,
  TrendingUp,
  BarChart3,
  PieChart,
  LogOut,
  Loader2,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

const COLORS = ["hsl(120, 100%, 20%)", "hsl(45, 100%, 50%)", "hsl(350, 81%, 45%)"];

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ title, value, icon, trend, trendUp }: StatCardProps) {
  return (
    <Card className="hover:shadow-kenya transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {trend && (
          <p className={`text-xs mt-1 ${trendUp ? "text-primary" : "text-accent"}`}>
            {trendUp ? "↑" : "↓"} {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type DashboardData = typeof adminDashboardData;

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>(adminDashboardData);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryScope, setSummaryScope] = useState<"system" | "advert">("system");
  const [adverts, setAdverts] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedAdvertId, setSelectedAdvertId] = useState<string>("");
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Track prior totals so background refreshes can surface a non-intrusive
  // toast when new applications arrive instead of silently swapping data.
  const prevTotalRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData(showSpinner = true) {
      if (showSpinner) setIsLoading(true);
      try {
        const data = await fetchDashboardStats();
        if (data && mounted) {
          const prev = prevTotalRef.current;
          if (prev !== null && data.totalApplications > prev) {
            const delta = data.totalApplications - prev;
            toast({
              title: delta === 1 ? "1 new application received" : `${delta} new applications received`,
              description: "Dashboard metrics updated in the background.",
            });
          }
          prevTotalRef.current = data.totalApplications;
          setDashboardData(data);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        if (showSpinner && mounted) setIsLoading(false);
      }
    }
    loadData(true);
    // Silent background polling. Deliberately no visibilitychange handler:
    // returning to the tab should never trigger a spinner or reset the view.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadData(false);
    }, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [toast]);

  // Push-based updates via sanitized broadcast channel (no PII in payload).
  useDashboardRealtime({ kind: "admin" }, () => {
    void fetchDashboardStats().then((d) => d && setDashboardData(d)).catch(() => {});
  });

  const openSummaryDialog = async () => {
    setSummaryOpen(true);
    if (adverts.length === 0) {
      const { data } = await supabase
        .from("bursary_adverts")
        .select("id,title")
        .order("created_at", { ascending: false });
      setAdverts(data ?? []);
    }
  };

  const handleGenerateSummary = async () => {
    if (summaryScope === "advert" && !selectedAdvertId) {
      toast({ title: "Select an advert", description: "Choose an advert to summarise.", variant: "destructive" });
      return;
    }
    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-summary", {
        body: { scope: summaryScope, advert_id: summaryScope === "advert" ? selectedAdvertId : undefined },
      });
      if (error) throw error;
      if (!data?.summary) throw new Error("No summary returned");
      const [{ downloadAiSummaryPdf: download }, { loadLogoDataUrl }] = await Promise.all([
        import("@/lib/aiSummaryPdf"),
        import("@/lib/brandLogo"),
      ]);
      await loadLogoDataUrl().catch(() => {});
      download(data, summaryScope === "advert" ? data.title : "system-overview");
      toast({ title: "Summary ready", description: "Your PDF has been downloaded." });
      setSummaryOpen(false);
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Failed to generate summary";
      toast({ title: "Could not generate summary", description: message, variant: "destructive" });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const {
    totalApplications,
    approvedApplications,
    pendingApplications,
    rejectedApplications,
    totalBudgetDisbursed,
    povertyDistribution,
    applicationsByCounty,
    monthlyTrends,
  } = dashboardData;

  const approvalRate = totalApplications > 0 
    ? (approvedApplications / totalApplications) * 100 
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-secondary/30">
        <Header />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome, {user?.email ? maskEmail(user.email) : "Admin"} | Overview of bursary applications (aggregated data only)
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => navigate("/admin/adverts")}
              className="hover:scale-105 transition-transform"
            >
              <Banknote className="mr-2 h-4 w-4" />
              Manage Adverts
            </Button>
            <Button
              onClick={() => navigate("/admin/disbursements")}
              variant="secondary"
              className="hover:scale-105 transition-transform"
            >
              <Banknote className="mr-2 h-4 w-4" />
              Disbursements (IPN)
            </Button>
            <Button
              onClick={() => navigate("/admin/users")}
              className="hover:scale-105 transition-transform"
            >
              <Users className="mr-2 h-4 w-4" />
              Manage Users
            </Button>
            <Button
              onClick={openSummaryDialog}
              variant="secondary"
              className="hover:scale-105 transition-transform"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              AI PDF Summary
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="hover:scale-105 transition-transform"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard
            title="Total Applications"
            value={formatNumber(totalApplications)}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            title="Approved"
            value={formatNumber(approvedApplications)}
            icon={<CheckCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Pending Review"
            value={formatNumber(pendingApplications)}
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            title="Rejected"
            value={formatNumber(rejectedApplications)}
            icon={<XCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Total Disbursed"
            value={formatKES(totalBudgetDisbursed)}
            icon={<Banknote className="h-5 w-5" />}
          />
        </div>

        {/* Household Statistics — one tracking number = one household */}
        <AdminHouseholdStats />



        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Poverty Distribution Pie Chart */}
          <Card className="hover:shadow-kenya transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChart className="h-5 w-5 text-primary" />
                Poverty Tier Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={povertyDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="tier"
                      label={({ tier, percentage }) => `${tier}: ${percentage}%`}
                    >
                      {povertyDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatNumber(value), "Applications"]}
                    />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Applications by County Bar Chart */}
          <Card className="hover:shadow-kenya transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Applications by County
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={applicationsByCounty} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="county" type="category" width={80} />
                    <Tooltip
                      formatter={(value: number) => [formatNumber(value), "Applications"]}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(120, 100%, 20%)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trends Line Chart */}
        <Card className="hover:shadow-kenya transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Monthly Application Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [formatNumber(value), "Applications"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke="hsl(120, 100%, 20%)"
                    strokeWidth={3}
                    dot={{ fill: "hsl(120, 100%, 20%)", strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: "hsl(350, 81%, 45%)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Notice */}
        <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            <strong className="text-foreground">Privacy Compliant Dashboard:</strong> This dashboard displays only aggregated statistics. 
            No personally identifiable information (PII) such as names, ID numbers, or contact details is visible or accessible.
          </p>
        </div>

        <DangerZoneResetCard onCompleted={() => { void fetchDashboardStats().then((d) => d && setDashboardData(d)); }} />
        <ResetAuditLogPanel />

        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate AI PDF Summary
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                AI analyses aggregated, anonymised data and produces an executive PDF report.
              </p>
              <div>
                <Label>Scope</Label>
                <Select value={summaryScope} onValueChange={(v) => setSummaryScope(v as "system" | "advert")}>
                  <SelectTrigger aria-label="Summary scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">Full system overview</SelectItem>
                    <SelectItem value="advert">Per-advert summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {summaryScope === "advert" && (
                <div>
                  <Label>Bursary advert</Label>
                  <Select value={selectedAdvertId} onValueChange={setSelectedAdvertId}>
                    <SelectTrigger aria-label="Bursary advert">
                      <SelectValue placeholder={adverts.length === 0 ? "Loading..." : "Choose advert"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {adverts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSummaryOpen(false)} disabled={generatingSummary}>
                Cancel
              </Button>
              <Button onClick={handleGenerateSummary} disabled={generatingSummary}>
                {generatingSummary ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" />Generate PDF</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Household statistics tile. Reuses the shared useHouseholds hook so the
 * admin, commissioner and treasury dashboards agree on the household count.
 */



function AdminHouseholdStats() {
  const { households, historyByHouseholdId, loading, pendingNewCount, refresh, acknowledgeNew } =
    useHouseholds({});
  const total = households.length;
  const beneficiaries = households.reduce((n, h) => n + h.students.length, 0);
  const secondary = households.reduce((n, h) => n + h.students.filter(s => s.cohort === "secondary").length, 0);
  const higherEd = households.reduce((n, h) => n + h.students.filter(s => s.cohort === "higher_ed").length, 0);
  const mixed = households.filter(h =>
    h.students.some(s => s.cohort === "secondary") && h.students.some(s => s.cohort === "higher_ed")
  ).length;

  const onAction: (a: HouseholdAction) => void = () => { /* admin read-only */ };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Household Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 text-sm">
          <div><p className="text-muted-foreground">Households</p><p className="text-2xl font-bold">{total}</p></div>
          <div><p className="text-muted-foreground">Beneficiaries</p><p className="text-2xl font-bold">{beneficiaries}</p></div>
          <div><p className="text-muted-foreground">Secondary</p><p className="text-2xl font-bold">{secondary}</p></div>
          <div><p className="text-muted-foreground">Higher Education</p><p className="text-2xl font-bold">{higherEd}</p></div>
          <div><p className="text-muted-foreground">Mixed HHs</p><p className="text-2xl font-bold">{mixed}</p></div>
        </div>
        {loading ? null : (
          <>
            <HouseholdList
              households={households.slice(0, 25)}
              role="admin"
              storageKey="admin.households"
              historyByHouseholdId={historyByHouseholdId}
              onAction={onAction}
              pendingNewCount={pendingNewCount}
              onAcknowledgeNew={acknowledgeNew}
              onRefresh={refresh}
            />
            <div className="mt-6">
              <HouseholdReportPanel households={households} role="admin" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
