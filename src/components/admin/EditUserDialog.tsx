import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface ManagedUser {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  assigned_county: string | null;
  assigned_ward: string | null;
}

interface EditUserDialogProps {
  user: ManagedUser | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditUserDialog({ user, open, onClose, onSaved }: EditUserDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && user) {
      setDisplayName(user.display_name || "");
      setNewPassword("");
    }
    if (!isOpen) onClose();
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "update_user",
        userId: user.user_id,
        displayName,
        assignedCounty: user.assigned_county,
        assignedWard: user.assigned_ward,
        newPassword: newPassword || undefined,
      },
    });

    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `${user.email} updated successfully` });
      onSaved();
      onClose();
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>New Password (leave blank to keep current)</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={6}
              />
              <Button type="button" variant="ghost" size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
