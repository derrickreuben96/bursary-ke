import { useState, useEffect } from "react";
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
import {
  UserPlus, LogOut, Loader2, Trash2, ArrowLeft, Users, Shield,
  GraduationCap, Landmark, RefreshCw, Eye, EyeOff,
} from "lucide-react";

// Sample wards per county (extensible)
const wardsByCounty: Record<string, string[]> = {
  "Nairobi": ["Westlands", "Dagoretti North", "Dagoretti South", "Langata", "Kibra", "Roysambu", "Kasarani", "Ruaraka", "Embakasi South", "Embakasi North", "Embakasi Central", "Embakasi East", "Embakasi West", "Makadara", "Kamukunji", "Starehe", "Mathare"],
  "Mombasa": ["Changamwe", "Jomvu", "Kisauni", "Nyali", "Likoni", "Mvita"],
  "Kisumu": ["Kisumu East", "Kisumu West", "Kisumu Central", "Seme", "Nyando", "Muhoroni", "Nyakach"],
  "Nakuru": ["Nakuru Town East", "Nakuru Town West", "Naivasha", "Gilgil", "Subukia", "Rongai", "Bahati", "Molo", "Njoro", "Kuresoi North", "Kuresoi South"],
  "Kiambu": ["Thika Town", "Ruiru", "Juja", "Gatundu South", "Gatundu North", "Githunguri", "Kiambu", "Kiambaa", "Kabete", "Kikuyu", "Limuru", "Lari"],
  "Machakos": ["Machakos Town", "Mavoko", "Masinga", "Yatta", "Kangundo", "Matungulu", "Kathiani", "Mwala"],
  "Kakamega": ["Lugari", "Likuyani", "Malava", "Lurambi", "Navakholo", "Mumias West", "Mumias East", "Matungu", "Butere", "Khwisero", "Shinyalu", "Ikolomani"],
  "Uasin Gishu": ["Soy", "Turbo", "Moiben", "Ainabkoi", "Kapseret", "Kesses"],
};

interface ManagedUser {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  assigned_county: string | null;
  assigned_ward: string | null;
  created_at: string;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<string>("");
  const [county, setCounty] = useState("");
  const [ward, setWard] = useState("");

  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const availableWards = county && wardsByCounty[county] ? wardsByCounty[county] : [];

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "create_user",
        email,
        password,
        role,
        displayName,
        assignedCounty: county,
        assignedWard: role === "county_commissioner" ? ward : null,
      },
    });

    if (error || data?.error) {
      toast({
        title: "Failed to create user",
        description: data?.error || error?.message || "Unknown error",
        variant: "destructive",
      });
    } else {
      toast({ title: "User Created", description: data.message });
      setEmail(""); setPassword(""); setDisplayName(""); setRole(""); setCounty(""); setWard("");
      setShowForm(false);
      fetchUsers();
    }
    setIsCreating(false);
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}?`)) return;

    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete_user", userId },
    });

    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Failed to delete user", variant: "destructive" });
    } else {
      toast({ title: "User Deleted", description: `${userEmail} has been removed` });
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
          <div className="flex gap-2">
            <Button onClick={() => setShowForm(!showForm)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Account
            </Button>
            <Button variant="outline" size="icon" onClick={fetchUsers}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="h-4 w-4 mr-2" />Logout
            </Button>
          </div>
        </div>

        {/* Create User Form */}
        {showForm && (
          <Card className="mb-8 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Create New Account
              </CardTitle>
              <CardDescription>
                Create a Commissioner (ward-scoped) or Treasury (county-scoped) account
              </CardDescription>
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
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters" required minLength={6}
                    />
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
                      {kenyanCounties.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {role === "county_commissioner" && (
                  <div className="space-y-2">
                    <Label>Ward *</Label>
                    <Select value={ward} onValueChange={setWard} disabled={!county}>
                      <SelectTrigger><SelectValue placeholder={county ? "Select ward" : "Select county first"} /></SelectTrigger>
                      <SelectContent>
                        {availableWards.length > 0 ? (
                          availableWards.map(w => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__other" disabled>No wards configured for this county</SelectItem>
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
              <Users className="h-5 w-5" />
              Managed Accounts ({users.length})
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
                <p>No managed accounts yet. Click "Create Account" to add one.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Ward</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(u => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-mono text-sm">{u.email}</TableCell>
                      <TableCell>{u.display_name || "—"}</TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell>{u.assigned_county || "—"}</TableCell>
                      <TableCell>{u.assigned_ward || (u.role === "county_treasury" ? "All wards" : "—")}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteUser(u.user_id, u.email)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Scope Rules:</strong> Commissioners are assigned to a specific ward and can only view applications from that ward.
            Treasury users are assigned to a county and can manage disbursements for all wards within their county.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
