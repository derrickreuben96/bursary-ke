import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, 
  FileText, 
  Loader2, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Users,
  DollarSign,
  MapPin,
  Scale,
  ShieldAlert,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AllocationResult {
  trackingNumber: string;
  studentName: string;
  institution: string;
  county: string;
  povertyScore: number;
  povertyTier: string;
  recommendedAmount: number;
  allocationReason: string;
}

interface TreasuryReport {
  generatedAt: string;
  fiscalYear: string;
  totalBudget: number;
  totalAllocated: number;
  totalApplicants: number;
  selectedApplicants: number;
  allocations: AllocationResult[];
  countyBreakdown: Record<string, { count: number; amount: number }>;
  tierBreakdown: Record<string, { count: number; amount: number }>;
  summary: string;
}

export default function AdminAllocation() {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [budget, setBudget] = useState("10000000");
  const [fiscalYear, setFiscalYear] = useState("2024/2025");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [allocationReport, setAllocationReport] = useState<TreasuryReport | null>(null);
  const [treasuryReport, setTreasuryReport] = useState<string>("");

  const analyzeApplications = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("allocate-bursary", {
        body: { 
          action: "analyze",
          budget: parseInt(budget),
          fiscalYear,
        },
      });

      if (error) throw error;

      setAnalysisResult(data.analysis);
      toast({
        title: "Analysis Complete",
        description: `Found ${data.analysis.totalApplicants} pending applications`,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: "Could not analyze applications",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runAllocation = async () => {
    setIsAllocating(true);
    try {
      const { data, error } = await supabase.functions.invoke("allocate-bursary", {
        body: { 
          action: "allocate",
          budget: parseInt(budget),
          fiscalYear,
        },
      });

      if (error) throw error;

      setAllocationReport(data.report);
      toast({
        title: "Allocation Complete",
        description: `${data.report.selectedApplicants} applicants approved for funding`,
      });
    } catch (error) {
      console.error("Allocation error:", error);
      toast({
        title: "Allocation Failed",
        description: "Could not run allocation",
        variant: "destructive",
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const generateTreasuryReport = async () => {
    setIsGeneratingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke("allocate-bursary", {
        body: { 
          action: "generate-treasury-report",
          fiscalYear,
        },
      });

      if (error) throw error;

      setTreasuryReport(data.treasuryReport);
      toast({
        title: "Report Generated",
        description: "Treasury report ready for download",
      });
    } catch (error) {
      console.error("Report error:", error);
      toast({
        title: "Report Generation Failed",
        description: "Could not generate treasury report",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const downloadReport = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
              <Bot className="h-8 w-8 text-primary" />
              AI Bursary Allocation System
            </h1>
            <p className="text-muted-foreground">
              Automated allocation of bursary funds using AI-powered poverty assessment analysis
            </p>
          </div>

          {/* Configuration */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Allocation Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Budget (KES)</label>
                <Input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="10000000"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Fiscal Year</label>
                <Input
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  placeholder="2024/2025"
                />
              </div>
            </div>
          </Card>

          {/* Tabs for different actions */}
          <Tabs defaultValue="analyze" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analyze">1. Analyze</TabsTrigger>
              <TabsTrigger value="allocate">2. Allocate</TabsTrigger>
              <TabsTrigger value="report">3. Treasury Report</TabsTrigger>
            </TabsList>

            {/* Analyze Tab */}
            <TabsContent value="analyze">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Analyze Applications</h3>
                    <p className="text-sm text-muted-foreground">
                      Review pending applications and get AI recommendations
                    </p>
                  </div>
                  <Button onClick={analyzeApplications} disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Run Analysis
                      </>
                    )}
                  </Button>
                </div>

                {analysisResult && (
                  <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="p-4 bg-primary/5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Users className="h-4 w-4" />
                          Total Applicants
                        </div>
                        <p className="text-2xl font-bold">{analysisResult.totalApplicants}</p>
                      </Card>
                      <Card className="p-4 bg-accent/5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" />
                          Budget
                        </div>
                        <p className="text-2xl font-bold">KES {parseInt(budget).toLocaleString()}</p>
                      </Card>
                    </div>

                    {analysisResult.aiRecommendations && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Bot className="h-5 w-5 text-primary" />
                          AI Recommendations
                        </h4>
                        <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                          {analysisResult.aiRecommendations}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Allocate Tab */}
            <TabsContent value="allocate">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Run Allocation</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatically allocate funds based on poverty scores
                    </p>
                  </div>
                  <Button 
                    onClick={runAllocation} 
                    disabled={isAllocating}
                    variant="default"
                  >
                    {isAllocating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Allocating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Run Allocation
                      </>
                    )}
                  </Button>
                </div>

                {allocationReport && (
                  <div className="space-y-6 mt-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="p-4 bg-green-500/10">
                        <p className="text-sm text-muted-foreground">Selected</p>
                        <p className="text-2xl font-bold text-green-600">
                          {allocationReport.selectedApplicants}
                        </p>
                      </Card>
                      <Card className="p-4 bg-primary/10">
                        <p className="text-sm text-muted-foreground">Allocated</p>
                        <p className="text-2xl font-bold">
                          KES {allocationReport.totalAllocated.toLocaleString()}
                        </p>
                      </Card>
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">High Priority</p>
                        <p className="text-2xl font-bold text-red-600">
                          {allocationReport.tierBreakdown.High?.count || 0}
                        </p>
                      </Card>
                      <Card className="p-4">
                        <p className="text-sm text-muted-foreground">Counties</p>
                        <p className="text-2xl font-bold">
                          {Object.keys(allocationReport.countyBreakdown).length}
                        </p>
                      </Card>
                    </div>

                    {/* Tier Breakdown */}
                    <div>
                      <h4 className="font-semibold mb-3">Allocation by Tier</h4>
                      <div className="space-y-2">
                        {Object.entries(allocationReport.tierBreakdown).map(([tier, data]) => (
                          <div key={tier} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Badge variant={tier === "High" ? "destructive" : tier === "Medium" ? "secondary" : "outline"}>
                                {tier}
                              </Badge>
                              <span>{data.count} students</span>
                            </div>
                            <span className="font-semibold">KES {data.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary Text */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">Allocation Summary</h4>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => downloadReport(allocationReport.summary, `allocation-report-${fiscalYear.replace("/", "-")}.txt`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                      <Textarea
                        value={allocationReport.summary}
                        readOnly
                        className="h-64 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Treasury Report Tab */}
            <TabsContent value="report">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Generate Treasury Report</h3>
                    <p className="text-sm text-muted-foreground">
                      AI-generated official report for National Treasury submission
                    </p>
                  </div>
                  <Button 
                    onClick={generateTreasuryReport} 
                    disabled={isGeneratingReport}
                  >
                    {isGeneratingReport ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Report
                      </>
                    )}
                  </Button>
                </div>

                {treasuryReport && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        AI-Generated Treasury Report
                      </h4>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => downloadReport(treasuryReport, `treasury-report-${fiscalYear.replace("/", "-")}.txt`)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download for Treasury
                      </Button>
                    </div>
                    <Textarea
                      value={treasuryReport}
                      readOnly
                      className="h-96 font-mono text-xs"
                    />
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
