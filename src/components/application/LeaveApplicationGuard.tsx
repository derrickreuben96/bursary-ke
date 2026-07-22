import { useEffect, useRef, useState, useCallback } from "react";
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
import { useApplication } from "@/context/ApplicationContext";

/**
 * Warns the applicant before they navigate away from an in-progress
 * application via the browser Back button, tab close, or refresh.
 *
 * Intentionally does NOT interfere with in-app "Back" buttons within the
 * wizard (those move between steps and preserve state). It only guards
 * true navigation away from the application page.
 */
export function LeaveApplicationGuard({ submitted = false }: { submitted?: boolean }) {
  const { data, resetApplication } = useApplication();
  const [open, setOpen] = useState(false);
  const confirmedRef = useRef(false);

  // Active whenever the applicant has begun entering data.
  const active =
    !submitted &&
    (!!data.parentGuardian ||
      (data.students && data.students.length > 0) ||
      !!data.educationLevels);

  useEffect(() => {
    if (!active) return;

    // Push a sentinel state so the first Back press fires popstate on this page
    // instead of leaving immediately.
    window.history.pushState({ __bkeGuard: true }, "");

    const onPop = () => {
      if (confirmedRef.current) return;
      // Stay on the page until the user decides.
      window.history.pushState({ __bkeGuard: true }, "");
      setOpen(true);
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);

  const handleQuit = useCallback(() => {
    confirmedRef.current = true;
    resetApplication();
    setOpen(false);
    // Step back past our sentinel + the original entry.
    window.history.go(-1);
  }, [resetApplication]);

  const handleStay = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this application?</AlertDialogTitle>
          <AlertDialogDescription>
            You have an active application in progress. Going back will erase
            everything you have entered so far and you will need to start over.
            Are you sure you want to quit?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleStay}>
            Stay on this page
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleQuit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Quit and erase
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
