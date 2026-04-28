import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileSearch } from "lucide-react";
import type jsPDF from "jspdf";

interface AiPdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Factory that returns a fresh jsPDF doc to preview / download. */
  buildDoc: (() => jsPDF) | null;
  /** Filename used when the user clicks "Download". */
  filename: string;
  title?: string;
}

/**
 * Renders a generated jsPDF document in an iframe so the user can review
 * the bilingual footer and contents before saving the file locally.
 */
export function AiPdfPreviewDialog({
  open,
  onOpenChange,
  buildDoc,
  filename,
  title = "Preview report",
}: AiPdfPreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !buildDoc) {
      return;
    }
    const doc = buildDoc();
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setBlobUrl(null);
    };
  }, [open, buildDoc]);

  const handleDownload = () => {
    if (!buildDoc) return;
    const doc = buildDoc();
    doc.save(filename);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Review the report (including the bilingual footer) before
            downloading. The file is generated locally — nothing is uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-md border border-border bg-muted/30 overflow-hidden">
          {blobUrl ? (
            <iframe
              src={blobUrl}
              title="PDF preview"
              className="w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Preparing preview…
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleDownload} disabled={!blobUrl}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
