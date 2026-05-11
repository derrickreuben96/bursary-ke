import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { supabase } from "@/integrations/supabase/client";
import {
  Landmark, LogOut, Search, Download,
  Loader2, RefreshCw, Copy, FileText, CheckCircle2, Sparkles, FileDown,
  Layers, Lock, ShieldCheck, Users
} from "lucide-react";
import { TreasurySummaryCards } from "@/components/treasury/TreasurySummaryCards";
import { generateAiSummaryPdf, aiSummaryPdfFilename, type AiSummaryPayload } from "@/lib/aiSummaryPdf";
import { buildChartSummaryDoc, chartSummaryPdfFilename, type ChartPdfPayload } from "@/lib/chartSummaryPdf";
import { AiPdfConsentDialog } from "@/components/ai/AiPdfConsentDialog";
import { AiPdfPreviewDialog } from "@/components/ai/AiPdfPreviewDialog";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  advert_id: string | null;
  advert_title: string | null;
  advert_deadline: string | null;
  advert_ward: string | null;
  advert_budget: number | null;
  poverty_tier: string | null;
  poverty_score: number | null;
}

interface Cycle {
  advertId: string;
  title: string;
  ward: string | null;
  deadline: string | null;
  budget: number | null;
  apps: ApprovedApplication[];
  totalAmount: number;
  pendingCount: number;
  disbursedCount: number;
  povertyDist: Record<string, number>;
}

const ACK_STORAGE_KEY_PREFIX = "treasury.acknowledgedCycles.v2";
const ackKeyFor = (userId: string | null | undefined) =>
  `${ACK_STORAGE_KEY_PREFIX}:${userId ?? "anon"}`;

interface AckRecord {
  cycleId: string;
  acknowledgedAt: string;
  byUserId: string | null;
}

