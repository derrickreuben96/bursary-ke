import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Props {
  totalApproved: number;
  totalAmount: number;
}

export function TreasurySummaryCards({ totalApproved, totalAmount }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Approved</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalApproved}</div>
          <p className="text-xs text-muted-foreground">applications</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Disbursement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-amber-600">KES {totalAmount.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">ready for transfer</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">eCitizen Portal</CardTitle>
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
  );
}
