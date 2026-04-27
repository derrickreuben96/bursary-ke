import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

interface AiPdfConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Optional override for the report description shown in the dialog body. */
  reportLabel?: string;
}

/**
 * Confidentiality acknowledgement dialog shown before any AI-generated PDF
 * is produced. The user MUST tick the checkbox before the confirm action
 * becomes enabled.
 */
export function AiPdfConsentDialog({
  open,
  onOpenChange,
  onConfirm,
  reportLabel = "AI executive summary",
}: AiPdfConsentDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset state every time dialog re-opens
  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Confidentiality Acknowledgement
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                You are about to generate a {reportLabel}. The PDF contains
                aggregated, anonymised data only — no personally identifiable
                information (PII) is included.
              </p>
              <p>
                By proceeding you confirm the report will be handled in
                accordance with the{" "}
                <strong className="text-foreground">
                  Kenya Data Protection Act, 2019
                </strong>{" "}
                and used solely for authorised official purposes.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <Checkbox
            id="ai-pdf-consent"
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="ai-pdf-consent"
            className="text-sm font-normal leading-snug cursor-pointer"
          >
            I acknowledge the confidentiality disclaimer and confirm that this
            report will only be shared with authorised personnel.
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!acknowledged}
            onClick={() => {
              if (!acknowledged) return;
              onConfirm();
            }}
          >
            Generate PDF
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
