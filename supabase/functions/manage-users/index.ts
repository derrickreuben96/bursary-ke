import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeForEmail(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create_user") {
      const { email, password, role, displayName, assignedCounty, assignedWard } = body;

      if (!email || !password || !role) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!["county_commissioner", "county_treasury"].includes(role)) {
        return new Response(JSON.stringify({ error: "Invalid role" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (role === "county_commissioner" && !assignedWard) {
        return new Response(JSON.stringify({ error: "Commissioner must be assigned a ward" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (role === "county_treasury" && !assignedCounty) {
        return new Response(JSON.stringify({ error: "Treasury user must be assigned a county" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role });
      await adminClient.from("profiles").insert({
        user_id: newUser.user.id, email,
        display_name: displayName || email,
        assigned_county: assignedCounty || null,
        assigned_ward: assignedWard || null,
        password_changed_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        success: true, userId: newUser.user.id,
        message: `${role} account created for ${email}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "bulk_create") {
      const { accounts } = body;
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return new Response(JSON.stringify({ error: "No accounts provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: { email: string; success: boolean; error?: string }[] = [];

      for (const acc of accounts) {
        const { email, password, role, displayName, assignedCounty, assignedWard } = acc;
        try {
          // Check if email already exists in profiles
          const { data: existing } = await adminClient
            .from("profiles").select("id").eq("email", email).maybeSingle();
          if (existing) {
            results.push({ email, success: false, error: "Already exists" });
            continue;
          }

          const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email, password, email_confirm: true,
          });

          if (createError) {
            results.push({ email, success: false, error: createError.message });
            continue;
          }

          await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role });
          await adminClient.from("profiles").insert({
            user_id: newUser.user.id, email,
            display_name: displayName || email,
            assigned_county: assignedCounty || null,
            assigned_ward: assignedWard || null,
            password_changed_at: new Date().toISOString(),
          });

          results.push({ email, success: true });
        } catch (e) {
          results.push({ email, success: false, error: e instanceof Error ? e.message : "Unknown error" });
        }
      }

      const created = results.filter(r => r.success).length;
      const skipped = results.filter(r => !r.success).length;

      return new Response(JSON.stringify({
        success: true, created, skipped, total: accounts.length, results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_users") {
      const { data: profiles, error: profileError } = await adminClient
        .from("profiles").select("*").order("created_at", { ascending: false });

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userIds = (profiles || []).map(p => p.user_id);
      const { data: roles } = await adminClient
        .from("user_roles").select("user_id, role")
        .in("user_id", userIds);

      const rolesMap = new Map<string, string>();
      (roles || []).forEach(r => rolesMap.set(r.user_id, r.role));

      const result = (profiles || []).map(p => ({
        ...p,
        role: rolesMap.get(p.user_id) || "unknown",
      }));

      return new Response(JSON.stringify({ success: true, users: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_user") {
      const { userId, displayName, assignedCounty, assignedWard, newPassword } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, unknown> = {};
      if (displayName !== undefined) updates.display_name = displayName;
      if (assignedCounty !== undefined) updates.assigned_county = assignedCounty;
      if (assignedWard !== undefined) updates.assigned_ward = assignedWard;

      if (Object.keys(updates).length > 0) {
        await adminClient.from("profiles").update(updates).eq("user_id", userId);
      }

      if (newPassword) {
        const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
          password: newPassword,
        });
        if (pwError) {
          return new Response(JSON.stringify({ error: pwError.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await adminClient.from("profiles").update({
          password_changed_at: new Date().toISOString(),
        }).eq("user_id", userId);
      }

      return new Response(JSON.stringify({ success: true, message: "User updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { userId, newPassword } = body;
      if (!userId || !newPassword) {
        return new Response(JSON.stringify({ error: "userId and newPassword required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (pwError) {
        return new Response(JSON.stringify({ error: pwError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("profiles").update({
        password_changed_at: new Date().toISOString(),
      }).eq("user_id", userId);

      return new Response(JSON.stringify({ success: true, message: "Password reset" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("profiles").delete().eq("user_id", userId);
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.auth.admin.deleteUser(userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
