// Household Reports panel — Phase 3 additive UI.
// Renders the two-dimensional metrics tiles + PDF/Excel export buttons.
// Consumes the shared household data hook, so it works identically on
// Admin / Commissioner / Treasury dashboards.
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, FileSpreadsheet, AlertTriangle, BarChart3 } from "lucide-react";
import type { Household } from "@/lib/household/types";
import {
  computeReportMetrics,
  filterHouseholds,
} from "@/lib/reporting/metricsEngine";
import type { ReportFilter } from "@/lib/reporting/types";
import { exportHouseholdReportPdf } from "@/lib/reporting/exportPdf";
import { exportHouseholdReportExcel } from "@/lib/reporting/exportExcel";
import { detectDataQualityFlags } from "@/lib/reporting/duplicateDetector";

interface Props {
  households: Household[];
  officer?: string;
  role?: "admin" | "commissioner" | "treasury";
}

const KES = (n: number) => `KES ${n.toLocaleString()}`;

export function HouseholdReportPanel({
  households,
  officer = "system",
  role = "admin",
}: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [level, setLevel] = useState<string>("");

  const filter: ReportFilter = useMemo(
    () => ({
      search: search || null,
      status: status || null,
      educationLevel: (level || null) as ReportFilter["educationLevel"],
    }),
    [search, status, level],
  );

  const filtered = useMemo(
    () => filterHouseholds(households, filter),
    [households, filter],
  );
  const metrics = useMemo(() => computeReportMetrics(filtered), [filtered]);
  const flags = useMemo(() => detectDataQualityFlags(filtered), [filtered]);

  const meta = () => ({
    generatedAt: new Date().toISOString(),
    generatedBy: officer,
    filters: filter,
    format: "pdf" as const,
    version: "3.0",
  });

  return (
    <Card className="hover:shadow-kenya transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Household &amp; Beneficiary Reports
          <span className="ml-auto text-xs font-normal text-muted-foreground uppercase">
            {role}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="Search tracking / parent / county"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="received">Received</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="allocated">Allocated</option>
            <option value="disbursed">Disbursed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">All education levels</option>
            <option value="secondary">Secondary</option>
            <option value="university">University</option>
            <option value="college">College</option>
            <option value="tvet">TVET</option>
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() =>
                exportHouseholdReportPdf(filtered, metrics, {
                  ...meta(),
                  format: "pdf",
                })
              }
            >
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() =>
                exportHouseholdReportExcel(filtered, metrics, {
                  ...meta(),
                  format: "excel",
                })
              }
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>

        {/* Two-dimension metrics tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Tile label="Households" value={metrics.households} />
          <Tile label="Beneficiaries" value={metrics.beneficiaries} />
          <Tile label="Secondary" value={metrics.secondaryBeneficiaries} />
          <Tile label="Higher Education" value={metrics.higherEdBeneficiaries} />
          <Tile
            label="Avg / Household"
            value={metrics.avgBeneficiariesPerHousehold}
          />
          <Tile label="Disabled" value={metrics.disabledBeneficiaries} />
          <Tile label="Approved" value={metrics.approvedHouseholds} />
          <Tile
            label="Pending / Rejected"
            value={`${metrics.pendingHouseholds} / ${metrics.rejectedHouseholds}`}
          />
        </div>

        {/* Budget row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Tile label="Requested" value={KES(metrics.budgetRequested)} />
          <Tile label="Recommended" value={KES(metrics.budgetRecommended)} />
          <Tile label="Allocated" value={KES(metrics.budgetAllocated)} />
          <Tile label="Remaining" value={KES(metrics.budgetRemaining)} />
        </div>

        {/* Data quality flags (auditability) */}
        {flags.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Data Quality Flags · {flags.length}
            </div>
            <ul className="space-y-1 text-xs list-disc pl-5 max-h-40 overflow-y-auto">
              {flags.slice(0, 20).map((f, i) => (
                <li key={i}>
                  <span className="font-mono mr-1">[{f.code}]</span>
                  {f.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
