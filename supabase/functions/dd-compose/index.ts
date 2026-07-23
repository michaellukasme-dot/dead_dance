// ============================================================================
// dd-compose — Supabase Edge Function (Deno)
// The "let the words flow" ghostwriter. Given the user's OWN past posts (their
// locally-learned voice samples) it drafts a short post/comment/DM in THAT voice,
// using Sonnet. Style is learned from the samples; content stays the user's — the
// draft always lands editable in their box. Family-friendly, first person, no cursing.
//
// Each user is a BLANK SLATE: with no samples yet it writes a warm, generic
// Dead-family line and gets more "them" as their sample set grows on-device.
//
// DEPLOY (JWT-verified so only signed-in users can spend the key):
//   supabase functions deploy dd-compose
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx      (same key as dd-group-synth)
// ============================================================================
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODEL = "claude-sonnet-5";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function clampSamples(s: unknown): string[] {
  if (!Array.isArray(s)) return [];
  return s.map((x) => String(x || "").replace(/\s+/g, " ").trim())
          .filter((x) => x.length >= 4).slice(0, 12);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let kind = "post", samples: string[] = [], context: Record<string, string> = {};
  try {
    const b = await req.json();
    kind = String(b?.kind || "post");
    samples = clampSamples(b?.samples);
    context = (b?.context && typeof b.context === "object") ? b.context : {};
  } catch { /* defaults */ }

  const voice = samples.length
    ? "Here are the user's OWN recent posts — mirror THEIR voice: sentence length, rhythm, " +
      "emoji habits, capitalization, how warm or terse they are. Do not copy their words, " +
      "match their FEEL.\n" + samples.map((s, i) => `${i + 1}. ${s}`).join("\n")
    : "The user has no samples yet (blank slate). Write a warm, genuine Grateful-Dead-family " +
      "line with an easy, welcoming tone.";

  let task = "";
  if (kind === "group") {
    task = `Draft a short post for the "${context.group || "Grateful Dead"}" group thread. 1–3 sentences.`;
  } else if (kind === "comment") {
    task = context.post
      ? `Draft a short, genuine reply to this post: "${String(context.post).slice(0, 300)}". 1–2 sentences, on-topic.`
      : "Draft a short, friendly comment. 1–2 sentences.";
  } else if (kind === "dm") {
    task = `Draft a short, warm opening direct message to ${context.to || "a friend"}. 1–2 sentences, casual.`;
  } else {
    task = "Draft a short post for the family feed. 1–3 sentences." +
           (context.song ? ` They're currently listening to "${context.song}" — you may nod to it if it fits naturally.` : "");
  }

  const prompt =
    "You are ghostwriting for a Grateful Dead fan on a social app called DeadDance. " +
    "Write in the FIRST PERSON as them. " + task + "\n\n" + voice + "\n\n" +
    "RULES: family-friendly, no profanity, no hashtags unless the samples use them, keep it real " +
    "and specific (not corporate or hype). A rose emoji 🌹 is on-brand but optional. " +
    "Return ONLY the drafted text — no quotes, no preamble, no explanation.";

  let text = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 320,
        temperature: 0.85,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json();
    text = (j?.content?.[0]?.text || "").trim().replace(/^["'“”]+|["'“”]+$/g, "");
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 502, headers: { ...CORS, "content-type": "application/json" } });
  }

  return new Response(JSON.stringify({ text }),
    { status: 200, headers: { ...CORS, "content-type": "application/json" } });
});
