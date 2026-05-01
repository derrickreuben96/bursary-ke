import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw } from "lucide-react";
import brandLogo from "@/assets/bursary-ke-logo.png";

interface CommissionerHeaderProps {
  assignedWard: string | null;
  assignedCounty: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

export function CommissionerHeader({ assignedWard, assignedCounty, isLoading, onRefresh, onLogout }: CommissionerHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div className="flex items-center gap-3">
        <img
          src={brandLogo}
          alt="Bursary-KE official emblem"
          className="h-12 w-12 rounded-full object-cover ring-1 ring-border shadow-sm"
        />
        <div>
          <h1 className="text-2xl font-bold text-foreground">County Education Commissioner</h1>
          <p className="text-muted-foreground">
            {assignedWard ? `Ward: ${assignedWard}` : ""}
            {assignedCounty ? ` | County: ${assignedCounty}` : ""}
            {" "}| Masked Data View
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={onRefresh}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />Logout
        </Button>
      </div>
    </div>
  );
}
