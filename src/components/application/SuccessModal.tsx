import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Check, Home, FileSearch } from "lucide-react";

interface SuccessModalProps {
  isOpen: boolean;
  trackingNumber: string;
  onClose: () => void;
}

export function SuccessModal({ isOpen, trackingNumber, onClose }: SuccessModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(trackingNumber);
    setCopied(true);
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 animate-scale-in">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl text-center">
            Application Submitted!
          </DialogTitle>
          <DialogDescription className="text-center">
            Your bursary application has been successfully submitted and is now being processed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tracking Number */}
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">Your Tracking Number</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-mono font-bold text-foreground">
                {trackingNumber}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="h-8 w-8"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Important Notice */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 text-sm">
            <p className="font-medium text-foreground mb-1">Important!</p>
            <p className="text-muted-foreground">
              Save this tracking number. You'll need it to check your application status. 
              We've also sent it to your phone via SMS.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to={`/track?number=${trackingNumber}`}>
                <FileSearch className="mr-2 h-4 w-4" />
                Track Application
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
