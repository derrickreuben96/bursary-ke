// Mandatory-justification override dialog. Every override is stamped with
// officer, timestamp, original amount, new amount, and reason — all persisted
// to the audit trail via the caller's onSubmit handler.
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { StudentRecommendation } from "@/lib/ai/decisionEngine";

interface Props {
  open: boolean;
  student: StudentRecommendation;
  officerName: string;
  onClose: () => void;
  onSubmit: (payload: {
    student_id: string;
    original: number;
    new_amount: number;
    justification: string;
    officer: string;
    at: string;
  }) => Promise<void> | void;
}

export function OverrideDialog({ open, student, officerName, onClose, onSubmit }: Props) {
  const [amount, setAmount] = useState<string>(String(student.recommended_allocation));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed >= 0 && reason.trim().length >= 15;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await onSubmit({
        student_id: student.student_id,
        original: student.recommended_allocation,
        new_amount: parsed,
        justification: reason.trim(),
        officer: officerName,
        at: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override AI Recommendation</DialogTitle>
          <DialogDescription>
            Every override is recorded permanently in the audit trail. A clear
            justification is mandatory (min. 15 characters).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>Beneficiary</span>
            <span className="font-medium">{student.student_name_masked}</span>
          </div>
          <div className="flex justify-between">
            <span>Original recommendation</span>
            <span className="font-mono">
              KES {student.recommended_allocation.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>New allocation (KES)</span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-40"
              min={0}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Justification</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the AI recommendation is being overridden…"
              rows={4}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Officer: <span className="font-medium">{officerName}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || busy}>
            {busy ? "Saving…" : "Save Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
