import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CONFIRM_PHRASE = "RESET SUBMISSIONS";

interface Props {
  onCompleted?: () => void;
}

/**
 * Two-step confirmation panel for wiping all submission data + dashboard
 * metrics. Step 1: open dialog. Step 2: type the exact phrase + click confirm.
 * Calls the JWT-protected `admin-reset-submissions` edge function which
 * re-validates the admin role server-side before deleting.
 */
export function DangerZoneResetCard({ onCompleted }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);

  const phraseValid = phrase.trim() === CONFIRM_PHRASE;

  const handleReset = async () => {
    if (!phraseValid) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-reset-submissions",
        { body: { confirm: CONFIRM_PHRASE } },
      );
      if (error) throw error;
      const failed = Object.entries((data?.deleted ?? {}) as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string" && (v as string).startsWith("error:"));
      if (failed.length > 0) {
        toast({
          title: "Partial reset",
          description: `${failed.length} table(s) failed. Check logs.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Submissions wiped",
          description: "All applications and dashboard metrics have been cleared.",
        });
      }
      setOpen(false);
      setPhrase("");
      onCompleted?.();
    } catch (e) {
      toast({
        title: "Reset failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="border-destructive/40 mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible administrative actions. Two-step confirmation is required.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-medium">Reset all submission data</p>
            <p className="text-sm text-muted-foreground">
              Deletes every application, beneficiary, status history entry,
              allocation run and dashboard metric. Adverts, users and roles are
              kept.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Reset Submissions
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); if (!o) setPhrase(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm submission wipe
            </DialogTitle>
            <DialogDescription>
              This permanently deletes all applications, beneficiaries,
              allocation runs and dashboard metrics. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reset-phrase">
              Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to enable the reset button
            </Label>
            <Input
              id="reset-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={!phraseValid || busy}
            >
              {busy ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Wiping...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />Permanently delete</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
