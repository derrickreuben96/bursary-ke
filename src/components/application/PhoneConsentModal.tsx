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
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();

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
            {t("consent.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {t("consent.intro_prefix")}{" "}
            <strong className="text-foreground">({phoneNumber})</strong>{" "}
            {t("consent.intro_suffix")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 my-4">
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
            <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">
                {t("consent.feature_status_title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("consent.feature_status_desc")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
            <Bell className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">
                {t("consent.feature_allocations_title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("consent.feature_allocations_desc")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm text-foreground">
                {t("consent.feature_privacy_title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("consent.feature_privacy_desc")}
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel
            onClick={onDecline}
            className="w-full sm:w-auto"
          >
            {t("consent.decline")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConsent}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            {t("consent.accept")}
          </AlertDialogAction>
        </AlertDialogFooter>

        <p className="text-xs text-muted-foreground text-center mt-2">
          {t("consent.opt_out")}
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}
