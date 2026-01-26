import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bell, Search, Loader2, Trash2, MapPin, Mail, Phone, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Subscription {
  id: string;
  county: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

const Unsubscribe = () => {
  const [searchType, setSearchType] = useState<"phone" | "email">("phone");
  const [searchValue, setSearchValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const formatPhoneForSearch = (phone: string): string => {
    let formatted = phone.replace(/\s/g, "");
    if (formatted.startsWith("0")) {
      formatted = "+254" + formatted.substring(1);
    } else if (!formatted.startsWith("+")) {
      formatted = "+254" + formatted;
    }
    return formatted;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchValue.trim()) {
      toast({
        title: "Enter a value",
        description: `Please enter your ${searchType === "phone" ? "phone number" : "email address"} to search.`,
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      let query = supabase.from("bursary_subscriptions").select("*");

      if (searchType === "phone") {
        const formattedPhone = formatPhoneForSearch(searchValue);
        query = query.eq("phone", formattedPhone);
      } else {
        query = query.eq("email", searchValue.trim().toLowerCase());
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("[Unsubscribe] Search error:", error);
        toast({
          title: "Search failed",
          description: "Unable to find subscriptions. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setSubscriptions(data || []);

      if (!data || data.length === 0) {
        toast({
          title: "No subscriptions found",
          description: `No subscriptions found for this ${searchType === "phone" ? "phone number" : "email address"}.`,
        });
      }
    } catch (err) {
      console.error("[Unsubscribe] Unexpected error:", err);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUnsubscribe = async (id: string) => {
    setDeletingId(id);

    try {
      const { error } = await supabase
        .from("bursary_subscriptions")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("[Unsubscribe] Delete error:", error);
        toast({
          title: "Unsubscribe failed",
          description: "Unable to remove subscription. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      toast({
        title: "Unsubscribed successfully",
        description: "You will no longer receive notifications for this county.",
      });
    } catch (err) {
      console.error("[Unsubscribe] Unexpected error:", err);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const maskContact = (value: string | null, type: "phone" | "email"): string => {
    if (!value) return "—";
    if (type === "phone") {
      return value.slice(0, 4) + "***" + value.slice(-3);
    }
    const [local, domain] = value.split("@");
    return local.slice(0, 2) + "***@" + domain;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12 bg-gradient-to-b from-background to-secondary/20">
        <div className="container max-w-2xl">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <Bell className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Manage Your Subscriptions
            </h1>
            <p className="text-muted-foreground">
              View and manage your bursary notification subscriptions.
            </p>
          </div>

          {/* Search Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Find Your Subscriptions</CardTitle>
              <CardDescription>
                Enter the phone number or email you used when subscribing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                {/* Search Type Toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={searchType === "phone" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSearchType("phone")}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Phone Number
                  </Button>
                  <Button
                    type="button"
                    variant={searchType === "email" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSearchType("email")}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email Address
                  </Button>
                </div>

                {/* Search Input */}
                <div className="space-y-2">
                  <Label htmlFor="search">
                    {searchType === "phone" ? "Phone Number" : "Email Address"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="search"
                      type={searchType === "phone" ? "tel" : "email"}
                      placeholder={searchType === "phone" ? "0712 345 678" : "you@example.com"}
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={isSearching}>
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results */}
          {hasSearched && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Your Subscriptions ({subscriptions.length})
              </h2>

              {subscriptions.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <XCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No subscriptions found for this {searchType === "phone" ? "phone number" : "email address"}.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {subscriptions.map((sub) => (
                    <Card key={sub.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {/* County */}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-primary/5">
                                <MapPin className="h-3 w-3 mr-1" />
                                {sub.county}
                              </Badge>
                              {sub.is_active ? (
                                <Badge className="bg-primary/10 text-primary border-primary/30">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>

                            {/* Contact Info */}
                            <div className="text-sm text-muted-foreground space-y-1">
                              {sub.phone && (
                                <p className="flex items-center gap-2">
                                  <Phone className="h-3.5 w-3.5" />
                                  {maskContact(sub.phone, "phone")}
                                </p>
                              )}
                              {sub.email && (
                                <p className="flex items-center gap-2">
                                  <Mail className="h-3.5 w-3.5" />
                                  {maskContact(sub.email, "email")}
                                </p>
                              )}
                            </div>

                            {/* Date */}
                            <p className="text-xs text-muted-foreground">
                              Subscribed on {format(new Date(sub.created_at), "MMM d, yyyy")}
                            </p>
                          </div>

                          {/* Unsubscribe Button */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deletingId === sub.id}
                              >
                                {deletingId === sub.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Unsubscribe
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Unsubscribe from {sub.county}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  You will no longer receive notifications when new bursaries open in {sub.county}. 
                                  You can always subscribe again later.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleUnsubscribe(sub.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Yes, Unsubscribe
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Unsubscribe;
