import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadedDoc {
  name: string;
  label: string;
  path: string;
  size: number;
}

interface DocumentUploadProps {
  requiredDocs: string[];
  onDocumentsChange: (docs: UploadedDoc[]) => void;
  trackingNumber?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];

export function DocumentUpload({ requiredDocs, onDocumentsChange, trackingNumber }: DocumentUploadProps) {
  const [uploads, setUploads] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload PDF, JPG, or PNG files only.", variant: "destructive" });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }

    setUploading(label);
    try {
      const prefix = trackingNumber || `temp-${Date.now()}`;
      const ext = file.name.split(".").pop();
      const path = `${prefix}/${label.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.${ext}`;

      const { error } = await supabase.storage
        .from("applicant-documents")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const newDoc: UploadedDoc = { name: file.name, label, path, size: file.size };
      const updated = [...uploads.filter((u) => u.label !== label), newDoc];
      setUploads(updated);
      onDocumentsChange(updated);

      toast({ title: "Uploaded", description: `${label} uploaded successfully.` });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: "Could not upload file. Please try again.", variant: "destructive" });
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeDoc = (label: string) => {
    const updated = uploads.filter((u) => u.label !== label);
    setUploads(updated);
    onDocumentsChange(updated);
  };

  const getDocStatus = (label: string) => uploads.find((u) => u.label === label);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Upload Required Documents</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Upload clear scans or photos of the required documents. Max 5MB per file. PDF, JPG, PNG accepted.
      </p>

      <div className="grid gap-3">
        {requiredDocs.map((doc) => {
          const uploaded = getDocStatus(doc);
          const isUploading = uploading === doc;

          return (
            <Card key={doc} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {uploaded ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc}</p>
                    {uploaded && (
                      <p className="text-xs text-muted-foreground truncate">
                        {uploaded.name} ({(uploaded.size / 1024).toFixed(0)}KB)
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {uploaded ? (
                    <>
                      <Badge variant="secondary" className="text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400">
                        Uploaded
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDoc(doc)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        ref={activeLabel === doc ? fileInputRef : undefined}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileSelect(e, doc)}
                        onClick={() => setActiveLabel(doc)}
                      />
                      <Button variant="outline" size="sm" disabled={isUploading} asChild>
                        <span>
                          {isUploading ? (
                            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading</>
                          ) : (
                            <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload</>
                          )}
                        </span>
                      </Button>
                    </label>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {uploads.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {uploads.length} of {requiredDocs.length} documents uploaded
        </p>
      )}
    </div>
  );
}
