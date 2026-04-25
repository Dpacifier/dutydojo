import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY        = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Allowed origins — extend this list if you add new domains
const ALLOWED_ORIGINS = new Set([
  'https://www.dutydojo.com',
  'https://dutydojo.com',
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  // Accept any dutydojo.vercel.app preview URL, or explicit allowed origins
  const allowed =
    ALLOWED_ORIGINS.has(origin) || /^https:\/\/dutydojo[^.]*\.vercel\.app$/.test(origin)
      ? origin
      : 'https://www.dutydojo.com';
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
  };
}

function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? corsHeaders(req) : { 'Access-Control-Allow-Origin': 'https://www.dutydojo.com', 'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type' }), 'Content-Type': 'application/json' },
  });
}

/** Strip control chars and injection-friendly characters, trim, cap length */
function sanitise(input: string, maxLen: number): string {
  return input.replace(/[\x00-\x1F\x7F<>{}]/g, '').trim().slice(0, maxLen);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  try {
    // ── Auth: require a valid user JWT ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401, req);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (!user) return json({ error: 'Unauthorized' }, 401, req);

    // ── Parse + sanitise body ─────────────────────────────────────────────────
    const raw = (await req.json()) as {
      childName?: unknown;
      points?: unknown;
      goal?: unknown;
      streak?: unknown;
      behaviourSummary?: unknown;
    };

    const childName        = sanitise(String(raw.childName        ?? ''), 50);
    const behaviourSummary = sanitise(String(raw.behaviourSummary ?? ''), 200);
    const points           = Math.max(0, Math.min(Number(raw.points ?? 0),  99999));
    const goal             = Math.max(1, Math.min(Number(raw.goal   ?? 100), 99999));
    const streak           = Math.max(0, Math.min(Number(raw.streak ?? 0),  9999));

    if (!childName) return json({ error: 'childName is required' }, 400, req);

    // ── Build prompt ──────────────────────────────────────────────────────────
    const pct = Math.round((points / goal) * 100);

    const systemPrompt = `You are Dojo Coach, a warm and encouraging personal coach for children using the DutyDojo family reward app.
Write a short daily message (2–3 sentences max) for a child. Rules:
- Use simple, upbeat language a child aged 6–14 can understand.
- Focus on effort, character, and growth — not just points or prizes.
- Give one specific, actionable tip or encouragement.
- End with a single fun emoji.
- Never mention money, screen time, or specific real-world rewards.`;

    const parts = [
      `Child: ${childName}`,
      `Points today: ${points} out of ${goal} goal (${pct}% to next trophy)`,
    ];
    if (streak > 0) parts.push(`Earning streak: ${streak} day${streak === 1 ? '' : 's'} in a row!`);
    if (behaviourSummary) parts.push(`Recent activity: ${behaviourSummary}`);
    parts.push('Write a personalised daily coach message for this child.');

    // ── Call OpenAI ───────────────────────────────────────────────────────────
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        max_tokens:  220,
        temperature: 0.85,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: parts.join('\n') },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI API error:', errText);
      return json({ error: 'AI unavailable' }, 502, req);
    }

    const openaiJson = await openaiRes.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const message = openaiJson.choices?.[0]?.message?.content?.trim()
      ?? "You're doing amazing today — keep it up! 🌟";

    return json({ message }, 200, req);
  } catch (err) {
    console.error('dojo-coach error:', err);
    return json({ error: 'Internal error' }, 500, req);
  }
});
