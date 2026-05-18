import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
type NotificationFact = { label: string; value: string };

function resolveAppLink(appUrl: string, linkPath?: string) {
  if (!linkPath) return appUrl;
  try {
    return new URL(linkPath, appUrl).toString();
  } catch {
    return linkPath;
  }
}

function buildEmailHtml(content: { title: string; message: string; link?: string; facts?: NotificationFact[] }) {
  const facts = content.facts?.length
    ? `<table style="margin:16px 0;border-collapse:collapse;">${content.facts
        .map(
          (fact) => `
            <tr>
              <td style="padding:6px 12px 6px 0;color:#9ca3af;font-weight:600;vertical-align:top;">${fact.label}</td>
              <td style="padding:6px 0;color:#e5e7eb;">${fact.value}</td>
            </tr>`
        )
        .join('')}</table>`
    : '';

  const linkBlock = content.link
    ? `<p style="margin:24px 0 0;"><a href="${content.link}" style="display:inline-block;background:#fdb913;color:#000;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Open in AtomQuest</a></p>`
    : '';

  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#111111;border:1px solid #262626;border-radius:16px;padding:24px;">
        <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#fdb913;">${content.title}</h2>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e5e5e5;">${content.message}</p>
        ${facts}
        ${linkBlock}
      </div>
    </div>
  `;
}

function buildEmailText(content: { title: string; message: string; link?: string; facts?: NotificationFact[] }) {
  const factText = content.facts?.length
    ? `\n${content.facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n')}`
    : '';
  const linkText = content.link ? `\nOpen: ${content.link}` : '';
  return `${content.title}\n\n${content.message}${factText}${linkText}`.trim();
}

function buildTeamsCard(content: { title: string; message: string; link?: string; facts?: NotificationFact[] }) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.5',
          body: [
            { type: 'TextBlock', size: 'Large', weight: 'Bolder', color: 'Accent', text: content.title },
            { type: 'TextBlock', wrap: true, text: content.message, spacing: 'Small' },
            ...(content.facts?.length
              ? [
                  {
                    type: 'FactSet',
                    facts: content.facts.map((fact) => ({ title: fact.label, value: fact.value })),
                  },
                ]
              : []),
          ],
          actions: content.link
            ? [
                {
                  type: 'Action.OpenUrl',
                  title: 'Open in AtomQuest',
                  url: content.link,
                },
              ]
            : [],
        },
      },
    ],
  };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5174';

interface GoalEventPayload {
  event: 'goal_saved' | 'goal_submitted' | 'goal_approved' | 'goal_returned' | 'checkin_reminder';
  goalId?: string;
  ownerId?: string;
  cycleId?: string;
  comment?: string;
  linkPath?: string;
}

interface GoalRow {
  goal_id: string;
  owner_id: string;
  cycle_id: string;
  title: string;
  thrust_area: string;
  status: string;
  weightage: number;
  is_shared: boolean;
}

interface UserRow {
  user_id: string;
  email: string;
  name: string;
  role: string;
  manager_id: string | null;
  telegram_chat_id: string | null;
}

interface CycleRow {
  cycle_id: string;
  cycle_name: string;
  phase: string;
}

function eventMeta(event: GoalEventPayload['event']) {
  switch (event) {
    case 'goal_saved':
      return { label: 'Goal updated', action: 'saved goal changes' };
    case 'goal_submitted':
      return { label: 'Goal sheet submitted', action: 'submitted a goal sheet' };
    case 'goal_approved':
      return { label: 'Goal sheet approved', action: 'approved your goal sheet' };
    case 'goal_returned':
      return { label: 'Goal sheet returned', action: 'returned your goal sheet for rework' };
    case 'checkin_reminder':
      return { label: 'Check-in reminder', action: 'needs a check-in update' };
  }
}

