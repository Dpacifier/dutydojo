import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY       = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing auth' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

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

    const system = `You are Dojo Coach, a warm and encouraging personal coach for children using the DutyDojo family reward app.
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
    const userPrompt = parts.join('\n');

    // ── Call Claude ───────────────────────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          ANTHROPIC_API_KEY,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 220,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('Claude API error:', errText);
      return json({ error: 'AI unavailable' }, 502);
    }

    const claudeJson = await claudeRes.json() as {
      content?: Array<{ type: string; text: string }>;
    };
    const message = claudeJson.content?.find((b) => b.type === 'text')?.text
      ?? "You're doing amazing today — keep it up! 🌟";

    return json({ message });
  } catch (err) {
    console.error('dojo-coach error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
