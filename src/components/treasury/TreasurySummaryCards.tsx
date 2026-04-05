import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Props {
  totalApproved: number;
  totalAmount: number;
  disbursedCount?: number;
}

export function TreasurySummaryCards({ totalApproved, totalAmount, disbursedCount = 0 }: Props) {
  const pendingCount = totalApproved - disbursedCount;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalApproved}</div>
          <p className="text-xs text-muted-foreground">released to treasury</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pending Disbursement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
          <p className="text-xs text-muted-foreground">awaiting fund transfer</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Disbursed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-emerald-600">{disbursedCount}</div>
          <p className="text-xs text-muted-foreground">funds sent</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount (KES)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAmount.toLocaleString()}</div>
          <Button asChild size="sm" className="mt-2 w-full bg-amber-600 hover:bg-amber-700">
            <a href="https://www.ecitizen.go.ke" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              eCitizen Portal
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
