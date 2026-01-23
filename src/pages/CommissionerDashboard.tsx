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
  Loader2, RefreshCw, AlertTriangle, BarChart3, Users, Banknote
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
}

interface Stats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  duplicates: number;
  totalAllocated: number;
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];

export default function CommissionerDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, rejected: 0, pending: 0, duplicates: 0, totalAllocated: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchApplications = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("bursary_applications")
      .select("id, tracking_number, student_type, status, poverty_tier, ai_decision_reason, allocated_amount, parent_county, created_at, is_duplicate")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive",
      });
    } else {
      const apps = data || [];
      setApplications(apps);
      
      // Calculate stats
      setStats({
        total: apps.length,
        approved: apps.filter(a => a.status === "approved").length,
        rejected: apps.filter(a => a.status === "rejected").length,
        pending: apps.filter(a => a.status === "received" || a.status === "review" || a.status === "verification").length,
        duplicates: apps.filter(a => a.is_duplicate).length,
        totalAllocated: apps.reduce((sum, a) => sum + (a.allocated_amount || 0), 0)
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
                        <TableHead>Amount</TableHead>
                        <TableHead>AI Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvedApps.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell className="font-mono">{app.tracking_number}</TableCell>
                          <TableCell className="capitalize">{app.student_type}</TableCell>
                          <TableCell>{app.parent_county}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{app.poverty_tier}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            KES {(app.allocated_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {app.ai_decision_reason || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
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
                        <TableHead>AI Reason for Rejection</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rejectedApps.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell className="font-mono">{app.tracking_number}</TableCell>
                          <TableCell>{getStatusBadge(app.status, app.is_duplicate)}</TableCell>
                          <TableCell className="capitalize">{app.student_type}</TableCell>
                          <TableCell>{app.parent_county}</TableCell>
                          <TableCell className="max-w-md text-sm">
                            <p className="text-muted-foreground">
                              {app.ai_decision_reason || "No reason provided"}
                            </p>
                          </TableCell>
                        </TableRow>
                      ))}
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
