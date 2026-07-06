import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "track_application",
  title: "Track bursary application",
  description:
    "Look up the current status and progress of a Bursary KE application by its tracking number (format BKE-XXXXXX). Returns stage, county/ward, submission date, and (if any) allocation amount. PII such as parent/student names, phone, and ID numbers is never returned.",
  inputSchema: {
    tracking_number: z
      .string()
      .min(6)
      .max(24)
      .describe("Public tracking number issued at submission, e.g. BKE-123456."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tracking_number }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const tn = tracking_number.trim().toUpperCase();
    const { data, error } = await supabase.rpc("get_application_by_tracking", {
      _tracking_number: tn,
    });
    if (error) {
      return { content: [{ type: "text", text: `Lookup failed: ${error.message}` }], isError: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        content: [{ type: "text", text: `No application found for ${tn}.` }],
        structuredContent: { found: false, tracking_number: tn },
      };
    }
    const summary = {
      tracking_number: tn,
      status: row.status ?? null,
      stage: row.current_stage ?? row.stage ?? null,
      county: row.parent_county ?? row.county ?? null,
      ward: row.parent_ward ?? row.ward ?? null,
      submitted_at: row.created_at ?? row.submitted_at ?? null,
      allocated_amount: row.allocated_amount ?? null,
      advert_title: row.advert_title ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: { found: true, ...summary },
    };
  },
});
