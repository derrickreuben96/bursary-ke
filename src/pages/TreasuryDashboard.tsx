import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Landmark, LogOut, Search, Download, ExternalLink, 
  CheckCircle2, Loader2, RefreshCw, Copy, FileText
} from "lucide-react";
import { maskName } from "@/lib/maskData";

interface ApprovedApplication {
  id: string;
  tracking_number: string;
  student_name_masked: string;
  institution_name: string;
  student_type: string;
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

  // Fetch assigned county from profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("assigned_county")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setAssignedCounty(data.assigned_county);
      }
    };
    fetchProfile();
  }, [user]);

  const fetchApprovedApplications = async () => {
    setIsLoading(true);
    // Use restricted treasury view that only exposes payment-related fields
    // This view masks PII and excludes sensitive personal details
    const { data, error } = await supabase
      .from("bursary_applications_treasury")
      .select("id, tracking_number, student_name_masked, institution_name, student_type, allocated_amount, ecitizen_ref, county, allocation_date")
      .order("allocation_date", { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
      toast({
        title: "Error",
        description: "Failed to load approved applications",
        variant: "destructive",
      });
    } else {
      let apps = data || [];
      // Filter by assigned county if treasury user has one
      if (assignedCounty) {
        apps = apps.filter((a: any) => a.county === assignedCounty);
      }
      setApplications(apps);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchApprovedApplications();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("treasury-applications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bursary_applications",
          filter: "status=eq.approved",
        },
        () => {
          fetchApprovedApplications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const copyEcitizenRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast({
      title: "Copied",
      description: "eCitizen reference copied to clipboard",
    });
  };

  const filteredApplications = applications.filter(app =>
    app.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.institution_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.county.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = applications.reduce((sum, app) => sum + (app.allocated_amount || 0), 0);

  const exportToCSV = async () => {
    // Fetch fairness summary for the report
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
      app.tracking_number,
      app.institution_name,
      app.student_type,
      app.allocated_amount?.toString() || "0",
      app.ecitizen_ref || "",
      app.county,
      app.allocation_date ? new Date(app.allocation_date).toLocaleDateString() : ""
    ]);

    // Add fairness distribution report section
    const fairnessSection = [
      [],
      ["FAIRNESS DISTRIBUTION REPORT"],
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

    toast({
      title: "Exported",
      description: "Disbursement list with fairness report exported to CSV",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        {/* Header Section */}
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
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{applications.length}</div>
              <p className="text-xs text-muted-foreground">applications</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Disbursement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                KES {totalAmount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">ready for transfer</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                eCitizen Portal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-amber-600 hover:bg-amber-700">
                <a href="https://www.ecitizen.go.ke" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open eCitizen
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle>Approved Applications</CardTitle>
                <CardDescription>
                  Applications ready for fund disbursement via eCitizen
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search applications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={fetchApprovedApplications}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
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
                      <TableHead>County</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                      <TableHead>eCitizen Ref</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-mono font-medium">
                          {app.tracking_number}
                        </TableCell>
                        <TableCell>{app.institution_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {app.student_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{app.county}</TableCell>
                        <TableCell className="text-right font-medium">
                          {(app.allocated_amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {app.ecitizen_ref || "—"}
                            </code>
                            {app.ecitizen_ref && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyEcitizenRef(app.ecitizen_ref)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {app.allocation_date
                            ? new Date(app.allocation_date).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Privacy Notice */}
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Security Notice:</strong> This data is for official County Treasury use only. 
            All access is logged and audited. Student names are masked for privacy compliance.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
