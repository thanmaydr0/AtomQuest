import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Google Auth via Service Account JWT ────────────────────────
// We sign a JWT with RS256 and exchange it for an access token.
// The service account JSON is stored as a Supabase secret.

function base64url(data: Uint8Array): string {
  let b = '';
  for (const byte of data) b += String.fromCharCode(byte);
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createSignedJwt(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import PEM private key – strip PEM headers, real newlines, literal \n, and whitespace
  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(unsignedToken));
  const sigB64 = base64url(new Uint8Array(signature));
  return `${unsignedToken}.${sigB64}`;
}

async function getAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const jwt = await createSignedJwt(serviceAccount);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google token error: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ─── Google Sheets API Helpers ──────────────────────────────────

async function sheetsApi(token: string, url: string, method = 'GET', body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets API ${method} error ${res.status}: ${errText}`);
  }
  return res.json();
}

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function createSpreadsheet(token: string, title: string, sheetNames: string[]) {
  const body = {
    properties: { title },
    sheets: sheetNames.map((name, i) => ({
      properties: { sheetId: i, title: name, gridProperties: { frozenRowCount: 1 } },
    })),
  };
  return sheetsApi(token, SHEETS_BASE, 'POST', body);
}

async function shareWithAnyone(token: string, fileId: string) {
  const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
  const res = await fetch(driveUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  if (!res.ok) console.error('Share error:', await res.text());
}

async function writeSheetData(token: string, spreadsheetId: string, sheetName: string, rows: unknown[][]) {
  const range = `'${sheetName}'!A1`;
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  return sheetsApi(token, url, 'PUT', { range, majorDimension: 'ROWS', values: rows });
}

async function clearSheet(token: string, spreadsheetId: string, sheetName: string) {
  const range = `'${sheetName}'!A1:ZZ10000`;
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
  return sheetsApi(token, url, 'POST', {});
}

// ─── Conditional Formatting ─────────────────────────────────────

function statusConditionalFormatting(sheetId: number, colIndex: number, rowCount: number) {
  const rules = [
    { status: 'locked', bg: { red: 0.06, green: 0.65, blue: 0.43 } },     // green
    { status: 'approved', bg: { red: 0.26, green: 0.63, blue: 0.28 } },   // green-ish
    { status: 'submitted', bg: { red: 0.23, green: 0.51, blue: 0.96 } },  // blue
    { status: 'draft', bg: { red: 0.42, green: 0.42, blue: 0.42 } },      // grey
    { status: 'returned', bg: { red: 0.96, green: 0.41, blue: 0.09 } },   // orange
  ];

  return rules.map((r) => ({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 }],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: r.status }] },
          format: {
            backgroundColor: r.bg,
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
          },
        },
      },
      index: 0,
    },
  }));
}

function heatmapConditionalFormatting(sheetId: number, startCol: number, endCol: number, rowCount: number) {
  const formatRules = [
    { value: 'done', bg: { red: 0.06, green: 0.65, blue: 0.43 } },
    { value: 'partial', bg: { red: 0.98, green: 0.73, blue: 0.02 } },
    { value: 'none', bg: { red: 0.9, green: 0.22, blue: 0.21 } },
  ];
  return formatRules.map((r) => ({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: startCol, endColumnIndex: endCol }],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: r.value }] },
          format: {
            backgroundColor: r.bg,
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
          },
        },
      },
      index: 0,
    },
  }));
}

function headerFormatting(sheetId: number, colCount: number) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.12, green: 0.12, blue: 0.12 },
          textFormat: { foregroundColor: { red: 0.99, green: 0.73, blue: 0.07 }, bold: true, fontSize: 11 },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
    },
  };
}

// ─── Main Handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    // ── Auth ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Check admin role
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData } = await adminClient.from('users').select('role').eq('user_id', user.id).single();
    if (!userData || userData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders });
    }

    // ── Parse body ──
    const body = await req.json().catch(() => ({}));
    const existingSheetId = body.spreadsheetId || null;

    // ── Google Auth ──
    const saKeyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!saKeyJson) {
      return new Response(JSON.stringify({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY not configured' }), { status: 500, headers: corsHeaders });
    }
    const serviceAccount = JSON.parse(saKeyJson);
    console.log('[sheets-sync] Service account email:', serviceAccount.client_email);
    console.log('[sheets-sync] Project ID:', serviceAccount.project_id);
    console.log('[sheets-sync] Private key starts with:', serviceAccount.private_key?.substring(0, 30));
    
    let token: string;
    try {
      token = await getAccessToken(serviceAccount);
      console.log('[sheets-sync] ✅ Got access token, length:', token?.length, 'prefix:', token?.substring(0, 20));
      
      // Test token with a simple API call
      const testRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token);
      const testData = await testRes.json();
      console.log('[sheets-sync] Token info:', JSON.stringify(testData));
    } catch (tokenErr) {
      console.error('[sheets-sync] ❌ Token exchange failed:', tokenErr);
      return new Response(JSON.stringify({ error: `Token exchange failed: ${tokenErr}` }), { status: 500, headers: corsHeaders });
    }

    // ── Fetch all data ──
    const { data: cycleData } = await adminClient.from('goal_cycles').select('*').eq('status', 'active').limit(1).single();
    if (!cycleData) {
      return new Response(JSON.stringify({ error: 'No active cycle found' }), { status: 404, headers: corsHeaders });
    }
    const cycle = cycleData;

    const [{ data: usersData }, { data: goalsData }, { data: checkinsData }, { data: escalationsData }] = await Promise.all([
      adminClient.from('users').select('*'),
      adminClient.from('goals').select('*').eq('cycle_id', cycle.cycle_id),
      adminClient.from('check_ins').select('*').eq('cycle_id', cycle.cycle_id),
      adminClient.from('escalation_logs').select('*').order('created_at', { ascending: false }),
    ]);

    const users = usersData ?? [];
    const goals = goalsData ?? [];
    const checkins = checkinsData ?? [];
    const escalations = escalationsData ?? [];

    const userMap = new Map(users.map((u: any) => [u.user_id, u]));
    const ciMap = new Map(checkins.map((c: any) => [`${c.goal_id}_${c.phase}`, c]));

    // ── Sheet names ──
    const sheetNames = ['Goal Tracker', 'Completion Heatmap', 'Manager Leaderboard', 'Escalation Log'];

    // ── Create or reuse spreadsheet ──
    let spreadsheetId: string;
    let spreadsheetUrl: string;

    if (existingSheetId) {
      spreadsheetId = existingSheetId;
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    } else {
      // Find an existing spreadsheet to reuse to avoid quota issues
      console.log('[sheets-sync] Searching for existing spreadsheets to reuse...');
      let existingFiles: any[] = [];
      try {
        const listRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet'")}&fields=files(id,name)&pageSize=10`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          existingFiles = listData.files ?? [];
        }
      } catch (err) {
        console.warn('[sheets-sync] List failed (non-fatal):', err);
      }

      if (existingFiles.length > 0) {
        spreadsheetId = existingFiles[0].id;
        spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        console.log('[sheets-sync] ♻️ Reusing existing spreadsheet:', spreadsheetId);
      } else {
        // Create spreadsheet via Drive API
        console.log('[sheets-sync] Creating spreadsheet via Drive API...');
        const dateStr = new Date().toISOString().slice(0, 10);
        const driveTitle = `AtomQuest — ${cycle.cycle_name} (${dateStr})`;
        
        const driveRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: driveTitle, mimeType: 'application/vnd.google-apps.spreadsheet' }),
        });
        
        if (!driveRes.ok) {
          const driveErr = await driveRes.text();
          console.error('[sheets-sync] Drive API also failed:', driveRes.status, driveErr);
          return new Response(JSON.stringify({ error: `Failed to create spreadsheet: ${driveErr}` }), { status: 500, headers: corsHeaders });
        }
        
        const driveFile = await driveRes.json();
        spreadsheetId = driveFile.id;
        spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        console.log('[sheets-sync] ✅ Created spreadsheet via Drive:', spreadsheetId);
        
        // Make it viewable by anyone with the link
        await shareWithAnyone(token, spreadsheetId);
      }
    }

    // ── Ensure tabs exist ──
    const sheetMetaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!sheetMetaRes.ok) {
      const metaErr = await sheetMetaRes.text();
      return new Response(JSON.stringify({ error: `Could not access spreadsheet. Ensure the service account was granted Editor access: ${metaErr}` }), { status: 500, headers: corsHeaders });
    }
    
    const sheetMeta = await sheetMetaRes.json();
    const existingTitles = sheetMeta.sheets?.map((s: any) => s.properties.title) || [];
    
    const addSheetRequests = [];
    for (const name of sheetNames) {
      if (!existingTitles.includes(name)) {
        addSheetRequests.push({ addSheet: { properties: { title: name } } });
      }
    }
    if (addSheetRequests.length > 0) {
      await sheetsApi(token, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, 'POST', {
        requests: addSheetRequests,
      });
    }
    
    // Clear all sheets before writing
    for (const name of sheetNames) {
      try { await clearSheet(token, spreadsheetId, name); } catch { /* ignore */ }
    }

    // ─── Tab 1: Goal Tracker ─────────────────────────────────────
    const goalHeaders = ['Employee', 'Department', 'Manager', 'Goal Title', 'Thrust Area', 'UoM', 'Weightage', 'Target', 'Actual (Q1)', 'Actual (Q2)', 'Actual (Q3)', 'Actual (Q4)', 'Score', 'Status'];
    const goalRows = goals.map((g: any) => {
      const owner = userMap.get(g.owner_id) as any;
      const mgr = owner?.manager_id ? userMap.get(owner.manager_id) as any : null;
      const q1Ci = ciMap.get(`${g.goal_id}_q1`);
      const q2Ci = ciMap.get(`${g.goal_id}_q2`);
      const q3Ci = ciMap.get(`${g.goal_id}_q3`);
      const q4Ci = ciMap.get(`${g.goal_id}_q4`);
      const latestCi = ciMap.get(`${g.goal_id}_${cycle.phase}`) as any;
      return [
        owner?.name ?? '?',
        owner?.department ?? '',
        mgr?.name ?? '—',
        g.title,
        g.thrust_area,
        g.uom_type?.toUpperCase(),
        `${g.weightage}%`,
        g.target_value ?? '—',
        (q1Ci as any)?.actual_achievement ?? '',
        (q2Ci as any)?.actual_achievement ?? '',
        (q3Ci as any)?.actual_achievement ?? '',
        (q4Ci as any)?.actual_achievement ?? '',
        latestCi?.computed_score != null ? `${latestCi.computed_score}%` : '—',
        g.status,
      ];
    });
    await writeSheetData(token, spreadsheetId, 'Goal Tracker', [goalHeaders, ...goalRows]);

    // ─── Tab 2: Completion Heatmap ───────────────────────────────
    const employees = users.filter((u: any) => u.role === 'employee');
    const heatmapHeaders = ['Employee', 'Department', 'Q1', 'Q2', 'Q3', 'Q4'];
    const phases = ['q1', 'q2', 'q3', 'q4'];
    const heatmapRows = employees.map((emp: any) => {
      const empGoals = goals.filter((g: any) => g.owner_id === emp.user_id && (g.status === 'locked' || g.status === 'approved'));
      const empGoalIds = empGoals.map((g: any) => g.goal_id);
      const row = [emp.name, emp.department];
      for (const ph of phases) {
        const phCheckins = checkins.filter((c: any) => empGoalIds.includes(c.goal_id) && c.phase === ph);
        if (phCheckins.length === 0) row.push('none');
        else if (phCheckins.length >= empGoals.length) row.push('done');
        else row.push('partial');
      }
      return row;
    });
    await writeSheetData(token, spreadsheetId, 'Completion Heatmap', [heatmapHeaders, ...heatmapRows]);

    // ─── Tab 3: Manager Leaderboard ──────────────────────────────
    const managers = users.filter((u: any) => u.role === 'manager');
    const mgrHeaders = ['Manager', 'Department', 'Team Size', 'Check-ins Done', 'Check-in Rate', 'Avg Score', 'Approved Goals', 'Pending Goals'];
    const mgrRows = managers.map((mgr: any) => {
      const reports = employees.filter((e: any) => e.manager_id === mgr.user_id);
      const reportIds = reports.map((r: any) => r.user_id);
      const teamGoals = goals.filter((g: any) => reportIds.includes(g.owner_id));
      const teamGoalIds = teamGoals.map((g: any) => g.goal_id);
      const teamCheckins = checkins.filter((c: any) => teamGoalIds.includes(c.goal_id) && c.phase === cycle.phase);
      const approvedCount = teamGoals.filter((g: any) => g.status === 'locked' || g.status === 'approved').length;
      const pendingCount = teamGoals.filter((g: any) => g.status === 'draft' || g.status === 'submitted' || g.status === 'returned').length;
      const avgScore = teamCheckins.length
        ? Math.round(teamCheckins.reduce((s: number, c: any) => s + (c.computed_score ?? 0), 0) / teamCheckins.length)
        : 0;
      const checkinRate = teamGoals.length ? Math.round((teamCheckins.length / teamGoals.length) * 100) : 0;

      return [
        mgr.name,
        mgr.department,
        reports.length,
        teamCheckins.length,
        `${checkinRate}%`,
        `${avgScore}%`,
        approvedCount,
        pendingCount,
      ];
    });
    await writeSheetData(token, spreadsheetId, 'Manager Leaderboard', [mgrHeaders, ...mgrRows]);

    // ─── Tab 4: Escalation Log ───────────────────────────────────
    const escHeaders = ['Date', 'Employee', 'Type', 'Escalated To', 'Message'];
    const escRows = escalations.map((e: any) => {
      const empUser = userMap.get(e.user_id) as any;
      const escTo = e.escalated_to ? (userMap.get(e.escalated_to) as any)?.name ?? e.escalated_to : '—';
      return [
        new Date(e.created_at).toLocaleString(),
        empUser?.name ?? '?',
        e.escalation_type,
        escTo,
        e.message ?? '',
      ];
    });
    await writeSheetData(token, spreadsheetId, 'Escalation Log', [escHeaders, ...escRows]);

    // ─── Apply Formatting ────────────────────────────────────────
    const finalMetaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const finalMeta = await finalMetaRes.json();
    const sheetIdMap = new Map();
    for (const sheet of finalMeta.sheets || []) {
      sheetIdMap.set(sheet.properties.title, sheet.properties.sheetId);
    }
    const sId0 = sheetIdMap.get('Goal Tracker');
    const sId1 = sheetIdMap.get('Completion Heatmap');
    const sId2 = sheetIdMap.get('Manager Leaderboard');
    const sId3 = sheetIdMap.get('Escalation Log');

    const batchRequests: any[] = [];

    // Header formatting for all sheets
    if (sId0 !== undefined) batchRequests.push(headerFormatting(sId0, goalHeaders.length));
    if (sId1 !== undefined) batchRequests.push(headerFormatting(sId1, heatmapHeaders.length));
    if (sId2 !== undefined) batchRequests.push(headerFormatting(sId2, mgrHeaders.length));
    if (sId3 !== undefined) batchRequests.push(headerFormatting(sId3, escHeaders.length));

    // Goal Tracker: status column conditional formatting (column index 13)
    if (sId0 !== undefined) batchRequests.push(...statusConditionalFormatting(sId0, 13, goalRows.length + 1));

    // Completion Heatmap: Q1-Q4 columns (indices 2-5)
    if (sId1 !== undefined) batchRequests.push(...heatmapConditionalFormatting(sId1, 2, 6, heatmapRows.length + 1));

    // Manager Leaderboard: auto-resize columns
    if (sId0 !== undefined) batchRequests.push({ autoResizeDimensions: { dimensions: { sheetId: sId0, dimension: 'COLUMNS', startIndex: 0, endIndex: goalHeaders.length } } });
    if (sId1 !== undefined) batchRequests.push({ autoResizeDimensions: { dimensions: { sheetId: sId1, dimension: 'COLUMNS', startIndex: 0, endIndex: heatmapHeaders.length } } });
    if (sId2 !== undefined) batchRequests.push({ autoResizeDimensions: { dimensions: { sheetId: sId2, dimension: 'COLUMNS', startIndex: 0, endIndex: mgrHeaders.length } } });
    if (sId3 !== undefined) batchRequests.push({ autoResizeDimensions: { dimensions: { sheetId: sId3, dimension: 'COLUMNS', startIndex: 0, endIndex: escHeaders.length } } });

    // Apply all formatting in a single batch
    await sheetsApi(token, `${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, 'POST', {
      requests: batchRequests,
    });

    return new Response(JSON.stringify({
      spreadsheetId,
      spreadsheetUrl,
      message: `Synced ${goals.length} goals, ${employees.length} employees, ${managers.length} managers, ${escalations.length} escalations`,
      tabs: sheetNames,
    }), { headers: corsHeaders });

  } catch (err) {
    console.error('sheets-sync error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
