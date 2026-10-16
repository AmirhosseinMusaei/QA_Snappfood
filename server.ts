import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SEED_ASSESSMENTS,
  SEED_AGENTS,
  SEED_FAULTS,
  SEED_TEAMS,
  SEED_CONTROLLERS,
  SEED_TEAM_LEADS,
  SEED_USERS,
  DEFAULT_SETTINGS,
} from './src/data/seedData.ts';
import { Assessment, Agent, Dispute } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory persistent state initialized with realistic seed data
let assessmentsStore: Assessment[] = [...SEED_ASSESSMENTS];
let agentsStore: Agent[] = [...SEED_AGENTS];
let faultsStore = [...SEED_FAULTS];
let settingsStore = { ...DEFAULT_SETTINGS };

// ==========================================
// 1. HEALTH & SYSTEM INFO
// ==========================================
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'SnappFood Commercial QA Portal',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL?.includes('sqlserver') ? 'Microsoft SQL Server' : 'SQLite / Dev Memory Store',
    counts: {
      assessments: assessmentsStore.length,
      agents: agentsStore.length,
      teams: SEED_TEAMS.length,
      controllers: SEED_CONTROLLERS.length,
    },
  });
});

// ==========================================
// 2. ASSESSMENTS API
// ==========================================
app.get('/api/assessments', (req: Request, res: Response) => {
  let list = assessmentsStore.filter((a) => !a.deleted_at);

  const { agent_id, form_type, result, controller_id, search } = req.query;

  if (agent_id && typeof agent_id === 'string') {
    list = list.filter((a) => a.agent_id === agent_id);
  }
  if (form_type && typeof form_type === 'string') {
    list = list.filter((a) => a.form_type === form_type);
  }
  if (result && typeof result === 'string') {
    list = list.filter((a) => a.result === result);
  }
  if (controller_id && typeof controller_id === 'string') {
    list = list.filter((a) => a.controller_id === controller_id);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        (a.vendor_title && a.vendor_title.toLowerCase().includes(q)) ||
        (a.vendor_id && a.vendor_id.includes(q)) ||
        (a.ticket_number && a.ticket_number.includes(q)) ||
        (a.phone_number && a.phone_number.includes(q))
    );
  }

  res.json({ success: true, count: list.length, data: list });
});

app.post('/api/assessments', (req: Request, res: Response) => {
  const body = req.body as Omit<Assessment, 'id' | 'created_at'>;
  const newId = `qa-${Date.now().toString().slice(-6)}`;
  const newAssessment: Assessment = {
    ...body,
    id: newId,
    created_at: new Date().toISOString(),
  };

  assessmentsStore.unshift(newAssessment);
  res.status(201).json({ success: true, data: newAssessment });
});

app.put('/api/assessments/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = assessmentsStore.findIndex((a) => a.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Assessment not found' });
  }

  assessmentsStore[index] = {
    ...assessmentsStore[index],
    ...req.body,
    updated_at: new Date().toISOString(),
  };

  res.json({ success: true, data: assessmentsStore[index] });
});

app.delete('/api/assessments/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = assessmentsStore.findIndex((a) => a.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Assessment not found' });
  }

  // Soft delete
  assessmentsStore[index].deleted_at = new Date().toISOString();
  res.json({ success: true, message: 'Assessment soft-deleted' });
});

// ==========================================
// 3. AGENTS API
// ==========================================
app.get('/api/agents', (req: Request, res: Response) => {
  let list = agentsStore.filter((ag) => ag.active !== false);

  const { team, department, source_id } = req.query;
  if (team && typeof team === 'string') {
    list = list.filter((ag) => ag.team === team);
  }
  if (department && typeof department === 'string') {
    list = list.filter((ag) => ag.department === department);
  }
  if (source_id && typeof source_id === 'string') {
    list = list.filter((ag) => ag.source_id === source_id);
  }

  res.json({ success: true, count: list.length, data: list });
});

app.post('/api/agents', (req: Request, res: Response) => {
  const body = req.body as Omit<Agent, 'id'>;
  const newAgent: Agent = {
    ...body,
    id: `agent-${body.source_id || Date.now().toString().slice(-4)}`,
    active: true,
  };

  agentsStore.push(newAgent);
  res.status(201).json({ success: true, data: newAgent });
});

app.put('/api/agents/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = agentsStore.findIndex((a) => a.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  agentsStore[idx] = { ...agentsStore[idx], ...req.body };
  res.json({ success: true, data: agentsStore[idx] });
});

// ==========================================
// 4. DISPUTES API
// ==========================================
app.get('/api/disputes', (req: Request, res: Response) => {
  const { status } = req.query;
  const disputed = assessmentsStore
    .filter((a) => a.dispute !== undefined)
    .map((a) => ({
      assessment_id: a.id,
      agent_id: a.agent_id,
      check_date: a.check_date,
      controller_id: a.controller_id,
      vendor_title: a.vendor_title,
      total_score: a.total_score,
      dispute: a.dispute!,
    }));

  const filtered =
    status && typeof status === 'string' && status !== 'all'
      ? disputed.filter((d) => d.dispute.status === status)
      : disputed;

  res.json({ success: true, count: filtered.length, data: filtered });
});

