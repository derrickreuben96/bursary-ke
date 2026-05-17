import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

export default function EmailUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json();
        if (!res.ok) { setState("invalid"); setError(data?.error ?? ""); return; }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState("already");
        } else if (data.valid) {
          setState("valid");
        } else {
          setState("invalid");
        }
      } catch (e) {
        setState("invalid");
        setError(e instanceof Error ? e.message : "");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { data, error: err } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (err) { setState("error"); setError(err.message); return; }
    if (data?.success || data?.reason === "already_unsubscribed") setState("done");
    else { setState("error"); setError(data?.error ?? "Unknown error"); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-lg">
        <Card>
          <CardHeader><CardTitle>Email preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {state === "loading" && (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating link…
              </div>
            )}
            {state === "valid" && (
              <>
                <p>Click the button below to unsubscribe from emails sent to this address.</p>
                <Button onClick={confirm}>Confirm unsubscribe</Button>
              </>
            )}
            {state === "submitting" && (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…
              </div>
            )}
            {state === "done" && <p>You've been unsubscribed. You will no longer receive emails from us.</p>}
            {state === "already" && <p>This address is already unsubscribed.</p>}
            {state === "invalid" && <p className="text-destructive">This unsubscribe link is invalid or expired.{error ? ` (${error})` : ""}</p>}
            {state === "error" && <p className="text-destructive">Something went wrong. {error}</p>}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