export default function TreasuryDashboard() {
  const [applications, setApplications] = useState<ApprovedApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [wardFilter, setWardFilter] = useState<string>("all");
  const [assignedCounty, setAssignedCounty] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [dataLastFetched, setDataLastFetched] = useState<Date | null>(null);
  const [pdfLanguage, setPdfLanguage] = useState<"en" | "sw">("en");
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"ai" | "chart" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiPayload, setAiPayload] = useState<AiSummaryPayload | null>(null);
  const [chartPreviewOpen, setChartPreviewOpen] = useState(false);
  const [chartPayload, setChartPayload] = useState<ChartPdfPayload | null>(null);
  // Cycle-based flow state
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [acknowledgments, setAcknowledgments] = useState<Record<string, AckRecord>>({});
  const [ackDialogCycleId, setAckDialogCycleId] = useState<string | null>(null);
  const [ackChecked, setAckChecked] = useState(false);
  // Cycle PDF preview gate (Step 1 of acknowledge flow)
  const [cyclePreviewOpenId, setCyclePreviewOpenId] = useState<string | null>(null);
  const [cyclePreviewPayload, setCyclePreviewPayload] = useState<ChartPdfPayload | null>(null);
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const { language: uiLanguage } = useI18n();
  const navigate = useNavigate();

  // Load per-user acknowledgments from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ackKeyFor(user?.id));
      setAcknowledgments(raw ? (JSON.parse(raw) as Record<string, AckRecord>) : {});
    } catch {
      setAcknowledgments({});
    }
  }, [user?.id]);

  const persistAck = (next: Record<string, AckRecord>) => {
    setAcknowledgments(next);
    try { localStorage.setItem(ackKeyFor(user?.id), JSON.stringify(next)); } catch { /* noop */ }
  };

  useEffect(() => { setPdfLanguage(uiLanguage); }, [uiLanguage]);

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
    setDataLastFetched(new Date());
    setIsLoading(false);
  };

  useEffect(() => {
    if (!assignedCounty) return;
    fetchApprovedApplications();

    // Polling fallback — PII tables are excluded from Supabase realtime by policy.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchApprovedApplications();
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchApprovedApplications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [assignedCounty]);

  // Push-based updates: sanitized broadcast scoped to this treasury's county.
  useDashboardRealtime(
    assignedCounty ? { kind: "treasury", county: assignedCounty } : null,
    () => { void fetchApprovedApplications(); },
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const buildAppliedFilters = () => [
    {
      label: pdfLanguage === "sw" ? "Kaunti Iliyokabidhiwa" : "Assigned County",
      value: assignedCounty ?? "—",
    },
    {
      label: pdfLanguage === "sw" ? "Neno la Utafutaji" : "Search Term",
      value: searchTerm.trim().length ? searchTerm.trim() : "—",
    },
    {
      label: pdfLanguage === "sw" ? "Lugha ya Ripoti" : "Report Language",
      value: pdfLanguage === "sw" ? "Kiswahili" : "English",
    },
  ];

  const runGenerateAiSummary = async () => {
    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-summary", {
        body: { scope: "treasury" },
      });
      if (error) throw error;
      if (!data?.summary) throw new Error("No summary returned");
      const jurisdiction = assignedCounty
        ? (pdfLanguage === "sw" ? `Kaunti ya ${assignedCounty}` : `${assignedCounty} County`)
        : (pdfLanguage === "sw" ? "Kaunti haijachaguliwa" : "Unassigned county");
      const freshnessTime = (dataLastFetched ?? new Date()).toLocaleString(
        pdfLanguage === "sw" ? "sw-KE" : "en-KE",
        { dateStyle: "medium", timeStyle: "short" },
      );
      const freshnessLabel = pdfLanguage === "sw"
        ? `Picha ya data · ${freshnessTime} (EAT)`
        : `Live data snapshot · ${freshnessTime} (EAT)`;
      const payload: AiSummaryPayload = {
        ...data,
        footer: {
          scopeLabel: pdfLanguage === "sw" ? "Ripoti ya Hazina ya Kaunti" : "Treasury County Disbursement Report",
          jurisdiction,
          dataFreshness: freshnessLabel,
          portalName: "Bursary-KE · Treasury Portal",
          language: pdfLanguage,
        },
      };
      setAiPayload(payload);
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Failed to generate summary";
      toast({ title: "Could not generate summary", description: message, variant: "destructive" });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleGenerateAiSummary = () => {
    setPendingAction("ai");
    setConsentOpen(true);
  };

  const buildChartPayload = (): ChartPdfPayload => {
    const totalAmt = filteredApplications.reduce((s, a) => s + (a.allocated_amount || 0), 0);
    const disbursedCount = filteredApplications.filter(a => a.status === "disbursed").length;
    const pendingCount = filteredApplications.filter(a => a.status === "approved").length;
    const disbursedAmt = filteredApplications.filter(a => a.status === "disbursed").reduce((s, a) => s + (a.allocated_amount || 0), 0);
    const pendingAmt = totalAmt - disbursedAmt;

    const topInstitutionsMap = new Map<string, number>();
    for (const app of filteredApplications) {
      if (!app.institution_name) continue;
      topInstitutionsMap.set(app.institution_name, (topInstitutionsMap.get(app.institution_name) || 0) + (app.allocated_amount || 0));
    }
    const topInstitutions = Array.from(topInstitutionsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      title: pdfLanguage === "sw" ? "Muhtasari wa Mgawanyo wa Hazina" : "Treasury Disbursement Summary",
      subtitle: assignedCounty
        ? (pdfLanguage === "sw" ? `Kaunti ya ${assignedCounty}` : `${assignedCounty} County`)
        : "—",
      portalName: "Bursary-KE · Treasury Portal",
      scopeLabel: pdfLanguage === "sw" ? "Ripoti ya Hazina ya Kaunti" : "Treasury County Report",
      language: pdfLanguage,
      appliedFilters: buildAppliedFilters(),
      sections: [
        {
          heading: pdfLanguage === "sw" ? "Muhtasari wa Maombi" : "Application Summary",
          rows: [
            { label: pdfLanguage === "sw" ? "Maombi Yaliyochujwa" : "Filtered Applications", value: filteredApplications.length },
            { label: pdfLanguage === "sw" ? "Yameidhinishwa (Yanasubiri)" : "Approved (Pending Disbursement)", value: pendingCount },
            { label: pdfLanguage === "sw" ? "Yamegawanywa" : "Disbursed", value: disbursedCount },
          ],
        },
        {
          heading: pdfLanguage === "sw" ? "Muhtasari wa Fedha (KES)" : "Financial Summary (KES)",
          rows: [
            { label: pdfLanguage === "sw" ? "Jumla Iliyotengwa" : "Total Allocated", value: totalAmt.toLocaleString() },
            { label: pdfLanguage === "sw" ? "Imegawanywa" : "Disbursed", value: disbursedAmt.toLocaleString() },
            { label: pdfLanguage === "sw" ? "Inasubiri" : "Pending", value: pendingAmt.toLocaleString() },
          ],
        },
        ...(topInstitutions.length ? [{
          heading: pdfLanguage === "sw" ? "Taasisi 5 za Juu kwa Kiasi" : "Top 5 Institutions by Amount",
          rows: topInstitutions.map(([name, amt]) => ({ label: name, value: `KES ${amt.toLocaleString()}` })),
        }] : []),
      ],
    };
  };

  const runDownloadChartPdf = () => {
    setChartPayload(buildChartPayload());
    setChartPreviewOpen(true);
  };

  const handleDownloadDisbursementChartPdf = () => {
    setPendingAction("chart");
    setConsentOpen(true);
  };

  const handleConsentConfirmed = () => {
    setConsentOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    if (action === "ai") runGenerateAiSummary();
    else if (action === "chart") runDownloadChartPdf();
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
      const { data, error } = await supabase
        .from("bursary_applications")
        .update({ status: "disbursed" as any })
        .in("id", ids)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Update was blocked by access policy. Please try logging in again.");

      toast({ title: "✅ All Marked as Disbursed", description: `${data.length} applications marked as disbursed.` });
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
    app.county?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (app.advert_title || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = applications.reduce((sum, app) => sum + (app.allocated_amount || 0), 0);

  // Group applications by cycle (advert_id)
  const cycles: Cycle[] = useMemo(() => {
    const map = new Map<string, Cycle>();
    for (const app of filteredApplications) {
      const key = app.advert_id || "unassigned";
      if (!map.has(key)) {
        map.set(key, {
          advertId: key,
          title: app.advert_title || "Unlinked Cycle",
          ward: app.advert_ward,
          deadline: app.advert_deadline,
          budget: app.advert_budget,
          apps: [],
          totalAmount: 0,
          pendingCount: 0,
          disbursedCount: 0,
          povertyDist: {},
        });
      }
      const c = map.get(key)!;
      c.apps.push(app);
      c.totalAmount += app.allocated_amount || 0;
      if (app.status === "disbursed") c.disbursedCount++;
      else if (app.status === "approved") c.pendingCount++;
      const tier = app.poverty_tier || "Unscored";
      c.povertyDist[tier] = (c.povertyDist[tier] || 0) + 1;
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredApplications]);

  const selectedCycle = cycles.find((c) => c.advertId === selectedCycleId) || null;
  const ackDialogCycle = cycles.find((c) => c.advertId === ackDialogCycleId) || null;

  const isAcknowledged = (cycleId: string) => Boolean(acknowledgments[cycleId]);
  const ackInfoFor = (cycleId: string) => acknowledgments[cycleId] ?? null;

  // Detect cycles where any pending applicant is missing required poverty score data.
  const cycleHasMissingScores = (cycle: Cycle) =>
    cycle.apps.some(
      (a) =>
        a.status === "approved" &&
        (a.poverty_score === null || a.poverty_score === undefined || !a.poverty_tier),
    );

  const buildCyclePdfPayload = (cycle: Cycle): ChartPdfPayload => {
    const sortedTiers = Object.entries(cycle.povertyDist).sort((a, b) => b[1] - a[1]);
    // Defensive: only include applicants in approved/disbursed status (RPC already filters,
    // but we re-assert here so the printed PDF matches the disbursable scope exactly).
    const eligibleApps = cycle.apps.filter(
      (a) => a.status === "approved" || a.status === "disbursed",
    );
    return {
      title: pdfLanguage === "sw" ? "Mzunguko wa Ufadhili — Muhtasari" : "Bursary Cycle — Submission Summary",
      subtitle: `${cycle.title}${cycle.ward ? ` · ${cycle.ward}` : ""}${assignedCounty ? ` · ${assignedCounty} County` : ""}`,
      portalName: "Bursary-KE · Treasury Portal",
      scopeLabel: pdfLanguage === "sw" ? "Hati ya Kabla ya Malipo" : "Pre-Disbursement Acknowledgment Document",
      language: pdfLanguage,
      appliedFilters: [
        { label: "Cycle", value: cycle.title },
        { label: "Ward", value: cycle.ward || "—" },
        { label: "Deadline", value: cycle.deadline ? new Date(cycle.deadline).toLocaleString() : "—" },
        { label: "Budget (KES)", value: cycle.budget ? cycle.budget.toLocaleString() : "—" },
        { label: "Records Included", value: `${eligibleApps.length} (released & approved/disbursed only)` },
      ],
      sections: [
        {
          heading: pdfLanguage === "sw" ? "Muhtasari wa Mzunguko" : "Cycle Summary",
          rows: [
            { label: "Total Applicants Released", value: eligibleApps.length },
            { label: "Pending Disbursement", value: cycle.pendingCount },
            { label: "Already Disbursed", value: cycle.disbursedCount },
            { label: "Total Allocated (KES)", value: cycle.totalAmount.toLocaleString() },
          ],
        },
        {
          heading: pdfLanguage === "sw" ? "Mgawanyo wa Kiwango cha Umaskini" : "Poverty Tier Distribution",
          rows: sortedTiers.map(([tier, count]) => ({ label: tier, value: count })),
        },
        {
          heading: pdfLanguage === "sw" ? "Walengwa" : "Beneficiaries (masked)",
          rows: eligibleApps.map((a) => ({
            label: `${a.tracking_number} · ${a.student_name_masked} · ${a.institution_name} · Tier: ${a.poverty_tier ?? "—"}`,
            value: `KES ${(a.allocated_amount || 0).toLocaleString()}`,
          })),
        },
      ],
      notes: [
        pdfLanguage === "sw"
          ? "Hati hii ni ya matumizi rasmi ya Hazina ya Kaunti pekee. Saini ya kidijitali inahitajika kabla ya malipo."
          : "This document is for official County Treasury use only. Digital acknowledgment is required before disbursement.",
      ],
    };
  };

  // Step 1: open the in-site PDF preview modal. The user can review then click
  // "Download PDF" inside it; on download, we open the acknowledgment modal.
  const openCyclePreview = (cycle: Cycle) => {
    setCyclePreviewPayload(buildCyclePdfPayload(cycle));
    setCyclePreviewOpenId(cycle.advertId);
  };

  // Step 2: triggered after user clicks Download in the preview modal.
  const handleCyclePdfDownloaded = (cycleId: string) => {
    setAckChecked(false);
    setAckDialogCycleId(cycleId);
  };

  const confirmAcknowledgment = () => {
    if (!ackDialogCycleId || !ackChecked) return;
    const next: Record<string, AckRecord> = {
      ...acknowledgments,
      [ackDialogCycleId]: {
        cycleId: ackDialogCycleId,
        acknowledgedAt: new Date().toISOString(),
        byUserId: user?.id ?? null,
      },
    };
    persistAck(next);
    toast({
      title: "Acknowledgment recorded",
      description: "Disbursement is now unlocked for this cycle.",
    });
    setAckDialogCycleId(null);
    setAckChecked(false);
    // Close the preview if still open
    setCyclePreviewOpenId(null);
    setCyclePreviewPayload(null);
  };

  const disburseCycle = async (cycle: Cycle) => {
    if (!isAcknowledged(cycle.advertId)) {
      toast({
        title: "Acknowledgment required",
        description: "Download and acknowledge the cycle PDF first.",
        variant: "destructive",
      });
      return;
    }
    const ids = cycle.apps.filter((a) => a.status === "approved").map((a) => a.id);
    if (ids.length === 0) return;
    setDisbursingIds(new Set(ids));
    try {
      const { data, error } = await supabase
        .from("bursary_applications")
        .update({ status: "disbursed" as any })
        .in("id", ids)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Update was blocked by access policy.");
      toast({ title: "✅ Cycle Disbursed", description: `${data.length} application(s) disbursed for ${cycle.title}.` });
      sendDisbursementNotifications();
      fetchApprovedApplications();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to disburse cycle", variant: "destructive" });
    } finally {
      setDisbursingIds(new Set());
    }
  };

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
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2 flex-wrap justify-end">
              <Select value={pdfLanguage} onValueChange={(v) => setPdfLanguage(v as "en" | "sw")}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">PDF: English</SelectItem>
                  <SelectItem value="sw">PDF: Kiswahili</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleGenerateAiSummary} disabled={generatingSummary}>
                {generatingSummary ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />AI PDF Summary</>
                )}
              </Button>
              <Button variant="outline" onClick={exportToCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
              <Button variant="outline" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
            </div>
            {dataLastFetched && (
              <p className="text-xs text-muted-foreground">
                Live snapshot as of{" "}
                <span className="font-medium text-foreground">
                  {dataLastFetched.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                </span>{" "}
                (EAT)
              </p>
            )}
          </div>
        </div>

        <AiPdfConsentDialog
          open={consentOpen}
          onOpenChange={(o) => {
            setConsentOpen(o);
            if (!o) setPendingAction(null);
          }}
          onConfirm={handleConsentConfirmed}
          reportLabel={
            pendingAction === "chart"
              ? "filtered disbursement chart PDF"
              : "treasury county AI summary"
          }
        />

        <AiPdfPreviewDialog
          open={previewOpen}
          onOpenChange={(o) => {
            setPreviewOpen(o);
            if (!o) setAiPayload(null);
          }}
          buildDoc={aiPayload ? () => generateAiSummaryPdf(aiPayload) : null}
          filename={
            aiPayload
              ? aiSummaryPdfFilename(aiPayload, `treasury-${assignedCounty ?? "report"}`)
              : "report.pdf"
          }
          title={pdfLanguage === "sw" ? "Hakiki Ripoti ya AI" : "Preview AI Report"}
        />

        <AiPdfPreviewDialog
          open={chartPreviewOpen}
          onOpenChange={(o) => {
            setChartPreviewOpen(o);
            if (!o) setChartPayload(null);
          }}
          buildDoc={chartPayload ? () => buildChartSummaryDoc(chartPayload) : null}
          filename={
            chartPayload
              ? chartSummaryPdfFilename(chartPayload, `treasury-summary-${assignedCounty ?? "report"}`)
              : "chart.pdf"
          }
          title={pdfLanguage === "sw" ? "Hakiki Muhtasari wa Chati" : "Preview Chart Summary"}
        />

        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-muted-foreground">Disbursement Overview</p>
          <Button variant="outline" size="sm" onClick={handleDownloadDisbursementChartPdf}>
            <FileDown className="h-4 w-4 mr-2" />
            Download Filtered Summary PDF
          </Button>
        </div>

        <TreasurySummaryCards totalApproved={applications.length} totalAmount={totalAmount} disbursedCount={applications.filter(a => a.status === "disbursed").length} />


        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Released Application Cycles</CardTitle>
                <CardDescription>
                  Each card is a bursary cycle released by a Commissioner. Open a cycle, download the
                  pre-disbursement PDF, and acknowledge it to unlock disbursement.
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search cycles..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
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
            ) : cycles.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No released cycles yet. Awaiting Commissioner release.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {cycles.map((c) => {
                  const ack = isAcknowledged(c.advertId);
                  return (
                    <div key={c.advertId} className="border rounded-lg p-4 bg-card hover:shadow-md transition">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.ward || "County-wide"}{c.deadline ? ` · Deadline ${new Date(c.deadline).toLocaleDateString()}` : ""}
                          </p>
                        </div>
                        {ack ? (
                          <Badge className="bg-emerald-600 shrink-0"><ShieldCheck className="h-3 w-3 mr-1" />Acknowledged</Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0"><Lock className="h-3 w-3 mr-1" />Locked</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center mb-3">
                        <div className="bg-muted/40 rounded p-2">
                          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Users className="h-3 w-3" />Applicants</p>
                          <p className="font-bold">{c.apps.length}</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded p-2">
                          <p className="text-xs text-muted-foreground">Pending</p>
                          <p className="font-bold text-amber-600">{c.pendingCount}</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded p-2">
                          <p className="text-xs text-muted-foreground">Disbursed</p>
                          <p className="font-bold text-emerald-600">{c.disbursedCount}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Total: <span className="font-medium text-foreground">KES {c.totalAmount.toLocaleString()}</span>
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => setSelectedCycleId(c.advertId)}>
                          <FileText className="h-3 w-3 mr-1" />View Submissions
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => downloadCyclePdf(c)}>
                          <FileDown className="h-3 w-3 mr-1" />Download & Acknowledge
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => disburseCycle(c)}
                          disabled={!ack || c.pendingCount === 0 || disbursingIds.size > 0}
                          title={!ack ? "Download and acknowledge first" : c.pendingCount === 0 ? "Nothing pending" : ""}
                        >
                          {disbursingIds.size > 0 ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                          Disburse Cycle
                        </Button>
                      </div>
                    </div>
                  );
                })}
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

        {/* Cycle detail dialog: applicants + poverty distribution */}
        <Dialog open={!!selectedCycle} onOpenChange={(o) => { if (!o) setSelectedCycleId(null); }}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            {selectedCycle && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedCycle.title}</DialogTitle>
                  <DialogDescription>
                    {selectedCycle.ward || "County-wide"} · {selectedCycle.apps.length} applicant(s) · KES {selectedCycle.totalAmount.toLocaleString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-sm font-medium mb-2">Poverty Tier Distribution</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedCycle.povertyDist).map(([tier, count]) => (
                      <Badge key={tier} variant="outline" className="text-xs">
                        {tier}: <span className="ml-1 font-bold">{count}</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking #</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Institution</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount (KES)</TableHead>
                        <TableHead>eCitizen Ref</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCycle.apps.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell className="font-mono text-xs">{app.tracking_number}</TableCell>
                          <TableCell className="text-sm">{app.student_name_masked}</TableCell>
                          <TableCell className="text-sm">{app.institution_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{app.poverty_tier || "—"}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={app.status === "disbursed" ? "default" : "outline"} className={app.status === "disbursed" ? "bg-emerald-600" : ""}>
                              {app.status === "disbursed" ? "Disbursed" : "Approved"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{(app.allocated_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <code className="text-xs bg-muted px-2 py-1 rounded">{app.ecitizen_ref || "—"}</code>
                              {app.ecitizen_ref && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyEcitizenRef(app.ecitizen_ref)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <DialogFooter className="gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => downloadCyclePdf(selectedCycle)}>
                    <FileDown className="h-4 w-4 mr-2" />Download & Acknowledge
                  </Button>
                  <Button
                    onClick={() => disburseCycle(selectedCycle)}
                    disabled={!isAcknowledged(selectedCycle.advertId) || selectedCycle.pendingCount === 0 || disbursingIds.size > 0}
                  >
                    {!isAcknowledged(selectedCycle.advertId) ? <Lock className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Disburse Cycle ({selectedCycle.pendingCount})
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Acknowledgment dialog (signature gate) */}
        <Dialog open={!!ackDialogCycle} onOpenChange={(o) => { if (!o) { setAckDialogCycleId(null); setAckChecked(false); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Treasury Officer Acknowledgment
              </DialogTitle>
              <DialogDescription>
                {ackDialogCycle?.title}
                {ackDialogCycle?.ward ? ` · ${ackDialogCycle.ward}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                The cycle PDF has been downloaded to your device. Please review the masked
                beneficiary list, allocations, and poverty-tier distribution before confirming.
              </p>
              <div className="border rounded-lg p-3 bg-muted/30 text-xs space-y-1">
                <div className="flex justify-between"><span>Applicants released:</span><span className="font-medium">{ackDialogCycle?.apps.length ?? 0}</span></div>
                <div className="flex justify-between"><span>Pending disbursement:</span><span className="font-medium">{ackDialogCycle?.pendingCount ?? 0}</span></div>
                <div className="flex justify-between"><span>Total allocated:</span><span className="font-medium">KES {(ackDialogCycle?.totalAmount ?? 0).toLocaleString()}</span></div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/40">
                <Checkbox checked={ackChecked} onCheckedChange={(v) => setAckChecked(!!v)} className="mt-0.5" />
                <span className="text-sm">
                  <strong>I acknowledge</strong> that I have downloaded, reviewed, and verified the
                  cycle submissions for this bursary release. My acknowledgment serves as a digital
                  signature authorising disbursement of the listed allocations via eCitizen.
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setAckDialogCycleId(null); setAckChecked(false); }}>
                Cancel
              </Button>
              <Button onClick={confirmAcknowledgment} disabled={!ackChecked}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Confirm & Unlock Disbursement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Legacy single/bulk confirm dialog kept for compatibility (no longer triggered by UI) */}
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
