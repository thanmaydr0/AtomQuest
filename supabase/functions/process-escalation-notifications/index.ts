// supabase/functions/process-escalation-notifications/index.ts
// ============================================================================
// Supabase Edge Function: Process pending escalation notifications
//
// Deploy with:
//   supabase functions deploy process-escalation-notifications
//
// Trigger via:
//   - A Supabase cron webhook calling this function daily
//   - Or manually: curl -X POST https://<project>.supabase.co/functions/v1/process-escalation-notifications
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface EscalationLog {
  id: string;
  cycle_id: string;
  user_id: string;
  escalation_type: string;
  escalated_to: string | null;
  reason: string;
  created_at: string;
  notified_at: string | null;
}

interface UserInfo {
  user_id: string;
  email: string;
  name: string;
}

Deno.serve(async (_req: Request) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all un-notified escalations
    const { data: pending, error } = await supabase
      .from('escalation_logs')
      .select('*')
      .is('notified_at', null)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending notifications', processed: 0 }));
    }

    const escalations = pending as EscalationLog[];

    // 2. Gather unique user IDs for email resolution
    const userIds = [
      ...new Set([
        ...escalations.map((e) => e.user_id),
        ...escalations.filter((e) => e.escalated_to).map((e) => e.escalated_to!),
      ]),
    ];

    const { data: users } = await supabase
      .from('users')
      .select('user_id, email, name')
      .in('user_id', userIds);

    const userMap = new Map((users ?? []).map((u: UserInfo) => [u.user_id, u]));

    // 3. Process each escalation
    let processed = 0;
    for (const esc of escalations) {
      const employee = userMap.get(esc.user_id);
      const recipient = esc.escalated_to ? userMap.get(esc.escalated_to) : employee;

      if (!recipient) continue;

      // ─────────────────────────────────────────────────
      // TODO: Send email notification via SendGrid / Resend / etc.
      //
      // Example SendGrid API shape:
      // await fetch('https://api.sendgrid.com/v3/mail/send', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     personalizations: [{
      //       to: [{ email: recipient.email, name: recipient.name }],
      //     }],
      //     from: { email: 'noreply@atomquest.io', name: 'AtomQuest' },
      //     subject: `[AtomQuest] ${esc.escalation_type.replace(/_/g, ' ')} — ${employee?.name}`,
      //     content: [{
      //       type: 'text/html',
      //       value: `
      //         <h2>Goal Escalation Alert</h2>
      //         <p><strong>Employee:</strong> ${employee?.name} (${employee?.email})</p>
      //         <p><strong>Type:</strong> ${esc.escalation_type}</p>
      //         <p><strong>Reason:</strong> ${esc.reason}</p>
      //         <p><strong>Date:</strong> ${esc.created_at}</p>
      //         <p>Please take action in <a href="https://your-app-url.com/admin/escalations">AtomQuest</a>.</p>
      //       `,
      //     }],
      //   }),
      // });
      // ─────────────────────────────────────────────────

      console.log(
        `[Escalation] type=${esc.escalation_type} employee=${employee?.name} → ${recipient.name} (${recipient.email})`
      );

      // 4. Mark as notified
      await supabase
        .from('escalation_logs')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', esc.id);

      processed++;
    }

    return new Response(
      JSON.stringify({ message: 'Notifications processed', processed }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
