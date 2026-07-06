import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "list_active_bursaries",
  title: "List active bursary adverts",
  description:
    "List currently open Bursary KE adverts. Optionally filter by county or ward. Returns title, county, ward, deadline, and required documents so applicants know what to prepare.",
  inputSchema: {
    county: z.string().trim().optional().describe("Kenyan county name to filter by, e.g. 'Nairobi'."),
    ward: z.string().trim().optional().describe("Ward name to filter by (case-insensitive)."),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe("Max number of adverts to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ county, ward, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("bursary_adverts")
      .select(
        "id,title,county,ward,deadline,description,required_documents,min_award_per_student,max_award_per_student,is_active",
      )
      .eq("is_active", true)
      .gte("deadline", new Date().toISOString())
      .order("deadline", { ascending: true })
      .limit(limit ?? 20);
    if (county) q = q.ilike("county", county);
    if (ward) q = q.ilike("ward", ward);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Lookup failed: ${error.message}` }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: rows.length
            ? JSON.stringify(rows, null, 2)
            : "No active bursary adverts match those filters right now.",
        },
      ],
      structuredContent: { count: rows.length, adverts: rows },
    };
  },
});
