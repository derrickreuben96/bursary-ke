import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useKenyaLocations } from "@/lib/useKenyaLocations";
import { Plus, Pencil, ArrowLeft, Loader2, Filter, X } from "lucide-react";

const DEFAULT_REQUIRED_DOCUMENTS = [
  "National ID (Parent/Guardian)",
  "Birth Certificate",
  "School Admission Letter",
  "Fee Structure",
  "Academic Transcripts",
  "Death Certificate (if orphan)",
  "Medical Certificate (if disabled)",
].join("\n");

interface Advert {
  id: string;
  title: string;
  county: string;
  ward: string | null;
  deadline: string;
  budget_amount: number | null;
  min_beneficiaries: number | null;
  description: string | null;
  is_active: boolean | null;
  required_documents: string[] | null;
  venues: any;
}

interface FormData {
  title: string;
  county: string;
  ward: string;
  deadline: string;
  budget_amount: string;
  min_beneficiaries: string;
  description: string;
  required_documents: string;
}

const emptyForm: FormData = {
  title: "",
  county: "",
  ward: "",
  deadline: "",
  budget_amount: "",
  min_beneficiaries: "",
  description: "",
  required_documents: DEFAULT_REQUIRED_DOCUMENTS,
};

interface FilterState {
  search: string;
  status: "all" | "active" | "inactive" | "expired";
  county: string;
  ward: string;
  deadlineFrom: string;
  deadlineTo: string;
}

const emptyFilters: FilterState = {
  search: "",
  status: "all",
  county: "all",
  ward: "all",
  deadlineFrom: "",
  deadlineTo: "",
};

