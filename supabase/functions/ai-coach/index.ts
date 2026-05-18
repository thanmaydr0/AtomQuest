import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')!;

interface CoachRequest {
  mode: 'suggest' | 'score' | 'review' | 'analytics' | 'predict_risk' | 'simulate';
  naturalText?: string;
  goal?: {
    title: string;
    description: string;
    thrust_area: string;
    uom_type: string;
    uom_type: string;
    target_value: number | null;
    weightage?: number;
  };
  proposed_goal?: {
    target_value: number | null;
    weightage: number;
  };
  goals?: {
    title: string;
    thrust_area: string;
    uom_type: string;
    weightage: number;
    status: string;
  }[];
  employeeName?: string;
  question?: string;
  checkins?: {
    phase: string;
    actual_achievement: number | null;
    computed_score: number | null;
  }[];
  cycle_phase?: string;
}

interface AnalyticsUserRow {
  user_id: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  manager_id: string | null;
}

interface AnalyticsGoalRow {
  goal_id: string;
  owner_id: string;
  title: string;
  thrust_area: string;
  uom_type: string;
  target_value: number | null;
  weightage: number;
  status: string;
}

interface AnalyticsCheckinRow {
  goal_id: string;
  phase: string;
  actual_achievement: string | number | null;
  computed_score: number | null;
  status: string;
}

interface AnalyticsEscalationRow {
  user_id: string;
  escalated_to: string | null;
  created_at: string;
  escalation_type: string;
  message: string | null;
}

const SYSTEM_PROMPT = `You are AtomAI, an expert OKR and goal-setting coach for the AtomQuest performance management platform.

THRUST AREAS (pick one): Revenue Growth, Cost Optimisation, Customer Experience, People & Culture, Operational Excellence, Innovation
UOM TYPES: min (lower is better), max (higher is better), timeline (complete by date), zero (zero incidents)

Always respond with valid JSON only. No markdown, no explanation outside JSON.`;

const SUGGEST_PROMPT = `The employee described their goal in natural language. Convert it into a structured goal.

Input: "{text}"

Respond with JSON:
{
  "thrust_area": "one of the 6 thrust areas",
  "title": "concise goal title under 80 chars",
  "description": "1-2 sentence SMART description",
  "uom_type": "min|max|timeline|zero",
  "target_value": <number or null>,
  "deadline_date": <"YYYY-MM-DD" or null>,
  "weightage": <suggested 10-40>,
  "reasoning": "1 sentence explaining the mapping"
}`;

const SCORE_PROMPT = `Score this goal on SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound). Each criterion 1-5.

Goal:
- Title: {title}
- Description: {description}
- Thrust Area: {thrust_area}
- UoM: {uom_type}
- Target: {target_value}

Respond with JSON:
{
  "scores": { "specific": <1-5>, "measurable": <1-5>, "achievable": <1-5>, "relevant": <1-5>, "timeBound": <1-5> },
  "overall": <1-5>,
  "tips": ["improvement suggestion 1", "suggestion 2"],
  "improved_title": "a better version of the title if score < 4, else same title"
}`;

const REVIEW_PROMPT = `You are reviewing an employee's complete goal sheet for a manager.

Employee: {employeeName}
Goals:
{goalsJson}

Provide a concise manager review. Respond with JSON:
{
  "summary": "2-3 sentence executive summary",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "thrust_coverage": "comment on thrust area diversity",
  "weightage_balance": "comment on weightage distribution",
  "recommendation": "approve | return_for_rework | needs_discussion",
  "suggested_comment": "a pre-written manager comment for the approval/return action"
}`;

const PREDICT_RISK_PROMPT = `You are AtomAI, assessing the predictive risk of an employee's goal.
Calculate the likelihood of the goal being delayed or requiring escalation based on its parameters and past check-in scores.

Goal details:
- Title: {title}
- Target: {target_value} {uom_type}
- Weightage: {weightage}%

Current Cycle Phase: {cycle_phase}
Past Check-ins:
{checkinsJson}

Respond with JSON:
{
  "riskLevel": "low|medium|high",
  "delayProbability": <number 0-100>,
  "escalationRisk": <number 0-100>,
  "flags": ["specific reason 1", "specific reason 2"],
  "recommendation": "1 sentence recommendation for the manager"
}`;

const SIMULATE_PROMPT = `You are AtomAI, a predictive simulator for goal outcomes.
A manager is proposing a "what-if" change to a goal. 

Original Goal:
- Target: {original_target}
- Weightage: {original_weightage}%

Proposed Goal:
- Target: {proposed_target}
- Weightage: {proposed_weightage}%

Current Phase: {cycle_phase}
Historical context: The employee has {checkinsCount} check-ins so far.

Simulate the outcome if this change is saved. Respond with JSON:
{
  "predicted_score": <number 1.0 to 5.0>,
  "completion_probability": <number 0-100>,
  "escalation_risk": <number 0-100>,
  "insight": "1-2 sentence strategic insight on this specific what-if change"
}`;

