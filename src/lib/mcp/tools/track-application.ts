import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "track_application",
  title: "Track bursary application",
  description:
    "Look up the current status of a Bursary KE application by its tracking number (BKE-XXXXXX). To protect applicant privacy, the applicant's phone number OR national ID must also be provided as a verification value — without a matching value nothing is returned. Never returns names or other PII.",
  inputSchema: {
    tracking_number: z
      .string()
      .describe("Public tracking number issued at submission, e.g. BKE-ABC123."),
    verification_type: z
      .enum(["phone", "national_id"])
      .describe("Which private detail is being used to verify ownership of the application."),
    verification_value: z
      .string()
      .min(4)
      .describe("The parent's phone number (any Kenyan format) or national ID, matching verification_type."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tracking_number, verification_type, verification_value }) => {
    const url = `${process.env.SUPABASE_URL}/functions/v1/track-application`;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({
        trackingNumber: tracking_number.trim().toUpperCase(),
        verificationType: verification_type,
        verificationValue: verification_value.trim(),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.message ?? body?.error ?? `HTTP ${res.status}`;
      return { content: [{ type: "text", text: String(msg) }], isError: res.status >= 500 };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
      structuredContent: body,
    };
  },
});
