import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Inbox, CheckCircle2, XCircle, Banknote, Star, ShieldAlert } from "lucide-react";

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

export function CommissionerStatsCards({ stats }: { stats: Stats }) {
  return (
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
  );
}
