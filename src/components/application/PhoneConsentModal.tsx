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
import { Phone, MessageSquare, Bell, Shield } from "lucide-react";

interface PhoneConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsent: () => void;
  onDecline: () => void;
  phoneNumber: string;
}

export function PhoneConsentModal({
  open,
  onOpenChange,
  onConsent,
  onDecline,
  phoneNumber,
}: PhoneConsentModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-8 w-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Communication Consent Required
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            <p className="mb-4">
              We would like to use your phone number <strong className="text-foreground">({phoneNumber})</strong> to send you important updates about:
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 my-4">
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
            <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">Application Status Updates</p>
              <p className="text-xs text-muted-foreground">SMS notifications when your application status changes</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
            <Bell className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">Bursary Allocations</p>
              <p className="text-xs text-muted-foreground">Notifications about fund disbursement and allocations</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">Your Privacy is Protected</p>
              <p className="text-xs text-muted-foreground">Your number is encrypted and never shared with third parties</p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel 
            onClick={onDecline}
            className="w-full sm:w-auto"
          >
            No, Don't Send Messages
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConsent}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            Yes, I Consent
          </AlertDialogAction>
        </AlertDialogFooter>

        <p className="text-xs text-muted-foreground text-center mt-2">
          You can opt-out anytime by replying STOP to any message
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}
