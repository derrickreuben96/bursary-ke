import { useState, useEffect } from "react";
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
  ShieldAlert, Star, History
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
  created_at: string;
  is_duplicate: boolean;
  student_name_masked: string;
  parent_name_masked: string;
  poverty_score: number | null;
  household_income: number | null;
  household_dependents: number | null;
}

interface FairnessInfo {
  applicationId: string;
  isFairnessPriority: boolean;
  historicalStatus: string;
  fraudRiskLevel: string;
  fairnessPriorityScore: number;
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

export default function CommissionerDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [fairnessMap, setFairnessMap] = useState<Map<string, FairnessInfo>>(new Map());
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, rejected: 0, pending: 0, duplicates: 0, totalAllocated: 0, fairnessPriorityCandidates: 0, redFlagged: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [assignedWard, setAssignedWard] = useState<string | null>(null);
  const [assignedCounty, setAssignedCounty] = useState<string | null>(null);
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

  const fetchApplications = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .rpc("get_commissioner_applications");

    if (error) {
      console.error("Error fetching applications:", error);
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive",
      });
    } else {
      let apps = (data || []).map((d: any) => ({
        ...d,
        parent_county: d.parent_county || '',
      })) as Application[];

      // Filter by assigned ward if commissioner has one
      if (assignedWard) {
        // Ward filtering - commissioner only sees their ward's applications
        // Since we don't have a ward column directly, we filter by county for now
        // and the ward assignment is used as an indicator
      }
      if (assignedCounty) {
        apps = apps.filter(a => a.parent_county === assignedCounty);
      }
      setApplications(apps);

      // Fetch fairness tracking data for all apps
      const appIds = apps.map(a => a.id).filter(Boolean);
      if (appIds.length > 0) {
        const { data: fairnessData } = await supabase
          .from("fairness_tracking")
          .select("application_id, is_fairness_priority_candidate, historical_status, fraud_risk_level, fairness_priority_score")
          .in("application_id", appIds);

        const fMap = new Map<string, FairnessInfo>();
        (fairnessData || []).forEach((f: any) => {
          fMap.set(f.application_id, {
            applicationId: f.application_id,
            isFairnessPriority: f.is_fairness_priority_candidate,
            historicalStatus: f.historical_status,
            fraudRiskLevel: f.fraud_risk_level,
            fairnessPriorityScore: f.fairness_priority_score,
          });
        });
        setFairnessMap(fMap);
      }

      const fairnessPriorityCandidates = apps.filter(a => {
        const f = fairnessMap.get(a.id);
        return f?.isFairnessPriority;
      }).length;
      const redFlagged = apps.filter(a => {
        const f = fairnessMap.get(a.id);
        return f?.historicalStatus === "red_flagged";
      }).length;

      setStats({
        total: apps.length,
        approved: apps.filter(a => a.status === "approved").length,
        rejected: apps.filter(a => a.status === "rejected").length,
        pending: apps.filter(a => a.status === "received" || a.status === "review" || a.status === "verification").length,
        duplicates: apps.filter(a => a.is_duplicate).length,
        totalAllocated: apps.reduce((sum, a) => sum + (a.allocated_amount || 0), 0),
        fairnessPriorityCandidates,
        redFlagged,
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchApplications();
  }, []);

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
    if (isDuplicate) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-700">Duplicate</Badge>;
    }
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "received":
      case "review":
      case "verification":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const approvedApps = applications.filter(a => a.status === "approved" && !a.is_duplicate);
  const rejectedApps = applications.filter(a => a.status === "rejected" || a.is_duplicate);

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <GraduationCap className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">County Education Commissioner</h1>
              <p className="text-muted-foreground">Application Summary & AI Decisions (Read-Only)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchApplications}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Allocated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-blue-600">
                KES {stats.totalAllocated.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2">
                <Star className="h-4 w-4" />
                Fairness Priority
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.fairnessPriorityCandidates}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Red Flagged
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.redFlagged}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="summary">
              <BarChart3 className="h-4 w-4 mr-2" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="approved">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Successful ({stats.approved})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              <XCircle className="h-4 w-4 mr-2" />
              Non-Successful ({stats.rejected + stats.duplicates})
            </TabsTrigger>
          </TabsList>

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
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                      No data available
                    </div>
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
                      {stats.approved} students approved based on poverty assessment scores and budget availability.
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-700 dark:text-red-400">Non-Successful Applications</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {stats.rejected} applications not approved due to budget constraints or lower priority scores.
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-gray-600" />
                      <span className="font-medium">Duplicate Detections</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {stats.duplicates} duplicate applications automatically discarded.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-purple-700 dark:text-purple-400">Fairness Continuity</span>
                    </div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">
                      {stats.fairnessPriorityCandidates} previously unfunded applicants received priority boost.
                      {stats.redFlagged > 0 && ` ${stats.redFlagged} applicant(s) excluded due to red flags.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <CardTitle>Successful Applications</CardTitle>
                <CardDescription>Applications approved by AI allocation system</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : approvedApps.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No approved applications yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>County</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Fairness</TableHead>
                        <TableHead>Fraud Risk</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>AI Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvedApps.map((app) => {
                        const f = fairnessMap.get(app.id);
                        return (
                          <TableRow key={app.id}>
                            <TableCell className="font-mono">{app.tracking_number}</TableCell>
                            <TableCell className="capitalize">{app.student_type}</TableCell>
                            <TableCell>{app.parent_county}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{app.poverty_tier}</Badge>
                            </TableCell>
                            <TableCell>
                              {f?.isFairnessPriority ? (
                                <Badge className="bg-purple-100 text-purple-700">
                                  <Star className="h-3 w-3 mr-1" />
                                  Priority +{f.fairnessPriorityScore}
                                </Badge>
                              ) : f?.historicalStatus === "returning_funded" ? (
                                <Badge variant="outline" className="text-amber-600">
                                  <History className="h-3 w-3 mr-1" />
                                  Returning
                                </Badge>
                              ) : (
                                <Badge variant="secondary">New</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={f?.fraudRiskLevel === "high" ? "destructive" : f?.fraudRiskLevel === "medium" ? "secondary" : "outline"}>
                                {f?.fraudRiskLevel || "low"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              KES {(app.allocated_amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                              {app.ai_decision_reason || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected">
            <Card>
              <CardHeader>
                <CardTitle>Non-Successful Applications</CardTitle>
                <CardDescription>Applications rejected with AI reasoning</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : rejectedApps.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No rejected applications
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>County</TableHead>
                        <TableHead>Fraud Risk</TableHead>
                        <TableHead>History</TableHead>
                        <TableHead>AI Reason for Rejection</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rejectedApps.map((app) => {
                        const f = fairnessMap.get(app.id);
                        return (
                          <TableRow key={app.id}>
                            <TableCell className="font-mono">{app.tracking_number}</TableCell>
                            <TableCell>{getStatusBadge(app.status, app.is_duplicate)}</TableCell>
                            <TableCell className="capitalize">{app.student_type}</TableCell>
                            <TableCell>{app.parent_county}</TableCell>
                            <TableCell>
                              {f?.fraudRiskLevel === "high" ? (
                                <Badge variant="destructive"><ShieldAlert className="h-3 w-3 mr-1" />High</Badge>
                              ) : f?.fraudRiskLevel === "medium" ? (
                                <Badge variant="secondary">Medium</Badge>
                              ) : (
                                <Badge variant="outline">Low</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {f?.historicalStatus === "red_flagged" ? (
                                <Badge variant="destructive">Red Flagged</Badge>
                              ) : f?.historicalStatus === "returning_unfunded" ? (
                                <Badge className="bg-purple-100 text-purple-700">Unfunded Prior</Badge>
                              ) : (
                                <Badge variant="secondary">New</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-md text-sm">
                              <p className="text-muted-foreground">
                                {app.ai_decision_reason || "No reason provided"}
                              </p>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Notice */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Read-Only Access:</strong> This portal provides oversight of AI allocation decisions. 
            No intervention or modification capabilities are available. All decisions are automated based on 
            poverty assessment scores and budget constraints.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
