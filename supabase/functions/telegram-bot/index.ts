import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendMessage(chatId: number | string, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
  if (!response.ok) {
    console.error('Failed to send Telegram message:', await response.text());
  }
}

async function handleCommand(chatId: string, text: string) {
  const parts = text.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // 1. Check if user is linked
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .single();

  if (cmd === '/start') {
    if (args.length === 0) {
      await sendMessage(chatId, `Welcome to *AtomBot*! 🤖\n\nTo link your AtomQuest account, please reply with:\n\`/start <your-email>\`\n\nExample:\n\`/start john@atomquest.local\``);
      return;
    }
    const email = args[0];
    const { data: targetUser } = await supabase.from('users').select('*').eq('email', email).single();
    
    if (!targetUser) {
      await sendMessage(chatId, `❌ Could not find an account with email \`${email}\`.`);
      return;
    }
    
    await supabase.from('users').update({ telegram_chat_id: chatId }).eq('user_id', targetUser.user_id);
    await sendMessage(chatId, `✅ Successfully linked to *${targetUser.name}* (${targetUser.role})!\n\nTry sending \`/goals\` or \`/help\`.`);
    return;
  }

  if (!user) {
    await sendMessage(chatId, `⚠️ Your account is not linked. Send \`/start <your-email>\` to link it.`);
    return;
  }

  if (cmd === '/help') {
    let helpMsg = `*AtomBot Commands*\n\n`;
    helpMsg += `🔹 */goals* - View your active goals\n`;
    helpMsg += `🔹 */status* - View your goal sheet status and weightage\n`;
    helpMsg += `🔹 */checkin <number> <value>* - Update a goal (e.g. \`/checkin 1 85\`)\n`;
    helpMsg += `🔹 */logout* - Unlink your AtomQuest account\n`;
    
    if (user.role === 'manager' || user.role === 'admin') {
      helpMsg += `\n*Manager Commands*\n`;
      helpMsg += `🔸 */team* - View team goal submission status\n`;
      helpMsg += `🔸 */approve <email>* - Approve a team member's goals\n`;
      helpMsg += `🔸 */return <email> <reason>* - Return goals for rework\n`;
    }
    await sendMessage(chatId, helpMsg);
    return;
  }

  if (cmd === '/logout') {
    const { error } = await supabase.from('users').update({ telegram_chat_id: null }).eq('telegram_chat_id', chatId);
    if (error) {
      await sendMessage(chatId, `❌ Failed to logout: ${error.message}`);
    } else {
      await sendMessage(chatId, `👋 Successfully logged out and unlinked your AtomQuest account.\n\nYou can always send \`/start <email>\` to link again.`);
    }
    return;
  }

  if (cmd === '/goals') {
    // Find active cycle
    const { data: cycle } = await supabase.from('goal_cycles').select('*').eq('status', 'active').single();
    if (!cycle) {
      await sendMessage(chatId, `No active review cycle found.`);
      return;
    }

    const { data: goals } = await supabase.from('goals').select('*').eq('owner_id', user.user_id).eq('cycle_id', cycle.cycle_id);
    if (!goals || goals.length === 0) {
      await sendMessage(chatId, `You have no goals set for ${cycle.cycle_name}.`);
      return;
    }

    const statusMap = { draft: '📝 Draft', submitted: '⏳ Submitted', approved: '✅ Approved', locked: '🔒 Locked', returned: '⚠️ Returned' };
    const sheetStatus = goals[0].status; // Assume all goals have same status for simplicity

    let msg = `*Your Goals for ${cycle.cycle_name}*\nStatus: ${statusMap[sheetStatus as keyof typeof statusMap] || sheetStatus}\n\n`;
    
    goals.forEach((g: any, i: number) => {
      const target = g.target_value ? ` Target: ${g.target_value}` : '';
      msg += `*${i + 1}.* ${g.title}\n`;
      msg += `   └ ${g.thrust_area} | ${g.weightage}% | ${g.uom_type.toUpperCase()}${target}\n`;
    });

    await sendMessage(chatId, msg);
    return;
  }

  if (cmd === '/status') {
    const { data: cycle } = await supabase.from('goal_cycles').select('*').eq('status', 'active').single();
    if (!cycle) {
      await sendMessage(chatId, `No active review cycle found.`);
      return;
    }

    const { data: goals } = await supabase.from('goals').select('status, weightage').eq('owner_id', user.user_id).eq('cycle_id', cycle.cycle_id);
    if (!goals || goals.length === 0) {
      await sendMessage(chatId, `You have no goals set for ${cycle.cycle_name}.`);
      return;
    }

    const sheetStatus = goals[0].status;
    const statusMap = { draft: '📝 Draft', submitted: '⏳ Submitted', approved: '✅ Approved', locked: '🔒 Locked', returned: '⚠️ Returned' };
    const totalWeightage = goals.reduce((sum: number, g: any) => sum + g.weightage, 0);

    let msg = `*Goal Sheet Status (${cycle.cycle_name})*\n\n`;
    msg += `*Status:* ${statusMap[sheetStatus as keyof typeof statusMap] || sheetStatus}\n`;
    msg += `*Total Goals:* ${goals.length}\n`;
    msg += `*Total Weightage:* ${totalWeightage}%\n\n`;

    if (totalWeightage !== 100) {
      msg += `⚠️ _Your total weightage must be 100% before submission._`;
    } else if (sheetStatus === 'draft' || sheetStatus === 'returned') {
      msg += `💡 _You can submit your goals for approval in the AtomQuest portal._`;
    }

    await sendMessage(chatId, msg);
    return;
  }

  if (cmd === '/checkin') {
    const goalNum = parseInt(args[0]);
    const value = parseFloat(args[1]);

    if (isNaN(goalNum) || isNaN(value)) {
      await sendMessage(chatId, `Invalid format. Use: \`/checkin <goal_number> <actual_value>\`\nExample: \`/checkin 1 85\``);
      return;
    }

    const { data: cycle } = await supabase.from('goal_cycles').select('*').eq('status', 'active').single();
    if (!cycle) {
      await sendMessage(chatId, `No active review cycle found.`);
      return;
    }

    // We only allow checkins for locked/approved goals during active phase
    const { data: goals } = await supabase.from('goals')
      .select('*')
      .eq('owner_id', user.user_id)
      .eq('cycle_id', cycle.cycle_id)
      .order('created_at', { ascending: true }); // Make sure order is consistent with /goals

    if (!goals || goals.length === 0) {
      await sendMessage(chatId, `You have no goals set for ${cycle.cycle_name}.`);
      return;
    }

    const goal = goals[goalNum - 1];
    if (!goal) {
      await sendMessage(chatId, `❌ Goal #${goalNum} not found. Send \`/goals\` to see your list.`);
      return;
    }

    if (goal.status !== 'locked' && goal.status !== 'approved') {
      await sendMessage(chatId, `⚠️ Your goals must be approved/locked before you can submit check-ins.`);
      return;
    }

    // Insert or update check-in for the current phase
    const phase = cycle.phase || 'q1';
    
    // Check if checkin already exists
    const { data: existingCheckin } = await supabase.from('check_ins')
      .select('check_in_id')
      .eq('goal_id', goal.goal_id)
      .eq('phase', phase)
      .maybeSingle();

    const checkinData = {
      goal_id: goal.goal_id,
      cycle_id: cycle.cycle_id,
      phase,
      actual_achievement: value,
      status: 'on_track', // Simplified
      submitted_at: new Date().toISOString()
    };

    let error;
    if (existingCheckin) {
      const res = await supabase.from('check_ins').update(checkinData).eq('check_in_id', existingCheckin.check_in_id);
      error = res.error;
    } else {
      const res = await supabase.from('check_ins').insert(checkinData);
      error = res.error;
    }

    if (error) {
      await sendMessage(chatId, `❌ Failed to submit check-in: ${error.message}`);
    } else {
      await sendMessage(chatId, `✅ Check-in recorded for Goal #${goalNum}!\n\n*${goal.title}*\nActual Value: ${value} ${goal.uom_type.toUpperCase()}`);
    }
    return;
  }

  if (cmd === '/team' && (user.role === 'manager' || user.role === 'admin')) {
    const { data: cycle } = await supabase.from('goal_cycles').select('*').eq('status', 'active').single();
    if (!cycle) {
      await sendMessage(chatId, `No active review cycle found.`);
      return;
    }

    const { data: team } = await supabase.from('users').select('user_id, name, email').eq('manager_id', user.user_id);
    if (!team || team.length === 0) {
      await sendMessage(chatId, `You don't have any direct reports.`);
      return;
    }

    const teamIds = team.map((t: any) => t.user_id);
    const { data: goals } = await supabase.from('goals').select('owner_id, status').in('owner_id', teamIds).eq('cycle_id', cycle.cycle_id);
    
    let msg = `*Your Team (${team.length} members)*\n\n`;
    
    team.forEach((t: any) => {
      const empGoals = (goals || []).filter((g: any) => g.owner_id === t.user_id);
      const status = empGoals.length > 0 ? empGoals[0].status : 'empty';
      const statusIcon = { empty: '⚪', draft: '📝', submitted: '⏳', approved: '✅', locked: '🔒', returned: '⚠️' }[status] || '❓';
      
      msg += `${statusIcon} *${t.name}* (\`${t.email}\`)\n`;
    });

    msg += `\n_Reply with_ \`/approve <email>\` _to approve a submitted sheet._`;
    await sendMessage(chatId, msg);
    return;
  }

  if (cmd === '/approve' && (user.role === 'manager' || user.role === 'admin')) {
    const targetEmail = args[0];
    if (!targetEmail) {
      await sendMessage(chatId, `Please provide the employee's email: \`/approve employee@example.com\``);
      return;
    }

    const { data: targetUser } = await supabase.from('users').select('*').eq('email', targetEmail).single();
    if (!targetUser || targetUser.manager_id !== user.user_id) {
      await sendMessage(chatId, `❌ Could not find employee \`${targetEmail}\` in your team.`);
      return;
    }

    const { data: cycle } = await supabase.from('goal_cycles').select('*').eq('status', 'active').single();
    
    const { error } = await supabase
      .from('goals')
      .update({ status: 'locked', updated_at: new Date().toISOString() })
      .eq('owner_id', targetUser.user_id)
      .eq('cycle_id', cycle.cycle_id)
      .eq('status', 'submitted');

    if (error) {
      await sendMessage(chatId, `❌ Failed to approve: ${error.message}`);
    } else {
      await sendMessage(chatId, `✅ Successfully approved and locked goals for *${targetUser.name}*.`);
      
      // Notify employee if they have telegram
      if (targetUser.telegram_chat_id) {
        await sendMessage(targetUser.telegram_chat_id, `🎉 *Good news!* Your goal sheet was approved by ${user.name}.`);
      }
    }
    return;
  }

  if (cmd === '/return' && (user.role === 'manager' || user.role === 'admin')) {
    const targetEmail = args[0];
    const reason = args.slice(1).join(' ');
    
    if (!targetEmail || !reason) {
      await sendMessage(chatId, `Please provide email and reason: \`/return employee@example.com Needs more aggressive targets\``);
      return;
    }

    const { data: targetUser } = await supabase.from('users').select('*').eq('email', targetEmail).single();
    if (!targetUser || targetUser.manager_id !== user.user_id) {
      await sendMessage(chatId, `❌ Could not find employee \`${targetEmail}\` in your team.`);
      return;
    }

    const { data: cycle } = await supabase.from('goal_cycles').select('*').eq('status', 'active').single();
    
    const { error } = await supabase
      .from('goals')
      .update({ status: 'returned', updated_at: new Date().toISOString() })
      .eq('owner_id', targetUser.user_id)
      .eq('cycle_id', cycle.cycle_id)
      .eq('status', 'submitted');

    if (error) {
      await sendMessage(chatId, `❌ Failed to return: ${error.message}`);
    } else {
      await sendMessage(chatId, `✅ Returned goals for *${targetUser.name}*.`);
      
      // Notify employee
      if (targetUser.telegram_chat_id) {
        await sendMessage(targetUser.telegram_chat_id, `⚠️ *Action Required:* Your goal sheet was returned by ${user.name}.\n\n*Reason:* ${reason}`);
      }
    }
    return;
  }

  await sendMessage(chatId, `I didn't understand that command. Send \`/help\` to see what I can do.`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const update = await req.json();
    
    // Telegram webhook payload has `message` object
    if (update.message && update.message.text) {
      const chatId = String(update.message.chat.id);
      const text = update.message.text.trim();
      
      // We process asynchronously and respond to Telegram immediately with 200 OK 
      // so it doesn't retry the webhook if our processing takes long.
      // Note: Edge functions execute as long as the promise is awaited.
      await handleCommand(chatId, text);
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal error', { status: 500 });
  }
});
