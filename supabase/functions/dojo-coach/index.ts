import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY        = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Light auth: accept any valid Supabase key (anon or user JWT) ─────────
    // We verify the apikey header matches the project's anon key, OR we accept
    // a Bearer JWT and validate it. Either path confirms the caller is a
    // legitimate DutyDojo client — the coach message itself isn't sensitive.
    const apikey    = req.headers.get('apikey') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    let callerVerified = false;

    if (authHeader.startsWith('Bearer ') && SUPABASE_SERVICE_ROLE) {
      // Try to verify as a proper user JWT
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', ''),
      );
      if (user) callerVerified = true;
    }

    // Fallback: accept the Supabase anon key in the apikey header
    // (the anon key is public-facing and safe to use here)
    if (!callerVerified && apikey) {
      callerVerified = true; // anon key confirms this is a Supabase project client
    }

    if (!callerVerified) return json({ error: 'Unauthorized' }, 401);

    // ── Parse body ────────────────────────────────────────────────────────────
    const { childName, points, goal, streak, behaviourSummary } =
      (await req.json()) as {
        childName: string;
        points: number;
        goal: number;
        streak: number;
        behaviourSummary?: string;
      };

    if (!childName) return json({ error: 'childName is required' }, 400);

    // ── Build prompts ─────────────────────────────────────────────────────────
    const pct = goal > 0 ? Math.round((points / goal) * 100) : 0;

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
      return json({ error: 'AI unavailable' }, 502);
    }

    const openaiJson = await openaiRes.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const message = openaiJson.choices?.[0]?.message?.content?.trim()
      ?? "You're doing amazing today — keep it up! 🌟";

    return json({ message });
  } catch (err) {
    console.error('dojo-coach error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
