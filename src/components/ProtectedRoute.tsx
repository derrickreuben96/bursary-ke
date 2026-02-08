import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type AppRole = "admin" | "county_treasury" | "county_commissioner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requireAdmin = false, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();
  const [hasRole, setHasRole] = useState<boolean | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setIsCheckingRole(false);
        return;
      }

      // If only requireAdmin is set (legacy support), use the isAdmin from context
      if (requireAdmin && !requiredRole) {
        setIsCheckingRole(false);
        return;
      }

      // If requiredRole is specified, check for that specific role
      if (requiredRole) {
        try {
          const { data, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", requiredRole)
            .maybeSingle();

          if (error) {
            console.error("Error checking role:", error);
            setHasRole(false);
          } else {
            setHasRole(!!data);
          }
        } catch (err) {
          console.error("Role check failed:", err);
          setHasRole(false);
        }
      }
      
      setIsCheckingRole(false);
    };

    checkRole();
  }, [user, requiredRole, requireAdmin]);

  // Determine the appropriate login redirect based on the required role
  const getLoginPath = () => {
    if (requiredRole === "county_treasury") return "/treasury/login";
    if (requiredRole === "county_commissioner") return "/commissioner/login";
    return "/admin/login";
  };

  if (isLoading || isCheckingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={getLoginPath()} state={{ from: location }} replace />;
  }

  // Check for admin role (legacy requireAdmin prop)
  if (requireAdmin && !requiredRole && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <div className="text-center max-w-md p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You do not have administrator privileges to access this area.
          </p>
          <a href="/" className="text-primary hover:underline">
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  // Check for specific role
  if (requiredRole && !hasRole) {
    const roleDisplayName = requiredRole.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <div className="text-center max-w-md p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You do not have {roleDisplayName} privileges to access this area.
          </p>
          <a href="/" className="text-primary hover:underline">
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
