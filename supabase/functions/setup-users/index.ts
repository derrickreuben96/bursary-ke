import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserSetup {
  email: string;
  password: string;
  role: "admin" | "county_treasury" | "county_commissioner";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const usersToSetup: UserSetup[] = [
      { email: "admin@bursary.go.ke", password: "123456", role: "admin" },
      { email: "countytreasury@bursary.go.ke", password: "123456", role: "county_treasury" },
      { email: "commissioner@bursary.go.ke", password: "123456", role: "county_commissioner" },
    ];

    const results = [];

    for (const userSetup of usersToSetup) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === userSetup.email);

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        console.log(`User ${userSetup.email} already exists:`, userId);
      } else {
        // Create the user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userSetup.email,
          password: userSetup.password,
          email_confirm: true,
        });

        if (createError) {
          console.error(`Error creating ${userSetup.email}:`, createError);
          results.push({ email: userSetup.email, success: false, error: createError.message });
          continue;
        }

        userId = newUser.user.id;
        console.log(`Created user ${userSetup.email}:`, userId);
      }

      // Check if role already exists
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", userSetup.role)
        .maybeSingle();

      if (!existingRole) {
        // Assign role
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: userSetup.role });

        if (roleError) {
          console.error(`Error assigning role for ${userSetup.email}:`, roleError);
          results.push({ email: userSetup.email, success: false, error: roleError.message });
          continue;
        }
        console.log(`Assigned ${userSetup.role} role to ${userSetup.email}`);
      } else {
        console.log(`Role ${userSetup.role} already assigned to ${userSetup.email}`);
      }

      results.push({ email: userSetup.email, success: true, role: userSetup.role });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User setup complete",
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error setting up users:", error);
    return new Response(
      JSON.stringify({ success: false, error: "User setup failed. Please contact system administrator." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
