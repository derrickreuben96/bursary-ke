import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { kenyanCounties } from "@/lib/mockData";
import { wardsByCounty } from "@/lib/kenyanWards";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import {
  UserPlus, LogOut, Loader2, Trash2, ArrowLeft, Users, Shield,
  GraduationCap, Landmark, RefreshCw, Eye, EyeOff, Pencil,
  AlertTriangle, Zap, KeyRound, Search, Filter, X,
} from "lucide-react";

interface ManagedUser {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  assigned_county: string | null;
  assigned_ward: string | null;
  created_at: string;
  password_changed_at: string | null;
}

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

function isPasswordExpired(passwordChangedAt: string | null): boolean {
  if (!passwordChangedAt) return true;
  return Date.now() - new Date(passwordChangedAt).getTime() > THREE_MONTHS_MS;
}

function sanitizeForEmail(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<string>("");
  const [county, setCounty] = useState("");
  const [ward, setWard] = useState("");

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterCounty, setFilterCounty] = useState<string>("all");
  const [filterWard, setFilterWard] = useState<string>("all");

  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const availableWards = county && wardsByCounty[county] ? wardsByCounty[county] : [];

  // Derived filter options from actual data
  const countyOptions = useMemo(() => [...new Set(users.map(u => u.assigned_county).filter(Boolean) as string[])].sort(), [users]);
  const filterWardOptions = useMemo(() => {
    const base = filterCounty !== "all"
      ? users.filter(u => u.assigned_county === filterCounty)
      : users;
    return [...new Set(base.map(u => u.assigned_ward).filter(Boolean) as string[])].sort();
  }, [users, filterCounty]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = searchQuery.toLowerCase();
      if (q && !u.email.toLowerCase().includes(q) && !(u.display_name || "").toLowerCase().includes(q) && !(u.assigned_county || "").toLowerCase().includes(q) && !(u.assigned_ward || "").toLowerCase().includes(q)) return false;
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (filterCounty !== "all" && u.assigned_county !== filterCounty) return false;
      if (filterWard !== "all" && u.assigned_ward !== filterWard) return false;
      return true;
    });
  }, [users, searchQuery, filterRole, filterCounty, filterWard]);

  const expiredPasswordUsers = useMemo(
    () => users.filter(u => u.role !== "admin" && isPasswordExpired(u.password_changed_at)),
    [users]
  );

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "list_users" },
    });
    if (error) {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } else if (data?.users) {
      setUsers(data.users);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "create_user", email, password, role, displayName,
        assignedCounty: county,
        assignedWard: role === "county_commissioner" ? ward : null,
      },
    });
    if (error || data?.error) {
      toast({ title: "Failed", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "User Created", description: data.message });
      setEmail(""); setPassword(""); setDisplayName(""); setRole(""); setCounty(""); setWard("");
      setShowForm(false);
      fetchUsers();
    }
    setIsCreating(false);
  };

  const handleBulkCreate = async () => {
    if (!confirm("This will create commissioner accounts for all wards and treasury accounts for all counties. Existing accounts will be skipped. Continue?")) return;

    setIsBulkCreating(true);
    const accounts: {
      email: string; password: string; role: string;
      displayName: string; assignedCounty: string; assignedWard: string | null;
    }[] = [];

    // Treasury accounts: one per county
    for (const countyName of Object.keys(wardsByCounty)) {
      const slug = sanitizeForEmail(countyName);
      accounts.push({
        email: `treasury_${slug}@bursary.go.ke`,
        password: "123456",
        role: "county_treasury",
        displayName: `Treasury ${countyName}`,
        assignedCounty: countyName,
        assignedWard: null,
      });
    }

    // Commissioner accounts: one per ward
    for (const [countyName, wards] of Object.entries(wardsByCounty)) {
      for (const wardName of wards) {
        const slug = sanitizeForEmail(wardName);
        accounts.push({
          email: `commissioner_${slug}@bursary.go.ke`,
          password: "123456",
          role: "county_commissioner",
          displayName: `Commissioner ${wardName}`,
          assignedCounty: countyName,
          assignedWard: wardName,
        });
      }
    }

    // Send in batches of 20
    const batchSize = 20;
    let totalCreated = 0;
    let totalSkipped = 0;

    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "bulk_create", accounts: batch },
      });
      if (data?.created) totalCreated += data.created;
      if (data?.skipped) totalSkipped += data.skipped;
      if (error) {
        toast({ title: "Batch error", description: error.message, variant: "destructive" });
      }
    }

    toast({
      title: "Bulk Creation Complete",
      description: `Created: ${totalCreated}, Skipped (existing): ${totalSkipped} out of ${accounts.length} total`,
    });
    fetchUsers();
    setIsBulkCreating(false);
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}?`)) return;
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete_user", userId },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Failed to delete", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: `${userEmail} removed` });
      fetchUsers();
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    const newPw = prompt(`Enter new password for ${userEmail}:`, "123456");
    if (!newPw) return;
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "reset_password", userId, newPassword: newPw },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Password Reset", description: `Password updated for ${userEmail}` });
      fetchUsers();
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case "county_commissioner":
        return <Badge className="bg-blue-100 text-blue-700"><GraduationCap className="h-3 w-3 mr-1" />Commissioner</Badge>;
      case "county_treasury":
        return <Badge className="bg-amber-100 text-amber-700"><Landmark className="h-3 w-3 mr-1" />Treasury</Badge>;
      case "admin":
        return <Badge className="bg-green-100 text-green-700"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
      default:
        return <Badge variant="secondary">{r}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">User Management</h1>
              <p className="text-muted-foreground">Create and manage Commissioner & Treasury accounts</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBulkCreate} disabled={isBulkCreating} variant="secondary">
              {isBulkCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Auto-Create All
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              <UserPlus className="h-4 w-4 mr-2" />Create Account
            </Button>
            <Button variant="outline" size="icon" onClick={fetchUsers}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4 mr-2" />Logout
            </Button>
          </div>
        </div>

        {/* Password Expiry Alert */}
        {expiredPasswordUsers.length > 0 && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Password Rotation Required</p>
              <p className="text-sm text-muted-foreground">
                {expiredPasswordUsers.length} account(s) have passwords older than 3 months. Click the key icon to reset.
              </p>
            </div>
          </div>
        )}

        {/* Create User Form */}
        {showForm && (
          <Card className="mb-8 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />Create New Account
              </CardTitle>
              <CardDescription>Create a Commissioner (ward-scoped) or Treasury (county-scoped) account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={role} onValueChange={(v) => { setRole(v); setCounty(""); setWard(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="county_commissioner">
                        <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" />Ward Commissioner</span>
                      </SelectItem>
                      <SelectItem value="county_treasury">
                        <span className="flex items-center gap-2"><Landmark className="h-4 w-4" />County Treasury</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. John Kamau" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@county.go.ke" required />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required minLength={6} />
                    <Button type="button" variant="ghost" size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>County *</Label>
                  <Select value={county} onValueChange={(v) => { setCounty(v); setWard(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select county" /></SelectTrigger>
                    <SelectContent>
                      {kenyanCounties.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {role === "county_commissioner" && (
                  <div className="space-y-2">
                    <Label>Ward *</Label>
                    <Select value={ward} onValueChange={setWard} disabled={!county}>
                      <SelectTrigger><SelectValue placeholder={county ? "Select ward" : "Select county first"} /></SelectTrigger>
                      <SelectContent>
                        {availableWards.length > 0 ? availableWards.map(w => (
                          <SelectItem key={w} value={w}>{w}</SelectItem>
                        )) : (
                          <SelectItem value="__other" disabled>No wards configured</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {county && availableWards.length === 0 && (
                      <div className="space-y-2">
                        <Label>Enter Ward Name</Label>
                        <Input value={ward} onChange={e => setWard(e.target.value)} placeholder="Enter ward name manually" />
                      </div>
                    )}
                  </div>
                )}
                <div className="md:col-span-2 flex gap-2 pt-2">
                  <Button type="submit" disabled={isCreating || !role || !email || !password || !county || (role === "county_commissioner" && !ward)}>
                    {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <><UserPlus className="h-4 w-4 mr-2" />Create Account</>}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* User List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />Managed Accounts ({users.length})
            </CardTitle>
            <CardDescription>Commissioner and Treasury accounts created by admin</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No managed accounts yet. Click "Create Account" or "Auto-Create All" to add accounts.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead>Ward</TableHead>
                      <TableHead>Password Age</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => {
                      const expired = u.role !== "admin" && isPasswordExpired(u.password_changed_at);
                      return (
                        <TableRow key={u.user_id} className={expired ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs">{u.email}</TableCell>
                          <TableCell>{u.display_name || "—"}</TableCell>
                          <TableCell>{getRoleBadge(u.role)}</TableCell>
                          <TableCell>{u.assigned_county || "—"}</TableCell>
                          <TableCell>{u.assigned_ward || (u.role === "county_treasury" ? "All wards" : "—")}</TableCell>
                          <TableCell>
                            {u.password_changed_at ? (
                              <span className={expired ? "text-destructive font-semibold" : "text-muted-foreground"}>
                                {expired && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                {Math.floor((Date.now() - new Date(u.password_changed_at).getTime()) / (1000 * 60 * 60 * 24))}d ago
                              </span>
                            ) : (
                              <span className="text-destructive">Never</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(u.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" title="Edit"
                                onClick={() => setEditingUser(u)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Reset Password"
                                className={expired ? "text-destructive" : ""}
                                onClick={() => handleResetPassword(u.user_id, u.email)}>
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteUser(u.user_id, u.email)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Scope Rules:</strong> Commissioners are assigned to a specific ward and can only view applications from that ward.
            Treasury users are assigned to a county and can manage disbursements for all wards within their county.
            Passwords must be rotated every 3 months for compliance.
          </p>
        </div>
      </main>
      <Footer />

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={fetchUsers}
      />
    </div>
  );
}
