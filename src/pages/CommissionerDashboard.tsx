import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { supabase } from "@/integrations/supabase/client";
import { 
  GraduationCap, LogOut, CheckCircle2, XCircle, Clock, 
  Loader2, RefreshCw, AlertTriangle, BarChart3, Users, Banknote,
  ShieldAlert, Star, History, Send, Play, Inbox, Archive, FileDown, Sparkles, HelpCircle
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generateAiSummaryPdf, aiSummaryPdfFilename, type AiSummaryPayload } from "@/lib/aiSummaryPdf";
// StudentBeneficiariesPanel intentionally removed — commissioner is oversight-only.
import { buildChartSummaryDoc, chartSummaryPdfFilename, type ChartPdfPayload } from "@/lib/chartSummaryPdf";
import { AiPdfConsentDialog } from "@/components/ai/AiPdfConsentDialog";
import { AiPdfPreviewDialog } from "@/components/ai/AiPdfPreviewDialog";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  advert_id: string | null;
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

interface StudentDvlInfo {
  fraudMax: number;
  rankMin: number | null;
  pipeline: string | null;
  disability: Array<{ name: string; type: string | null; ncpwd: string | null; cardUrl: string | null }>;
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
  const [studentDetailsMap, setStudentDetailsMap] = useState<Record<string, StudentDvlInfo>>({});
  const [statusHistory, setStatusHistory] = useState<Record<string, StatusHistoryEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState("incoming");
  const [assignedWard, setAssignedWard] = useState<string | null>(null);
  const [assignedCounty, setAssignedCounty] = useState<string | null>(null);
  const [wardAdverts, setWardAdverts] = useState<BursaryAdvert[]>([]);
  const [dataLastFetched, setDataLastFetched] = useState<Date | null>(null);
  const [pdfLanguage, setPdfLanguage] = useState<"en" | "sw">("en");
  const [consentOpen, setConsentOpen] = useState(false);
  /** Which action triggered the consent dialog. */
  const [pendingAction, setPendingAction] = useState<"ai" | "chart" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiPayload, setAiPayload] = useState<AiSummaryPayload | null>(null);
  const [chartPreviewOpen, setChartPreviewOpen] = useState(false);
  const [chartPayload, setChartPayload] = useState<ChartPdfPayload | null>(null);
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const { language: uiLanguage } = useI18n();
  const navigate = useNavigate();

  // Sync default PDF language with the UI language on first load / language switch
  useEffect(() => { setPdfLanguage(uiLanguage); }, [uiLanguage]);

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
        .select("id, title, county, ward, deadline, budget_amount, max_slots, is_active")
        .order("deadline", { ascending: false });

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
        advert_id: d.advert_id || null,
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
      } else {
        setFairnessMap(new Map());
      }

      // Fetch per-student DVL, fraud AI score, and pipeline rank
      try {
        const { data: parentRows } = await supabase.rpc("get_parent_applications_for_commissioner");
        const detailMap: Record<string, StudentDvlInfo> = {};
        (parentRows || []).forEach((row: any) => {
          const students: any[] = Array.isArray(row.students) ? row.students : [];
          if (students.length === 0) return;
          const fraudMax = students.reduce((m, s) => Math.max(m, Number(s.fraud_score) || 0), 0);
          const ranks = students.map((s) => s.rank_in_pipeline).filter((r: any) => r != null);
          const rankMin = ranks.length ? Math.min(...ranks) : null;
          const pipeline = students.find((s) => s.assessment_pipeline)?.assessment_pipeline ?? null;
          const disability = students
            .filter((s) => s.disability_status || s.ncpwd_registration_number || s.disability_card_url)
            .map((s) => ({
              name: s.student_name_masked || "Student",
              type: s.disability_type ?? null,
              ncpwd: s.ncpwd_registration_number ?? null,
              cardUrl: s.disability_card_url ?? null,
            }));
          detailMap[row.tracking_number] = { fraudMax, rankMin, pipeline, disability };
        });
        setStudentDetailsMap(detailMap);
      } catch (e) {
        console.warn("DVL/fraud fetch failed", e);
      }
    }
    setDataLastFetched(new Date());
    setIsLoading(false);
  };

  useEffect(() => {
    if (assignedWard || assignedCounty) {
      fetchApplications();
    }
  }, [assignedWard, assignedCounty]);

  // Polling fallback (PII tables are excluded from Supabase realtime by policy).
  // Refresh every 30s while the dashboard is visible.
  useEffect(() => {
    if (!assignedWard && !assignedCounty) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchApplications();
      }
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchApplications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [assignedWard, assignedCounty]);

  // Push-based updates: sanitized broadcast scoped to this commissioner's ward.
  useDashboardRealtime(
    assignedWard ? { kind: "commissioner", ward: assignedWard } : null,
    () => { void fetchApplications(); },
  );

  // Tick every 1s so the live countdown and deadline check stay current.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Pre-flight checklist that must be acknowledged before Process Applications.
  const [checkAiPdf, setCheckAiPdf] = useState(false);
  const [checkTiers, setCheckTiers] = useState(false);
  const [checkQuota, setCheckQuota] = useState(false);
  const checklistComplete = checkAiPdf && checkTiers && checkQuota;

  // Group applications by advert (the cycle they belong to)
  const appsByAdvert = useMemo(() => {
    const map = new Map<string, Application[]>();
    for (const a of applications) {
      const key = a.advert_id || "__legacy__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [applications]);

  // A cycle is "complete" (i.e. fully released to Treasury) when:
  //  • there are NO live applications still pending or in review/verification (excluding duplicates)
  //  • every non-duplicate APPROVED row has released_to_treasury = true
  //  • duplicates and rejected rows are terminal — they do not block completion
  // Rows where status='approved' AND is_duplicate=true are inconsistent legacy data and
  // are treated as terminal (they should never be released).
  const isAdvertCycleComplete = (advertId: string): boolean => {
    const apps = appsByAdvert.get(advertId);
    if (!apps || apps.length === 0) return false;
    const livePending = apps.some(
      a => !a.is_duplicate && ["received", "review", "verification"].includes(a.status),
    );
    if (livePending) return false;
    const liveApproved = apps.filter(a => a.status === "approved" && !a.is_duplicate);
    if (liveApproved.length === 0) return true; // processed, nothing left to release
    return liveApproved.every(a => a.released_to_treasury === true);
  };

  // Active advert = newest ward advert whose cycle is NOT yet released to Treasury.
  // Once a cycle is fully released, its banner/metrics are cleared from the active view
  // and it moves into the History tab.
  const activeAdvert = useMemo(() => {
    if (wardAdverts.length === 0) return undefined;
    const orderedAdverts = [...wardAdverts].sort(
      (a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime(),
    );
    const open = orderedAdverts.find(a => !isAdvertCycleComplete(a.id));
    return open;
  }, [wardAdverts, appsByAdvert]);

  // Apps belonging strictly to the active cycle (drives all visible tabs except History).
  const cycleApps = useMemo(() => {
    if (!activeAdvert) return [] as Application[];
    return appsByAdvert.get(activeAdvert.id) ?? [];
  }, [activeAdvert, appsByAdvert]);

  // Stats reflect the active cycle only.
  const stats: Stats = useMemo(() => {
    const fairnessPriorityCandidates = cycleApps.filter(a => fairnessMap.get(a.id)?.isFairnessPriority).length;
    const redFlagged = cycleApps.filter(a => fairnessMap.get(a.id)?.historicalStatus === "red_flagged").length;
    return {
      total: cycleApps.length,
      approved: cycleApps.filter(a => a.status === "approved" && !a.is_duplicate).length,
      rejected: cycleApps.filter(a => a.status === "rejected" && !a.is_duplicate).length,
      pending: cycleApps.filter(a => !a.is_duplicate && ["received", "review", "verification"].includes(a.status)).length,
      duplicates: cycleApps.filter(a => a.is_duplicate).length,
      totalAllocated: cycleApps
        .filter(a => a.status === "approved" && !a.is_duplicate)
        .reduce((sum, a) => sum + (a.allocated_amount || 0), 0),
      fairnessPriorityCandidates,
      redFlagged,
    };
  }, [cycleApps, fairnessMap]);

  // Deadline is considered passed when the active advert's deadline has elapsed.
  const deadlinePassed = useMemo(() => {
    if (!activeAdvert) return false;
    return new Date(activeAdvert.deadline).getTime() <= nowTick;
  }, [activeAdvert, nowTick]);

  // Approved rows still awaiting release in the active cycle.
  const hasUnreleasedApproved = useMemo(() => {
    return cycleApps.some(a => a.status === "approved" && !a.is_duplicate && !a.released_to_treasury);
  }, [cycleApps]);

  // Block release while ANY non-duplicate application is still pending/locked.
  // This prevents partial releases that would leave the cycle in a mixed,
  // unauditable state where some applicants are released while others remain unreviewed.
  const hasUnresolvedPending = useMemo(() => {
    return cycleApps.some(a => !a.is_duplicate && ["received", "review", "verification"].includes(a.status));
  }, [cycleApps]);

  // Release is allowed only when: deadline passed, processing produced approvals
  // that haven't been released yet, AND no pending rows remain.
  const canReleaseToTreasury = deadlinePassed && hasUnreleasedApproved && !hasUnresolvedPending;

  // Processing is "complete" once at least one application has been moved out of pending.
  const processingComplete = useMemo(() => {
    return stats.approved + stats.rejected > 0;
  }, [stats.approved, stats.rejected]);

  // Should the AI PDF button glow? Only after deadline, while there's pending work
  // and no allocation has been processed yet — encourages pre-processing review.
  const shouldGlowAiPdf = deadlinePassed && stats.pending > 0 && !processingComplete;

  // Success toast the moment the deadline crosses for an active advert.
  useEffect(() => {
    if (!activeAdvert) return;
    if (!deadlinePassed) return;
    const key = `bke:deadline-notified:${activeAdvert.id}`;
    if (typeof window !== "undefined" && !window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, "1");
      toast({
        title: "✅ Deadline reached — Processing unlocked",
        description: `Deadline ${new Date(activeAdvert.deadline).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })} has passed. You can now run Process Applications.`,
      });
    }
  }, [deadlinePassed, activeAdvert, toast]);

  // Process applications (trigger allocation after deadline)
  const handleProcessApplications = async () => {
    if (!activeAdvert) {
      toast({ title: "No Advert", description: "No active bursary advert found for your ward.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // Fairness evaluation is best-effort — do not block allocation if it fails
      try {
        await supabase.functions.invoke("fairness-engine", {
          body: { action: "evaluate", advertId: activeAdvert.id },
        });
      } catch (fairnessErr) {
        console.warn("Fairness engine non-blocking error:", fairnessErr);
      }

      // Trigger allocation
      const { data, error } = await supabase.functions.invoke("process-allocations", {
        body: { 
          advertId: activeAdvert.id, 
          budgetAmount: activeAdvert.budget_amount,
          ...(activeAdvert.max_slots ? { maxSlots: activeAdvert.max_slots } : {}),
        },
      });

      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Allocation failed");

      toast({
        title: "Processing Complete",
        description: data?.message || "Applications have been processed successfully.",
      });
      // Reset checklist so it cannot be re-run accidentally without a fresh review
      setCheckAiPdf(false);
      setCheckTiers(false);
      setCheckQuota(false);
      // Switch to a tab that surfaces the new state
      setActiveTab("approved");
      await fetchApplications();
    } catch (error) {
      console.error("Processing error:", error);
      const msg = error instanceof Error ? error.message : "Could not process applications. Please try again.";
      toast({ title: "Processing Failed", description: msg, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Release approved applications to treasury
  const handleReleaseToTreasury = async () => {
    // Hard guard: never release while pending rows remain in the active cycle.
    if (hasUnresolvedPending) {
      toast({
        title: "Cannot Release",
        description: "There are still pending applications in this cycle. Run Process Applications to resolve them first.",
        variant: "destructive",
      });
      return;
    }

    const approvedIds = cycleApps
      .filter(a => a.status === "approved" && !a.is_duplicate && !a.released_to_treasury)
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

      // Optimistic local update so the banner / Approved tab clear immediately
      // even before the refetch resolves.
      setApplications(prev =>
        prev.map(a => (approvedIds.includes(a.id) ? { ...a, released_to_treasury: true } : a)),
      );

      toast({
        title: "Released to Treasury",
        description: `${approvedIds.length} approved application(s) sent to County Treasury for disbursement. Cycle archived in History.`,
      });

      // Move user to History since the active cycle no longer exists.
      setActiveTab("history");
      await fetchApplications();
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

  const buildJurisdiction = () => {
    const parts = [assignedWard, assignedCounty].filter(Boolean);
    return parts.length
      ? parts.join(" Ward, ") + (assignedCounty ? " County" : "")
      : "Unassigned jurisdiction";
  };

  const buildAppliedFilters = () => {
    const tabLabels: Record<string, { en: string; sw: string }> = {
      incoming: { en: "Incoming", sw: "Yanayoingia" },
      summary: { en: "Summary", sw: "Muhtasari" },
      approved: { en: "Approved", sw: "Yameidhinishwa" },
      rejected: { en: "Rejected", sw: "Yamekataliwa" },
      archive: { en: "Audit Archive", sw: "Kumbukumbu" },
    };
    const tab = tabLabels[activeTab] ?? { en: activeTab, sw: activeTab };
    return [
      {
        label: pdfLanguage === "sw" ? "Kata Iliyokabidhiwa" : "Assigned Ward",
        value: assignedWard ?? "—",
      },
      {
        label: pdfLanguage === "sw" ? "Kaunti Iliyokabidhiwa" : "Assigned County",
        value: assignedCounty ?? "—",
      },
      {
        label: pdfLanguage === "sw" ? "Kichupo Kinachoonekana" : "Active Tab",
        value: pdfLanguage === "sw" ? tab.sw : tab.en,
      },
      {
        label: pdfLanguage === "sw" ? "Tangazo Linalotumika" : "Active Advert",
        value: activeAdvert?.title ?? "—",
      },
      {
        label: pdfLanguage === "sw" ? "Lugha ya Ripoti" : "Report Language",
        value: pdfLanguage === "sw" ? "Kiswahili" : "English",
      },
    ];
  };

  const runGenerateAiSummary = async () => {
    setGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-summary", {
        body: { scope: "commissioner" },
      });
      if (error) throw error;
      if (!data?.summary) throw new Error("No summary returned");
      const jurisdiction = buildJurisdiction();
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
          scopeLabel: pdfLanguage === "sw" ? "Ripoti ya Kata ya Kamishna" : "Commissioner Ward Report",
          jurisdiction,
          dataFreshness: freshnessLabel,
          portalName: "Bursary-KE · Commissioner Portal",
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

  const buildChartPayload = (): ChartPdfPayload => ({
    title: pdfLanguage === "sw" ? "Muhtasari wa Mgawanyo wa Maombi" : "Application Distribution Summary",
    subtitle: buildJurisdiction(),
    portalName: "Bursary-KE · Commissioner Portal",
    scopeLabel: pdfLanguage === "sw" ? "Ripoti ya Kata ya Kamishna" : "Commissioner Ward Report",
    language: pdfLanguage,
    appliedFilters: buildAppliedFilters(),
    sections: [
      {
        heading: pdfLanguage === "sw" ? "Mgawanyo wa Hali" : "Status Distribution",
        rows: [
          { label: pdfLanguage === "sw" ? "Jumla ya Maombi" : "Total Applications", value: stats.total },
          { label: pdfLanguage === "sw" ? "Yameidhinishwa" : "Approved", value: stats.approved },
          { label: pdfLanguage === "sw" ? "Yamekataliwa" : "Rejected", value: stats.rejected },
          { label: pdfLanguage === "sw" ? "Yanayosubiri" : "Pending", value: stats.pending },
          { label: pdfLanguage === "sw" ? "Marudio" : "Duplicates", value: stats.duplicates },
        ],
      },
      {
        heading: pdfLanguage === "sw" ? "Muhtasari wa AI" : "AI Allocation Summary",
        rows: [
          { label: pdfLanguage === "sw" ? "Jumla Iliyogawanywa (KES)" : "Total Allocated (KES)", value: stats.totalAllocated.toLocaleString() },
          { label: pdfLanguage === "sw" ? "Vipaumbele vya Haki" : "Fairness Priority Candidates", value: stats.fairnessPriorityCandidates },
          { label: pdfLanguage === "sw" ? "Vimewekewa Alama Nyekundu" : "Red Flagged", value: stats.redFlagged },
        ],
      },
    ],
  });

  const runDownloadChartPdf = () => {
    setChartPayload(buildChartPayload());
    setChartPreviewOpen(true);
  };

  const handleDownloadSummaryChartPdf = () => {
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


  const handleExportPDF = (filter: "all" | "approved" | "rejected") => {
    const appsToExport = filter === "approved" ? approvedApps 
      : filter === "rejected" ? rejectedApps 
      : applications;
    
    if (appsToExport.length === 0) {
      toast({ title: "No Data", description: "No applications to export.", variant: "destructive" });
      return;
    }

    // HTML-escape helper to prevent XSS from DB-sourced values
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Build HTML for print-to-PDF
    const rows = appsToExport.map((app, i) => {
      const f = fairnessMap.get(app.id);
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(app.tracking_number)}</td>
        <td>${esc(app.student_name_masked)}</td>
        <td>${esc(app.student_type)}</td>
        <td>${esc(app.parent_ward || app.parent_county)}</td>
        <td>${esc(app.poverty_tier)} (${esc(app.poverty_score || 0)}/100)</td>
        <td>${esc(f?.fraudRiskLevel || "low")}</td>
        <td>KES ${esc((app.allocated_amount || 0).toLocaleString())}</td>
        <td>${esc(app.status)}</td>
        <td style="white-space:pre-line;max-width:300px;font-size:10px">${esc(app.ai_decision_reason || "—")}</td>
      </tr>`;
    }).join("");

    const filterLabel = filter === "all" ? "All Applications" : filter === "approved" ? "Approved Applications" : "Rejected Applications";
    const html = `<!DOCTYPE html><html><head><title>Allocation Report</title>
    <style>
      body{font-family:Arial,sans-serif;margin:20px;font-size:12px}
      h1{font-size:18px;margin-bottom:4px}
      .meta{color:#666;margin-bottom:16px;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
      th{background:#f5f5f5;font-weight:600;font-size:11px}
      td{font-size:10px}
      .summary{display:flex;gap:24px;margin-bottom:12px}
      .summary div{background:#f9f9f9;padding:8px 12px;border-radius:4px}
      @media print{body{margin:10px}th{background:#eee!important;-webkit-print-color-adjust:exact}}
    </style></head><body>
    <h1>Bursary Allocation Report — ${esc(filterLabel)}</h1>
    <p class="meta">Ward: ${esc(assignedWard || "N/A")} | County: ${esc(assignedCounty || "N/A")} | Generated: ${esc(new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }))}</p>
    <div class="summary">
      <div><strong>Total:</strong> ${appsToExport.length}</div>
      <div><strong>Approved:</strong> ${appsToExport.filter(a => a.status === "approved").length}</div>
      <div><strong>Rejected:</strong> ${appsToExport.filter(a => a.status === "rejected").length}</div>
      <div><strong>Allocated:</strong> KES ${appsToExport.reduce((s, a) => s + (a.allocated_amount || 0), 0).toLocaleString()}</div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Tracking</th><th>Student</th><th>Type</th><th>Ward</th><th>Poverty</th><th>Fraud Risk</th><th>Amount</th><th>Status</th><th>AI Decision Reasoning</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:16px;font-size:10px;color:#888">This report contains masked data. Compliant with the Kenya Data Protection Act, 2019.</p>
    </body></html>`;


    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
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

  const incomingApps = cycleApps.filter(a => ["received", "review", "verification"].includes(a.status) && !a.is_duplicate);
  const approvedApps = cycleApps.filter(a => a.status === "approved" && !a.is_duplicate);
  const rejectedApps = cycleApps.filter(a => a.status === "rejected" || a.is_duplicate);

  // Completed cycles (released to Treasury) — surfaced in the History tab.
  const completedCycles = useMemo(() => {
    return wardAdverts
      .filter(adv => isAdvertCycleComplete(adv.id))
      .map(adv => {
        const apps = appsByAdvert.get(adv.id) ?? [];
        const approved = apps.filter(a => a.status === "approved" && !a.is_duplicate);
        const rejected = apps.filter(a => a.status === "rejected" || a.is_duplicate);
        const allocated = approved.reduce((s, a) => s + (a.allocated_amount || 0), 0);
        return { advert: adv, apps, approved, rejected, allocated };
      })
      .sort((a, b) => new Date(b.advert.deadline).getTime() - new Date(a.advert.deadline).getTime());
  }, [wardAdverts, appsByAdvert]);

  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null);

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
          <TableHead>Fraud AI</TableHead>
          <TableHead>Rank</TableHead>
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
                <TableCell>
                  {(() => {
                    const d = studentDetailsMap[app.tracking_number];
                    const score = d?.fraudMax ?? 0;
                    const variant = score >= 70 ? "destructive" : score >= 40 ? "secondary" : "outline";
                    return <Badge variant={variant as any} title="AI fraud score (0–100, higher = riskier)">{score}</Badge>;
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const d = studentDetailsMap[app.tracking_number];
                    if (d?.rankMin == null) return <span className="text-xs text-muted-foreground">—</span>;
                    return (
                      <Badge variant="outline" className="font-mono" title={d.pipeline ? `Pipeline: ${d.pipeline}` : undefined}>
                        #{d.rankMin}
                      </Badge>
                    );
                  })()}
                </TableCell>
                {showAmount && (
                  <TableCell className="font-medium">KES {(app.allocated_amount || 0).toLocaleString()}</TableCell>
                )}
                <TableCell>{getStatusBadge(app.status, app.is_duplicate)}</TableCell>
                <TableCell className="min-w-[320px]">
                  <AIReasonCell reason={app.ai_decision_reason} />
                </TableCell>
              </TableRow>
              {studentDetailsMap[app.tracking_number]?.disability?.length > 0 && (
                <TableRow>
                  <TableCell colSpan={showAmount ? 12 : 11} className="py-1 px-6 bg-amber-50/40 dark:bg-amber-950/10">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">DVL — Disability Evidence (verify NCPWD)</p>
                      {studentDetailsMap[app.tracking_number].disability.map((d, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="font-medium">{d.name}</span>
                          {d.type && <span>Type: {d.type}</span>}
                          <span>NCPWD: <span className="font-mono">{d.ncpwd || "—"}</span></span>
                          {d.cardUrl ? (
                            <a href={d.cardUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                              View card
                            </a>
                          ) : (
                            <span className="italic">No card uploaded</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {statusHistory[app.id]?.length > 0 && (
                <TableRow>
                  <TableCell colSpan={showAmount ? 12 : 11} className="py-1 px-6">
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
              <Button
                variant="outline"
                onClick={handleGenerateAiSummary}
                disabled={generatingSummary}
                title={shouldGlowAiPdf ? "Review the AI summary before running allocation" : undefined}
                className={shouldGlowAiPdf ? "animate-attention-glow border-primary text-primary" : undefined}
              >
                {generatingSummary ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />AI PDF Summary</>
                )}
              </Button>
              <Button variant="outline" size="icon" onClick={fetchApplications}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />Logout
              </Button>
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
              ? "filtered chart summary PDF"
              : "commissioner ward AI summary"
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
              ? aiSummaryPdfFilename(
                  aiPayload,
                  `commissioner-${assignedWard ?? assignedCounty ?? "report"}`,
                )
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
              ? chartSummaryPdfFilename(
                  chartPayload,
                  `commissioner-summary-${assignedWard ?? assignedCounty ?? "report"}`,
                )
              : "chart.pdf"
          }
          title={pdfLanguage === "sw" ? "Hakiki Muhtasari wa Chati" : "Preview Chart Summary"}
        />

        {/* Deadline & Action Banner */}
        {!activeAdvert && (
          <Card className="mb-6 border-amber-200 dark:border-amber-800">
            <CardContent className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground">
                  {wardAdverts.length === 0
                    ? "No bursary advert assigned"
                    : completedCycles.length > 0
                      ? "No active cycle — last cycle released to County Treasury"
                      : "No active cycle"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {wardAdverts.length === 0
                    ? `No bursary advert exists for ${assignedWard ?? assignedCounty ?? "your jurisdiction"} yet. Governance actions will activate once an advert is published.`
                    : `All processed applications for the previous cycle have been released to Treasury. Past cycles are available in the History tab. Governance actions reactivate when a new advert is published.`}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button disabled variant="outline" className="bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-60">
                  <Clock className="h-4 w-4 mr-2" />Waiting for advert
                </Button>
                <Button disabled variant="outline" className="bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-60">
                  <Send className="h-4 w-4 mr-2" />Release to Treasury
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {activeAdvert && (() => {
          const deadlineMs = new Date(activeAdvert.deadline).getTime();
          const diff = deadlineMs - nowTick;
          const passed = diff <= 0;
          const abs = Math.abs(diff);
          const d = Math.floor(abs / 86400000);
          const h = Math.floor((abs / 3600000) % 24);
          const m = Math.floor((abs / 60000) % 60);
          const s = Math.floor((abs / 1000) % 60);
          const pad = (n: number) => n.toString().padStart(2, "0");
          const countdown = `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
          return (
          <Card className="mb-6 border-blue-200 dark:border-blue-800">
            <CardContent className="py-4 space-y-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">{activeAdvert.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Deadline: {new Date(activeAdvert.deadline).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    {activeAdvert.budget_amount && ` | Budget: KES ${activeAdvert.budget_amount.toLocaleString()}`}
                  </p>
                  <p className={`text-sm mt-1 font-mono ${passed ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    <Clock className="h-3 w-3 inline mr-1" />
                    {passed ? `Deadline passed · ${countdown} ago` : `Time remaining · ${countdown}`}
                  </p>
                  {passed && stats.pending > 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      <CheckCircle2 className="h-3 w-3 inline mr-1" />
                      You can now process {stats.pending} pending application(s).
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 items-center flex-wrap">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Where to find this?
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 text-sm space-y-2">
                      <p className="font-semibold text-foreground flex items-center gap-1">
                        <ShieldAlert className="h-4 w-4" /> Pre-flight checklist
                      </p>
                      <p className="text-muted-foreground">
                        It sits directly below this banner. <strong>Process Applications</strong> stays
                        disabled until all three items are ticked.
                      </p>
                      <p className="text-muted-foreground font-medium">It appears only when:</p>
                      <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                        <li>An <strong>active unreleased cycle</strong> exists for your ward.</li>
                        <li>The advert <strong>deadline has passed</strong>.</li>
                        <li>There are <strong>pending applications</strong> awaiting review.</li>
                      </ul>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-1"
                        onClick={() => {
                          const el = document.getElementById("preflight-checklist");
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.classList.add("ring-2", "ring-primary");
                            setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000);
                          }
                        }}
                      >
                        Jump to checklist
                      </Button>
                    </PopoverContent>
                  </Popover>
                  <Button
                    onClick={handleProcessApplications}
                    disabled={!deadlinePassed || stats.pending === 0 || isProcessing || !checklistComplete}
                    variant={!deadlinePassed ? "outline" : "default"}
                    title={
                      !deadlinePassed ? "Waiting for application deadline"
                      : !checklistComplete ? "Complete the pre-flight checklist below"
                      : undefined
                    }
                    className={!deadlinePassed || !checklistComplete
                      ? "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-60"
                      : "bg-green-600 hover:bg-green-700 text-white"}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                    ) : !deadlinePassed ? (
                      <><Clock className="h-4 w-4 mr-2" />Opens in {countdown}</>
                    ) : (
                      <><Play className="h-4 w-4 mr-2" />Process Applications</>
                    )}
                  </Button>
                  <Button
                    onClick={handleReleaseToTreasury}
                    disabled={!canReleaseToTreasury || isReleasing}
                    variant="default"
                    title={
                      !deadlinePassed ? "Wait for the bursary deadline first"
                      : hasUnresolvedPending ? "Resolve pending applications before releasing"
                      : !hasUnreleasedApproved ? "No approved applications to release"
                      : undefined
                    }
                    className={!canReleaseToTreasury
                      ? "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-60"
                      : undefined}
                  >
                    {isReleasing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Releasing...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" />Release to Treasury</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Pre-flight checklist — must be acknowledged before processing */}
              <div id="preflight-checklist" className="rounded-lg border border-border bg-muted/30 p-3 transition-all scroll-mt-24">
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Pre-flight checklist (required before Process Applications)
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={checkAiPdf} onCheckedChange={(v) => setCheckAiPdf(Boolean(v))} className="mt-0.5" />
                    <span>I have downloaded and reviewed the <strong>AI PDF Summary</strong>.</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={checkTiers} onCheckedChange={(v) => setCheckTiers(Boolean(v))} className="mt-0.5" />
                    <span>I have confirmed the <strong>poverty tier distribution</strong> looks reasonable.</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox checked={checkQuota} onCheckedChange={(v) => setCheckQuota(Boolean(v))} className="mt-0.5" />
                    <span>I confirm the <strong>budget &amp; slot quota</strong> for this advert are correct.</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })()}

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
            <TabsTrigger value="history"><History className="h-4 w-4 mr-2" />History ({completedCycles.length})</TabsTrigger>
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
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={handleDownloadSummaryChartPdf}>
                <FileDown className="h-4 w-4 mr-2" />
                Download Summary PDF
              </Button>
            </div>
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
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleExportPDF("approved")} disabled={approvedApps.length === 0}>
                      <FileDown className="h-4 w-4 mr-2" />Export PDF
                    </Button>
                    {hasUnreleasedApproved && (
                      <Button
                        onClick={handleReleaseToTreasury}
                        disabled={!canReleaseToTreasury || isReleasing}
                        title={hasUnresolvedPending ? "Resolve pending applications before releasing" : undefined}
                      >
                        {isReleasing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        Release to Treasury
                      </Button>
                    )}
                  </div>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Non-Successful Applications</CardTitle>
                    <CardDescription>Applications rejected with AI reasoning</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleExportPDF("rejected")} disabled={rejectedApps.length === 0}>
                    <FileDown className="h-4 w-4 mr-2" />Export PDF
                  </Button>
                </div>
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

          {/* History Tab — past cycles already released to Treasury */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Cycle History</CardTitle>
                <CardDescription>
                  Past bursary cycles for your jurisdiction. Each card represents one advert whose approved
                  applications were released to County Treasury. Click a cycle to view its applications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {completedCycles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No completed cycles yet. Once you release a cycle to Treasury, it will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {completedCycles.map(({ advert, apps, approved, rejected, allocated }) => {
                      const isOpen = historyExpanded === advert.id;
                      return (
                        <Card key={advert.id} className="border-border">
                          <CardHeader className="pb-3">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div>
                                <CardTitle className="text-lg">{advert.title}</CardTitle>
                                <CardDescription>
                                  Deadline: {new Date(advert.deadline).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                                  {advert.ward ? ` · Ward: ${advert.ward}` : ""} · County: {advert.county}
                                </CardDescription>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center">
                                <Badge variant="secondary">Total {apps.length}</Badge>
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Approved {approved.length}</Badge>
                                <Badge variant="destructive">Rejected {rejected.length}</Badge>
                                <Badge variant="outline">KES {allocated.toLocaleString()}</Badge>
                                <Button size="sm" variant="outline" onClick={() => setHistoryExpanded(isOpen ? null : advert.id)}>
                                  {isOpen ? "Hide" : "View"}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {isOpen && (
                            <CardContent>
                              {apps.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No applications recorded for this cycle.</p>
                              ) : renderAppTable(apps, true)}
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Archive Tab */}
          <TabsContent value="archive">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Audit Archive</CardTitle>
                    <CardDescription>
                      All processed applications are retained here for audit and future reference. 
                      Data remains masked to ensure anonymity and prevent fraud.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleExportPDF("all")} disabled={applications.length === 0}>
                    <FileDown className="h-4 w-4 mr-2" />Export PDF
                  </Button>
                </div>
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
