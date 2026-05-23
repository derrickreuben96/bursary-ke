import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileSearch, Loader2, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import type jsPDF from "jspdf";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Use the worker bundled with pdfjs-dist via Vite's ?url import. This works
// reliably inside the Lovable sandboxed preview iframe (where <object
// type="application/pdf"> renders as a broken file icon).
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
 * Renders a generated jsPDF document directly with pdf.js so the preview
 * works inside sandboxed iframes (where native <object>/<iframe> PDF embeds
 * fail). Supports paging through multi-page reports.
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
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [status, setStatus] = useState<"idle" | "building" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const buildDocRef = useRef(buildDoc);
  useEffect(() => {
    buildDocRef.current = buildDoc;
  }, [buildDoc]);

  // Track container width so the rendered page fits responsively.
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, status]);

  // Build the PDF once per open.
  useEffect(() => {
    if (!open) {
      setPdfData(null);
      setBlobUrl(null);
      setNumPages(0);
      setPageNumber(1);
      return;
    }
    const builder = buildDocRef.current;
    if (!builder) return;

    setStatus("building");
    setErrorMsg(null);
    setBlobUrl(null);
    setPdfData(null);

    let url: string | null = null;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const doc = builder();
        const blob = doc.output("blob");
        url = URL.createObjectURL(blob);
        // Read into a Uint8Array for pdf.js (avoids any blob-url fetch quirks
        // inside sandboxed iframes).
        blob.arrayBuffer().then((buf) => {
          if (cancelled) return;
          setPdfData(new Uint8Array(buf));
          setBlobUrl(url);
          setStatus("loading");
        }).catch((e) => {
          if (cancelled) return;
          setErrorMsg(e instanceof Error ? e.message : "Failed to read PDF.");
          setStatus("error");
        });
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

  // Stable file prop for react-pdf (must not change identity each render).
  const fileProp = useMemo(() => (pdfData ? { data: pdfData } : null), [pdfData]);

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
  const renderWidth = Math.max(320, Math.min(containerWidth - 32, 1000));

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

        <div
          ref={containerRef}
          className="flex-1 min-h-0 rounded-md border border-border bg-muted/30 overflow-auto relative"
        >
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
              {fileProp && (
                <div className="flex flex-col items-center py-4">
                  <Document
                    file={fileProp}
                    onLoadSuccess={({ numPages: n }) => {
                      setNumPages(n);
                      setStatus("ready");
                    }}
                    onLoadError={(e) => {
                      console.error("PDF load error:", e);
                      setErrorMsg(e?.message ?? "Failed to load PDF.");
                      setStatus("error");
                    }}
                    loading={null}
                    error={null}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={renderWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="shadow-md"
                    />
                  </Document>
                </div>
              )}
              {showOverlay && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/60 backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    {status === "building" ? "Building PDF…" : "Loading preview…"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This may take a moment for large reports.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {numPages > 1 && status === "ready" && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

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
          {extraFooterAction}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