async function sendEmail(recipient: UserRow, subject: string, content: ReturnType<typeof buildEmailText>, html: string) {
  const sendgridKey = Deno.env.get('SENDGRID_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('MAIL_FROM_EMAIL') ?? 'noreply@atomquest.io';
  const fromName = Deno.env.get('MAIL_FROM_NAME') ?? 'AtomQuest';

  if (sendgridKey) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient.email, name: recipient.name }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [
          { type: 'text/plain', value: content },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`SendGrid error ${response.status}`);
    }
    return;
  }

  if (resendKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [recipient.email],
        subject,
        text: content,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend error ${response.status}`);
    }
    return;
  }

  console.log('[notify-goal-event] Email skipped — no email provider configured');
}

async function sendTeams(webhookUrl: string | undefined, content: { title: string; message: string; link?: string; facts?: NotificationFact[] }) {
  if (!webhookUrl) return;
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildTeamsCard(content)),
  });
  if (!response.ok) {
    throw new Error(`Teams webhook error ${response.status}`);
  }
}

async function sendTelegram(chatId: string | null | undefined, content: { title: string; message: string; link?: string }) {
  if (!chatId) return;
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return;

  const text = `*${content.title}*\n\n${content.message}\n\n${content.link ? `[Open in AtomQuest](${content.link})` : ''}`;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  if (!response.ok) {
    console.error('Telegram API error:', await response.text());
  }
}

Deno.serve(async (req: Request) => {
  try {
    const payload = (await req.json()) as GoalEventPayload;
    if (!payload?.event) {
      return new Response(JSON.stringify({ error: 'Missing event' }), { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const webhookUrl = Deno.env.get('TEAMS_WEBHOOK_URL') ?? undefined;

    const { data: goalData } = payload.goalId
      ? await supabase.from('goals').select('goal_id, owner_id, cycle_id, title, thrust_area, status, weightage, is_shared').eq('goal_id', payload.goalId).maybeSingle()
      : { data: null };
    const goal = goalData as GoalRow | null;

    const ownerId = payload.ownerId ?? goal?.owner_id;
    if (!ownerId) {
      return new Response(JSON.stringify({ error: 'Missing ownerId' }), { status: 400 });
    }

    const { data: ownerData } = await supabase.from('users').select('user_id, email, name, role, manager_id, telegram_chat_id').eq('user_id', ownerId).maybeSingle();
    const owner = ownerData as UserRow | null;
    if (!owner) {
      return new Response(JSON.stringify({ error: 'Owner not found' }), { status: 404 });
    }

    const { data: managerData } = owner.manager_id
      ? await supabase.from('users').select('user_id, email, name, role, manager_id, telegram_chat_id').eq('user_id', owner.manager_id).maybeSingle()
      : { data: null };
    const manager = managerData as UserRow | null;

    const { data: cycleData } = payload.cycleId
      ? await supabase.from('goal_cycles').select('cycle_id, cycle_name, phase').eq('cycle_id', payload.cycleId).maybeSingle()
      : { data: null };
    const cycle = cycleData as CycleRow | null;

    const meta = eventMeta(payload.event);
    const deepLinkPath = payload.linkPath
      ?? (payload.event === 'goal_submitted' || payload.event === 'goal_saved'
        ? `/manager/approvals?employeeId=${encodeURIComponent(owner.user_id)}${goal ? `&goalId=${encodeURIComponent(goal.goal_id)}` : ''}`
        : payload.event === 'goal_approved' || payload.event === 'goal_returned'
          ? `/dashboard?goalId=${encodeURIComponent(goal?.goal_id ?? payload.goalId ?? '')}`
          : `/checkins${goal ? `?goalId=${encodeURIComponent(goal.goal_id)}` : ''}`);

    const link = resolveAppLink(appUrl, deepLinkPath);
    const goalFacts: NotificationFact[] = [];
    if (cycle?.cycle_name) goalFacts.push({ label: 'Cycle', value: cycle.cycle_name });
    if (goal?.thrust_area) goalFacts.push({ label: 'Thrust Area', value: goal.thrust_area });
    if (goal?.title) goalFacts.push({ label: 'Goal', value: goal.title });
    if (payload.comment) goalFacts.push({ label: 'Comment', value: payload.comment });

    const shouldNotifyManager = ['goal_saved', 'goal_submitted'].includes(payload.event) && !!manager?.email;
    const shouldNotifyEmployee = ['goal_approved', 'goal_returned', 'checkin_reminder'].includes(payload.event) && !!owner.email;

    const recipients: Array<{ recipient: UserRow; subject: string; message: string; facts: NotificationFact[]; link: string }> = [];

    if (shouldNotifyManager && manager) {
      recipients.push({
        recipient: manager,
        subject: `[AtomQuest] ${meta.label} — ${owner.name}`,
        message: `${owner.name} ${meta.action}.`,
        facts: [
          { label: 'Employee', value: `${owner.name} (${owner.email})` },
          ...goalFacts,
        ],
        link,
      });
    }

    if (shouldNotifyEmployee) {
      recipients.push({
        recipient: owner,
        subject: `[AtomQuest] ${meta.label} — ${goal?.title ?? cycle?.cycle_name ?? owner.name}`,
        message:
          payload.event === 'goal_returned'
            ? `${manager?.name ?? 'Your manager'} returned your goal sheet for rework.`
            : payload.event === 'checkin_reminder'
              ? `Please submit your check-in update for ${cycle?.cycle_name ?? 'the current cycle'}.`
              : `Your goal sheet was approved and locked.`,
        facts: goalFacts,
        link,
      });
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'Nothing to notify', sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    let sent = 0;
    for (const item of recipients) {
      const emailText = buildEmailText({ title: item.subject, message: item.message, link: item.link, facts: item.facts });
      const emailHtml = buildEmailHtml({ title: item.subject, message: item.message, link: item.link, facts: item.facts });

      await Promise.all([
        sendEmail(item.recipient, item.subject, emailText, emailHtml),
        sendTeams(webhookUrl, { title: item.subject, message: item.message, link: item.link, facts: item.facts }),
        sendTelegram(item.recipient.telegram_chat_id, { title: item.subject, message: item.message, link: item.link }),
      ]);
      sent++;
    }

    return new Response(JSON.stringify({ message: 'Goal notifications processed', sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