const ANALYTICS_SYSTEM = `You are AtomAI Analytics, the data intelligence engine for AtomQuest performance management.
You answer natural language questions about organizational goal data.
You have access to the full dataset for the current review cycle.
Always be specific with numbers. Format responses for quick executive consumption.
Always respond with valid JSON only. No markdown, no explanation outside JSON.`;

const ANALYTICS_PROMPT = `An admin is asking a question about the organization's performance data.

Question: "{question}"

Here is the complete dataset for the current cycle:

Cycle: {cycleName} (Phase: {phase})

Employees ({empCount}):
{employeeSummary}

Goals ({goalCount}):
{goalSummary}

Check-ins ({checkinCount}):
{checkinSummary}

Escalations ({escCount}):
{escalationSummary}

Based on this data, answer the admin's question precisely. Respond with JSON:
{
  "answer": "direct answer to the question in 2-3 sentences",
  "data_points": [{"label": "metric name", "value": "metric value"}],
  "insight": "one additional strategic insight based on the data",
  "confidence": "high | medium | low"
}`;

// V-10 FIX: CORS origin allowlist instead of wildcard
const ALLOWED_ORIGINS = [
  'https://teser.in',
  'http://localhost:5173',
  'http://localhost:5174',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };
}

// V-06 FIX: In-memory rate limiter (20 requests/minute per user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// V-08 FIX: Sanitize user input to prevent prompt injection
function sanitizeForPrompt(input: string, maxLength = 500): string {
  return input
    .replace(/```/g, '')           // Remove code fences
    .replace(/\n{3,}/g, '\n\n')    // Collapse excessive newlines
    .slice(0, maxLength);          // Hard length limit
}

function jsonResponse(body: unknown, origin: string | null, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...getCorsHeaders(origin),
      ...(init.headers ?? {}),
    },
  });
}

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 800): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  try {
    if (!OPENAI_KEY) {
      return jsonResponse({ error: 'AI service unavailable' }, origin, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, origin, { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, origin, { status: 401 });
    }

    // V-06: Rate limit check
    if (!checkRateLimit(user.id)) {
      return jsonResponse({ error: 'Rate limit exceeded. Try again in a minute.' }, origin, { status: 429 });
    }

    const body = (await req.json()) as CoachRequest;
    let result: string;

    switch (body.mode) {
      case 'suggest': {
        if (!body.naturalText) {
          return jsonResponse({ error: 'Missing naturalText' }, origin, { status: 400 });
        }
        // V-08: Sanitize user input before prompt injection
        const prompt = SUGGEST_PROMPT.replace('{text}', sanitizeForPrompt(body.naturalText));
        result = await callOpenAI(SYSTEM_PROMPT, prompt);
        break;
      }
      case 'score': {
        if (!body.goal) {
          return jsonResponse({ error: 'Missing goal' }, origin, { status: 400 });
        }
        const prompt = SCORE_PROMPT
          .replace('{title}', body.goal.title)
          .replace('{description}', body.goal.description)
          .replace('{thrust_area}', body.goal.thrust_area)
          .replace('{uom_type}', body.goal.uom_type)
          .replace('{target_value}', String(body.goal.target_value ?? 'N/A'));
        result = await callOpenAI(SYSTEM_PROMPT, prompt);
        break;
      }
      case 'review': {
        if (!body.goals || !body.employeeName) {
          return jsonResponse({ error: 'Missing goals or employeeName' }, origin, { status: 400 });
        }
        const prompt = REVIEW_PROMPT
          .replace('{employeeName}', body.employeeName)
          .replace('{goalsJson}', JSON.stringify(body.goals, null, 2));
        result = await callOpenAI(SYSTEM_PROMPT, prompt);
        break;
      }
      case 'predict_risk': {
        if (!body.goal || !body.cycle_phase) {
          return jsonResponse({ error: 'Missing goal or cycle_phase for risk prediction' }, origin, { status: 400 });
        }
        
        const checkinsJson = body.checkins && body.checkins.length > 0 
          ? JSON.stringify(body.checkins, null, 2) 
          : "No check-ins yet.";

        const prompt = PREDICT_RISK_PROMPT
          .replace('{title}', body.goal.title)
          .replace('{target_value}', String(body.goal.target_value ?? 'N/A'))
          .replace('{uom_type}', body.goal.uom_type)
          .replace('{weightage}', String((body.goal as any).weightage ?? 0))
          .replace('{cycle_phase}', body.cycle_phase)
          .replace('{checkinsJson}', checkinsJson);
          
        result = await callOpenAI(SYSTEM_PROMPT, prompt);
        break;
      }
      case 'analytics': {
        if (!body.question) {
          return jsonResponse({ error: 'Missing question' }, origin, { status: 400 });
        }

        const adminClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { data: userData } = await adminClient
          .from('users')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userData || userData.role !== 'admin') {
          return jsonResponse({ error: 'Admin access required' }, origin, { status: 403 });
        }

        const { data: cycleData } = await adminClient
          .from('goal_cycles')
          .select('*')
          .eq('status', 'active')
          .limit(1)
          .single();

        if (!cycleData) {
          return jsonResponse({ error: 'No active cycle' }, origin, { status: 404 });
        }

        const [{ data: usersData }, { data: goalsData }, { data: checkinsData }, { data: escData }] = await Promise.all([
          adminClient.from('users').select('user_id, name, email, role, department, manager_id'),
          adminClient.from('goals').select('*').eq('cycle_id', cycleData.cycle_id),
          adminClient.from('check_ins').select('*').eq('cycle_id', cycleData.cycle_id),
          adminClient.from('escalation_logs').select('*').order('created_at', { ascending: false }).limit(100),
        ]);

        const allUsers = (usersData ?? []) as AnalyticsUserRow[];
        const allGoals = (goalsData ?? []) as AnalyticsGoalRow[];
        const allCheckins = (checkinsData ?? []) as AnalyticsCheckinRow[];
        const allEsc = (escData ?? []) as AnalyticsEscalationRow[];
        const userMap = new Map(allUsers.map((u) => [u.user_id, u] as const));

        const employees = allUsers.filter((u) => u.role === 'employee');

        const employeeSummary = employees
          .map((employee) => {
            const managerName = employee.manager_id ? userMap.get(employee.manager_id)?.name ?? 'Unknown' : 'None';
            const employeeGoals = allGoals.filter((goal) => goal.owner_id === employee.user_id);
            const statuses = employeeGoals.map((goal) => goal.status);
            return `${employee.name} (${employee.department ?? 'No department'}) - Manager: ${managerName}, Goals: ${employeeGoals.length}, Statuses: [${statuses.join(',')}]`;
          })
          .join('\n');

        const goalSummary = allGoals
          .map((goal) => {
            const ownerName = userMap.get(goal.owner_id)?.name ?? 'Unknown';
            return `${ownerName}: "${goal.title}" - ${goal.thrust_area}, ${goal.uom_type.toUpperCase()}, target=${goal.target_value ?? 'N/A'}, weight=${goal.weightage}%, status=${goal.status}`;
          })
          .join('\n');

        const checkinSummary = allCheckins
          .map((checkin) => {
            const goal = allGoals.find((entry) => entry.goal_id === checkin.goal_id);
            const ownerName = goal ? userMap.get(goal.owner_id)?.name ?? 'Unknown' : 'Unknown';
            return `${ownerName} - phase=${checkin.phase}, actual=${checkin.actual_achievement ?? 'N/A'}, score=${checkin.computed_score ?? 'N/A'}, status=${checkin.status}`;
          })
          .join('\n');

        const escalationSummary = allEsc
          .map((entry) => {
            const employeeName = userMap.get(entry.user_id)?.name ?? 'Unknown';
            const escalatedToName = entry.escalated_to ? userMap.get(entry.escalated_to)?.name ?? 'Unknown' : 'N/A';
            return `${new Date(entry.created_at).toISOString().slice(0, 10)} - ${employeeName}: ${entry.escalation_type}, to=${escalatedToName}, msg="${entry.message ?? ''}"`;
          })
          .join('\n');

        // V-08: Sanitize user question to prevent prompt injection
        const prompt = ANALYTICS_PROMPT
          .replace('{question}', sanitizeForPrompt(body.question, 1000))
          .replace('{cycleName}', cycleData.cycle_name)
          .replace('{phase}', cycleData.phase)
          .replace('{empCount}', String(employees.length))
          .replace('{employeeSummary}', employeeSummary || 'No employees')
          .replace('{goalCount}', String(allGoals.length))
          .replace('{goalSummary}', goalSummary || 'No goals')
          .replace('{checkinCount}', String(allCheckins.length))
          .replace('{checkinSummary}', checkinSummary || 'No check-ins yet')
          .replace('{escCount}', String(allEsc.length))
          .replace('{escalationSummary}', escalationSummary || 'No escalations');

        result = await callOpenAI(ANALYTICS_SYSTEM, prompt, 1200);
        break;
      }
      case 'simulate': {
        if (!body.goal || !body.proposed_goal || !body.cycle_phase) {
          return jsonResponse({ error: 'Missing goal, proposed_goal, or cycle_phase for simulation' }, origin, { status: 400 });
        }
        
        const checkinsCount = body.checkins ? body.checkins.length : 0;

        const prompt = SIMULATE_PROMPT
          .replace('{original_target}', String(body.goal.target_value ?? 'N/A'))
          .replace('{original_weightage}', String(body.goal.weightage ?? 0))
          .replace('{proposed_target}', String(body.proposed_goal.target_value ?? 'N/A'))
          .replace('{proposed_weightage}', String(body.proposed_goal.weightage))
          .replace('{cycle_phase}', body.cycle_phase)
          .replace('{checkinsCount}', String(checkinsCount));
          
        result = await callOpenAI(SYSTEM_PROMPT, prompt);
        break;
      }
      default:
        return jsonResponse({ error: 'Invalid mode' }, origin, { status: 400 });
    }

    return jsonResponse({ mode: body.mode, result: JSON.parse(result) }, origin);
  } catch (err) {
    // V-11: Don't leak internal error details to the client
    console.error('[ai-coach] Internal error:', err);
    return jsonResponse({ error: 'An internal error occurred' }, origin, { status: 500 });
  }
});
