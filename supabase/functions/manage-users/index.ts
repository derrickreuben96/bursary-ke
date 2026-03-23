import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is admin
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

    // Check admin role
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
        return new Response(JSON.stringify({ error: "Invalid role. Must be county_commissioner or county_treasury" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Commissioner must have a ward, treasury must have a county
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

      // Create user via admin API
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Assign role
      await adminClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role,
      });

      // Create profile with ward/county assignment
      await adminClient.from("profiles").insert({
        user_id: newUser.user.id,
        email,
        display_name: displayName || email,
        assigned_county: assignedCounty || null,
        assigned_ward: assignedWard || null,
      });

      return new Response(JSON.stringify({
        success: true,
        userId: newUser.user.id,
        message: `${role} account created for ${email}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_users") {
      // Get all profiles with their roles (commissioner & treasury only)
      const { data: profiles, error: profileError } = await adminClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get roles for these users
      const userIds = (profiles || []).map(p => p.user_id);
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id, role")
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

    if (action === "delete_user") {
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Don't allow deleting yourself
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
