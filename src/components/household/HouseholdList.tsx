// Search + filter + expand-preserving list wrapper. All UI state is
// persisted via useDashboardState so tab switches never reset the officer.
import { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw } from "lucide-react";
import type { Household } from "@/lib/household/types";
import type { DashboardRole } from "@/lib/household/statusEngine";
import { HouseholdCard } from "./HouseholdCard";
import { useDashboardState, useDashboardSet } from "@/hooks/useDashboardState";
import type { StatusHistoryRow } from "@/lib/household/auditEngine";
import type { HouseholdAction } from "@/lib/household/workflowEngine";

interface Props {
  households: Household[];
  role: DashboardRole;
  storageKey: string;
  historyByHouseholdId?: Record<string, StatusHistoryRow[]>;
  onAction: (action: HouseholdAction, h: Household) => void;
  busyAction?: HouseholdAction | null;
  pendingNewCount?: number;
  onAcknowledgeNew?: () => void;
  onRefresh?: () => void;
}

export function HouseholdList({
  households, role, storageKey, historyByHouseholdId = {},
  onAction, busyAction, pendingNewCount = 0, onAcknowledgeNew, onRefresh,
}: Props) {
  const [query, setQuery] = useDashboardState<string>(`${storageKey}.q`, "");
  const [expandedSet, toggleExpanded] = useDashboardSet(`${storageKey}.expanded`);
  const deferredQ = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQ.trim().toLowerCase();
    if (!q) return households;
    return households.filter(h =>
      h.tracking_number.toLowerCase().includes(q)
      || h.parent_name_masked.toLowerCase().includes(q)
      || (h.parent_ward ?? "").toLowerCase().includes(q)
      || h.students.some(s => s.name_masked.toLowerCase().includes(q) || (s.institution_name ?? "").toLowerCase().includes(q))
    );
  }, [households, deferredQ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tracking #, parent, ward, student or institution"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        {pendingNewCount > 0 && (
          <Button size="sm" variant="secondary" onClick={() => { onAcknowledgeNew?.(); onRefresh?.(); }}>
            {pendingNewCount === 1 ? "1 New Application — Refresh" : `${pendingNewCount} New Applications — Refresh`}
          </Button>
        )}
        {onRefresh && (
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No households match your view.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(h => (
            <HouseholdCard
              key={h.id}
              household={h}
              role={role}
              expanded={expandedSet.has(h.id)}
              onToggle={toggleExpanded}
              history={historyByHouseholdId[h.id] ?? []}
              onAction={onAction}
              busyAction={busyAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