app.put('/api/disputes/:assessmentId/resolve', (req: Request, res: Response) => {
  const { assessmentId } = req.params;
  const { status, controller_comment, revised_score, controller_id } = req.body;

  const target = assessmentsStore.find((a) => a.id === assessmentId);
  if (!target || !target.dispute) {
    return res.status(404).json({ success: false, message: 'Dispute not found' });
  }

  const updatedDispute: Dispute = {
    ...target.dispute,
    status: status || 'resolved',
    controller_comment: controller_comment || 'رسیدگی شد',
    controller_id: controller_id || 'controller',
    resolved_at: new Date().toLocaleDateString('fa-IR'),
    revised_score: status === 'resolved' && revised_score !== undefined ? revised_score : target.total_score,
  };

  target.dispute = updatedDispute;
  if (status === 'resolved' && revised_score !== undefined) {
    target.total_score = revised_score;
  }
  target.updated_at = new Date().toISOString();

  res.json({ success: true, data: target });
});

// ==========================================
// 5. EXECUTIVE ANALYTICS API
// ==========================================
app.get('/api/analytics', (req: Request, res: Response) => {
  const { period = 'current_month', department = 'all' } = req.query;

  let activeAudits = assessmentsStore.filter((a) => !a.deleted_at);

  if (period === 'current_month') {
    activeAudits = activeAudits.filter((a) => a.check_date.includes('۰۷') || a.check_date.includes('/07/') || a.check_date.includes('/7/'));
  }

  if (department !== 'all') {
    activeAudits = activeAudits.filter((a) => a.form_type === department);
  }

  // Calculate High/Low Quality
  const highQuality: Array<{ agent_id: string; name: string; team: string; avg: number }> = [];
  const lowQuality: Array<{ agent_id: string; name: string; team: string; avg: number }> = [];

  agentsStore.forEach((ag) => {
    const audits = activeAudits.filter((a) => a.agent_id === ag.id);
    if (audits.length === 0) return;
    const scores = audits.map((a) => a.total_score);
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

    if (avg >= 95) {
      highQuality.push({ agent_id: ag.id, name: ag.name, team: ag.team, avg });
    } else if (avg < 80) {
      lowQuality.push({ agent_id: ag.id, name: ag.name, team: ag.team, avg });
    }
  });

  // Calculate Controller Productivity
  const controllerStats = SEED_CONTROLLERS.map((c) => {
    const checked = activeAudits.filter((a) => a.controller_id === c.name).length;
    return {
      name: c.name,
      display_name: c.display_name,
      checked,
      target: 160,
      percent: Math.min(100, Math.round((checked / 160) * 100)),
    };
  });

  res.json({
    success: true,
    totalAudits: activeAudits.length,
    highQuality,
    lowQuality,
    controllerStats,
  });
});

// ==========================================
// 6. CSV EXPORT & IMPORT API
// ==========================================
app.get('/api/export/assessments.csv', (_req: Request, res: Response) => {
  const headers = [
    'شناسه',
    'کارشناس',
    'کد سورس',
    'تیم',
    'واحد',
    'تاریخ بررسی',
    'شناسه وندور',
    'نام وندور',
    'نمره کل',
    'نتیجه',
    'کنترلر',
  ];

  const rows = assessmentsStore
    .filter((a) => !a.deleted_at)
    .map((a) => {
      const ag = agentsStore.find((item) => item.id === a.agent_id);
      return [
        a.id,
        ag?.name || '',
        ag?.source_id || '',
        ag?.team || '',
        a.form_type === 'support' ? 'پشتیبانی' : 'فروش',
        a.check_date,
        a.vendor_id || '',
        `"${(a.vendor_title || '').replace(/"/g, '""')}"`,
        a.total_score,
        a.result,
        a.controller_id,
      ];
    });

  const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=snappfood_assessments.csv');
  res.send(csv);
});

app.post('/api/import/json', (req: Request, res: Response) => {
  const { assessments, agents, settings } = req.body;
  if (Array.isArray(assessments)) {
    assessmentsStore = assessments;
  }
  if (Array.isArray(agents)) {
    agentsStore = agents;
  }
  if (settings) {
    settingsStore = { ...settingsStore, ...settings };
  }
  res.json({
    success: true,
    message: 'Data successfully restored to backend state',
    counts: {
      assessments: assessmentsStore.length,
      agents: agentsStore.length,
    },
  });
});

// ==========================================
// 7. DEV VITE MIDDLEWARE & PROD STATIC SERVE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite dev server middleware mounted in Express');
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SnappFood Commercial QA Server running at http://0.0.0.0:${PORT}`);
    console.log(`📡 API endpoints active on /api/*`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
