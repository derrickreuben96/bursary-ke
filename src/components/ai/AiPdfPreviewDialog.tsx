import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileSearch, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import type jsPDF from "jspdf";

interface AiPdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Factory that returns a fresh jsPDF doc to preview / download. */
  buildDoc: (() => jsPDF) | null;
  /** Filename used when the user clicks "Download". */
  filename: string;
  title?: string;
  /** Optional extra footer action button (rendered between Close and Download). */
  extraFooterAction?: React.ReactNode;
  /** Optional callback fired after a successful download. */
  onDownloaded?: () => void;
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
  extraFooterAction,
  onDownloaded,
}: AiPdfPreviewDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "building" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep the latest builder in a ref so changing the parent's arrow-function
  // identity does NOT retrigger the (heavy) PDF build effect on every render.
  const buildDocRef = useRef(buildDoc);
  useEffect(() => {
    buildDocRef.current = buildDoc;
  }, [buildDoc]);

  // Only depend on `open` — we want exactly one build per dialog open.
  useEffect(() => {
    if (!open) return;
    const builder = buildDocRef.current;
    if (!builder) return;

    setStatus("building");
    setErrorMsg(null);
    setBlobUrl(null);

    let url: string | null = null;
    let cancelled = false;
    // Defer to next tick so the spinner paints before the (potentially heavy) PDF build.
    const handle = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const doc = builder();
        const blob = doc.output("blob");
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setStatus("loading");
      } catch (e) {
        console.error("PDF preview build failed:", e);
        setErrorMsg(e instanceof Error ? e.message : "Failed to build preview.");
        setStatus("error");
      }
    }, 30);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      if (url) URL.revokeObjectURL(url);
    };
  }, [open]);

  const handleDownload = () => {
    const builder = buildDocRef.current;
    if (!builder) return;
    try {
      const doc = builder();
      doc.save(filename);
      onDownloaded?.();
    } catch (e) {
      console.error("PDF download failed:", e);
      setErrorMsg(e instanceof Error ? e.message : "Failed to download PDF.");
      setStatus("error");
    }
  };

  const openInNewTab = () => {
    if (blobUrl) window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  const showOverlay = status === "building" || status === "loading";

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

        <div className="flex-1 min-h-0 rounded-md border border-border bg-muted/30 overflow-hidden relative">
          {status === "error" ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium text-foreground">
                Couldn't render the preview
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                {errorMsg ?? "Unknown error while building the PDF."} You can
                still try downloading the file directly.
              </p>
            </div>
          ) : (
            <>
              {blobUrl && (
                <iframe
                  src={blobUrl}
                  title="PDF preview"
                  className="w-full h-full"
                  onLoad={() => setStatus("ready")}
                  onError={() => {
                    setErrorMsg("Browser failed to render the PDF preview.");
                    setStatus("error");
                  }}
                />
              )}
              {showOverlay && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/60 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    {status === "building"
                      ? "Building PDF…"
                      : "Loading preview…"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This may take a moment for large reports.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {blobUrl && status !== "error" && (
            <Button variant="outline" onClick={openInNewTab}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in new tab
            </Button>
          )}
          <Button onClick={handleDownload} disabled={!buildDoc || status === "building"}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
