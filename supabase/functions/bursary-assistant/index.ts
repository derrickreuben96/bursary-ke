import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPTS = {
  faq: `You are a helpful assistant for the Kenya Bursary Application Portal. You answer questions about:
- Bursary eligibility requirements (Kenyan citizen, enrolled in recognized institution, financial need)
- Application process (fill form, submit documents, get tracking number)
- Required documents (national ID, school admission letter, income declaration, death certificates if applicable)
- Poverty assessment and tiers (Low, Medium, High based on household income and dependents)
- Application status tracking using tracking number and parent ID
- Disbursement timelines (typically 4-8 weeks after approval)
- Secondary school vs university applications

Keep answers clear, concise, and helpful. Use bullet points for lists. If you don't know something specific, suggest contacting the Bursary Office.`,

  form: `You are a form assistant helping users fill out the Kenya Bursary Application form correctly. You help with:
- Explaining what each field requires
- Validating input formats (phone numbers, IDs, emails)
- Providing examples of correct entries
- Explaining the poverty questionnaire scoring
- Clarifying institution name and student ID requirements

Be concise and practical. Give specific examples when helpful.`
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, type = "faq" } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = SYSTEM_PROMPTS[type as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.faq;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: unknown) {
    console.error("Bursary assistant error:", error);
    return new Response(
      JSON.stringify({ error: "Assistant service unavailable. Please try again later." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
