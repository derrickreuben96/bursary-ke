import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ResetEvent {
  id: string;
  created_at: string;
  severity: string;
  source: string | null;
  details: Record<string, unknown>;
}

/**
 * Read-only audit panel listing every submission/metric wipe.
 * Source of truth: public.security_events where event_type='admin_reset_submissions'.
 * Both the edge function (`admin-reset-submissions`) and any direct SQL wipe
 * insert a row here, so this is the canonical reset trail.
 */
export function ResetAuditLogPanel() {
  const [events, setEvents] = useState<ResetEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("security_events")
      .select("id, created_at, severity, source, details")
      .eq("event_type", "admin_reset_submissions")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setEvents(data as ResetEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-KE", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const summarizeDeleted = (details: Record<string, unknown>) => {
    const d = (details?.deleted ?? {}) as Record<string, unknown>;
    const entries = Object.entries(d);
    if (entries.length === 0) return "—";
    return entries
      .map(([t, v]) => `${t}:${typeof v === "number" ? v : String(v)}`)
      .join(" • ");
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Reset Audit Log
          </CardTitle>
          <CardDescription>
            Every submission/metric wipe — actor, affected tables, timestamp. Read-only.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No reset actions recorded yet.
          </p>
        ) : (
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Affected Tables</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => {
                  const actor =
                    (ev.details?.actor as string | undefined) ??
                    (ev.details?.method as string | undefined) ??
                    "unknown";
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(ev.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs break-all max-w-[180px]">{actor}</TableCell>
                      <TableCell className="text-xs">{ev.source ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={ev.severity === "critical" ? "destructive" : "secondary"}>
                          {ev.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md">
                        {summarizeDeleted(ev.details)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