export default function AdminAdverts() {
  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { wardsByCounty, countyNames, loading: locationsLoading } = useKenyaLocations();

  const fetchAdverts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("bursary_adverts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: "Failed to load adverts", variant: "destructive" });
    } else {
      setAdverts(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAdverts();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (advert: Advert) => {
    setEditingId(advert.id);
    setForm({
      title: advert.title,
      county: advert.county,
      ward: advert.ward || "",
      deadline: advert.deadline ? new Date(advert.deadline).toISOString().slice(0, 16) : "",
      budget_amount: advert.budget_amount?.toString() || "",
      min_beneficiaries: advert.min_beneficiaries?.toString() || "",
      description: advert.description || "",
      required_documents: (advert.required_documents || []).join("\n"),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.county || !form.deadline) {
      toast({ title: "Validation Error", description: "Title, county, and deadline are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const requiredDocs = form.required_documents
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const payload = {
      title: form.title,
      county: form.county,
      ward: form.ward || null,
      deadline: form.deadline,
      budget_amount: form.budget_amount ? parseFloat(form.budget_amount) : null,
      min_beneficiaries: form.min_beneficiaries ? parseInt(form.min_beneficiaries) : null,
      description: form.description || null,
      required_documents: requiredDocs,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("bursary_adverts").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("bursary_adverts").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: editingId ? "Advert updated." : "Advert created." });
      setDialogOpen(false);
      fetchAdverts();
    }
    setIsSubmitting(false);
  };

  const filteredAdverts = adverts.filter((a) => {
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const haystack = `${a.title} ${a.description ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.county !== "all" && a.county !== filters.county) return false;
    if (filters.ward !== "all" && (a.ward ?? "") !== filters.ward) return false;
    const deadlineMs = new Date(a.deadline).getTime();
    const isExpired = deadlineMs <= Date.now();
    if (filters.status === "active" && !(a.is_active && !isExpired)) return false;
    if (filters.status === "inactive" && a.is_active) return false;
    if (filters.status === "expired" && !isExpired) return false;
    if (filters.deadlineFrom) {
      if (deadlineMs < new Date(filters.deadlineFrom).getTime()) return false;
    }
    if (filters.deadlineTo) {
      if (deadlineMs > new Date(filters.deadlineTo).getTime() + 86_400_000) return false;
    }
    return true;
  });

  const activeFilterCount = [
    filters.search.trim(),
    filters.status !== "all",
    filters.county !== "all",
    filters.ward !== "all",
    filters.deadlineFrom,
    filters.deadlineTo,
  ].filter(Boolean).length;

  const openFilters = () => {
    setDraftFilters(filters);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
  };

  const wardOptions = draftFilters.county !== "all" ? wardsByCounty[draftFilters.county] ?? [] : [];

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Manage Bursary Adverts</h1>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Button variant="outline" onClick={openFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="icon" onClick={clearFilters} aria-label="Clear filters">
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Advert
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : adverts.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No adverts yet. Create one to get started.</p>
            ) : filteredAdverts.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">
                No adverts match the selected filters.{" "}
                <button onClick={clearFilters} className="text-primary underline">Clear filters</button>
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Docs</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdverts.map((a) => {
                    const isExpired = new Date(a.deadline).getTime() <= Date.now();
                    return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>{a.county}{a.ward ? ` / ${a.ward}` : ""}</TableCell>
                      <TableCell>{new Date(a.deadline).toLocaleDateString("en-KE")}</TableCell>
                      <TableCell>{a.budget_amount ? `KES ${a.budget_amount.toLocaleString()}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={isExpired ? "destructive" : a.is_active ? "default" : "secondary"}>
                          {isExpired ? "Expired" : a.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.required_documents?.length || 0} items
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Advert" : "Create New Advert"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Nairobi County Bursary 2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>County *</Label>
                  <Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} placeholder="e.g. Nairobi" />
                </div>
                <div>
                  <Label>Ward (optional)</Label>
                  <Input value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} placeholder="e.g. Westlands" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Deadline *</Label>
                  <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
                <div>
                  <Label>Budget (KES)</Label>
                  <Input type="number" value={form.budget_amount} onChange={(e) => setForm({ ...form, budget_amount: e.target.value })} placeholder="e.g. 5000000" />
                </div>
              </div>
              <div>
                <Label>Min. Beneficiaries (internal only)</Label>
                <Input type="number" value={form.min_beneficiaries} onChange={(e) => setForm({ ...form, min_beneficiaries: e.target.value })} placeholder="e.g. 50" />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of applicants to approve. This number is not shown publicly in the advert.
                </p>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Brief description of this bursary..." />
              </div>
              <div>
                <Label>Required Documents (one per line)</Label>
                <Textarea
                  value={form.required_documents}
                  onChange={(e) => setForm({ ...form, required_documents: e.target.value })}
                  rows={7}
                  placeholder="One document per line..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Applicants will see this list when they apply for this bursary.
                </p>
              </div>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Update Advert" : "Create Advert"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Filter Adverts</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Search by title or description</Label>
                <Input
                  value={draftFilters.search}
                  onChange={(e) => setDraftFilters({ ...draftFilters, search: e.target.value })}
                  placeholder="e.g. Nairobi 2026"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={draftFilters.status}
                  onValueChange={(v) =>
                    setDraftFilters({ ...draftFilters, status: v as FilterState["status"] })
                  }
                >
                  <SelectTrigger aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>County</Label>
                  <Select
                    value={draftFilters.county}
                    onValueChange={(v) => setDraftFilters({ ...draftFilters, county: v, ward: "all" })}
                  >
                    <SelectTrigger aria-label="County">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="all">All counties</SelectItem>
                      {Object.keys(wardsByCounty).sort().map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ward</Label>
                  <Select
                    value={draftFilters.ward}
                    onValueChange={(v) => setDraftFilters({ ...draftFilters, ward: v })}
                    disabled={draftFilters.county === "all"}
                  >
                    <SelectTrigger aria-label="Ward">
                      <SelectValue placeholder={draftFilters.county === "all" ? "Select county first" : "All"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="all">All wards</SelectItem>
                      {wardOptions.map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Deadline from</Label>
                  <Input
                    type="date"
                    value={draftFilters.deadlineFrom}
                    onChange={(e) => setDraftFilters({ ...draftFilters, deadlineFrom: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Deadline to</Label>
                  <Input
                    type="date"
                    value={draftFilters.deadlineTo}
                    onChange={(e) => setDraftFilters({ ...draftFilters, deadlineTo: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDraftFilters(emptyFilters);
                }}
              >
                Reset
              </Button>
              <Button onClick={applyFilters}>Apply filters</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}
