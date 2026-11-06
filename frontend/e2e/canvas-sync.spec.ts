import { test, expect, type Page } from '@playwright/test';
import { createAssignment } from '../src/lib/model';
import { canvasState, isCompleted, mergeAssignments, workStatusLabel } from '../src/lib/canvas-sync';
import type { Assignment, CanvasAssignment } from '../shared/types';

const owner = '11111111-1111-4111-8111-111111111111';
const course = { id: '10', name: 'Gestão de projetos · fixture', code: 'TEST' };
const task = (id: string, name: string, completionState: CanvasAssignment['completionState'], groupAssignment = false): CanvasAssignment => ({
  id, name, courseId: '10', completionState, groupAssignment, dueAt: '2026-12-01T12:00:00Z',
  url: 'https://example.invalid/activity', submissionTypes: ['online_url'], submitted: completionState === 'submitted',
  submittedAt: completionState === 'submitted' ? '2026-10-01T12:00:00Z' : null,
  gradedAt: null, missing: false, late: false, resubmissionRequired: false,
});

async function fixture(page: Page, longContent = false) {
  const tasks = [task('20', 'Entrega do grupo · fixture', 'submitted', true),
    task('21', 'Trabalho pendente · fixture', 'pending'), task('22', 'Avaliação presencial · fixture', 'graded')];
  const fixtureCourse = longContent ? { ...course, name: 'Gestão de Projetos de Tecnologia da Informação (Turma 10º U) · Engenharia de Computação (Noite) · fixture' } : course;
  if (longContent) tasks[1].name = 'Relatório_de_atividade_sem_espaços_'.repeat(4);
  const rows = new Map<string, Assignment>();
  const user = { id: owner, aud: 'authenticated', email: 'owner@example.invalid',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString() };
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.fixture`;
  let reads = 0, failReads = false, canvasPosts = 0;
  await page.route('http://127.0.0.1:15499/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*' };
    if (url.pathname === '/auth/v1/token') {
      return route.fulfill({ json: { access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user }, headers });
    }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user, headers });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ json: {}, headers });
    if (url.pathname === '/rest/v1/assignments') return route.fulfill({ json: [...rows.values()], headers });
    if (url.pathname === '/rest/v1/rpc/sync_canvas_assignments') {
      const incoming = request.postDataJSON().p_items as Array<Partial<Assignment>>;
      const result = incoming.map(item => {
        const key = String(item.canvas_assignment_id); const previous = rows.get(key);
        const row = { ...createAssignment(), ...previous, ...item, id: previous?.id ?? crypto.randomUUID(), user_id: owner,
          notes: previous?.notes ?? 'Anotação pessoal · fixture', project_url: previous?.project_url ?? 'https://example.invalid/project',
          status: item.canvas_sync && 'state' in item.canvas_sync && item.canvas_sync.state !== 'pending' ? 'submitted' : 'draft' } as Assignment;
        rows.set(key, row); return row;
      });
      return route.fulfill({ json: result, headers });
    }
    throw new Error(`Unexpected fixture API ${url.pathname}`);
  });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (request.method() !== 'GET') { canvasPosts++; throw new Error('No Canvas write is allowed in this test'); }
    if (url.pathname === '/api/health') return route.fulfill({ json: { status: 'ok', canvasConfigured: true, supabaseConfigured: true, submissionsEnabled: false } });
    if (url.pathname === '/api/canvas/courses') return route.fulfill({ json: { courses: [fixtureCourse] } });
    if (url.pathname === '/api/canvas/assignments') {
      reads++;
      return failReads ? route.fulfill({ status: 503, json: { error: 'Fixture unavailable' } }) : route.fulfill({ json: { assignments: tasks } });
    }
    throw new Error(`Unexpected Canvas fixture ${url.pathname}`);
  });
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Entrar no meu espaço' }).click();
  await expect(page.getByText('Atividades atualizadas com o Canvas', { exact: true })).toBeVisible();
  return { tasks, rows, course: fixtureCourse, reads: () => reads, canvasPosts: () => canvasPosts, fail: () => { failReads = true; } };
}

for (const width of [320, 360, 390, 430]) {
  test(`mobile ${width}px supports long activities, filters, editor and saved login`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    const state = await fixture(page, true);
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    };
    await fits();
    const search = page.getByRole('textbox', { name: 'Buscar por trabalho ou disciplina' });
    expect(await search.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await search.fill('sem_espaços');
    const title = page.getByRole('button', { name: state.tasks[1].name, exact: true });
    await expect(title).toBeVisible();
    await page.getByRole('combobox', { name: 'Filtrar por disciplina', exact: true }).selectOption(state.course.name);
    await page.getByRole('combobox', { name: 'Filtrar por tipo de atividade', exact: true }).selectOption('individual');
    await fits();
    await title.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.getByLabel('Anotações').fill('Revisão pelo celular · fixture');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Concluídos', exact: true }).click();
    await search.fill('');
    await page.getByRole('combobox', { name: 'Filtrar por tipo de atividade', exact: true }).selectOption('group');
    await expect(page.getByText('Entregue em grupo', { exact: true })).toBeVisible();
    await fits();
    if (width === 390) await test.info().attach('mobile-390px-fixture', {
      body: await page.screenshot({ fullPage: true, path: test.info().outputPath('mobile-390.png') }), contentType: 'image/png',
    });
    await page.reload();
    await expect(page.getByRole('button', { name: state.tasks[1].name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Entrar no meu espaço', exact: true })).toBeVisible();
    await fits();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Entrar no meu espaço', exact: true })).toBeVisible();
    expect(state.canvasPosts()).toBe(0);
  });
}

test('automatically loads, separates group deliveries and refreshes without duplication or Canvas POSTs', async ({ page }) => {
  await page.clock.install();
  const state = await fixture(page);
  await expect(page.getByRole('button', { name: 'Trabalho pendente · fixture', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrega do grupo · fixture', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Concluídos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrega do grupo · fixture', exact: true })).toBeVisible();
  await expect(page.getByText('Entregue em grupo', { exact: true })).toBeVisible();
  await expect(page.getByText('Avaliada sem envio online', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Filtrar por tipo de atividade', exact: true }).selectOption('group');
  await expect(page.getByRole('button', { name: 'Avaliação presencial · fixture', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Entrega do grupo · fixture', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Anotações')).toHaveValue('Anotação pessoal · fixture');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Revisar envio ao Canvas' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const initialReads = state.reads();
  await page.clock.fastForward(5 * 60_000);
  await expect.poll(state.reads).toBeGreaterThan(initialReads);
  await expect(page.getByRole('button', { name: 'Atualizar Canvas', exact: true })).toBeEnabled();
  expect(state.rows.size).toBe(3);
  expect(state.canvasPosts()).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Trabalho pendente · fixture', exact: true })).toBeVisible();
  expect(state.rows.size).toBe(3);
});

test('Canvas read failure preserves saved activities and personal notes', async ({ page }) => {
  const state = await fixture(page);
  state.fail();
  await page.getByRole('button', { name: 'Atualizar Canvas', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('dados anteriores foram preservados');
  await expect(page.getByRole('button', { name: 'Trabalho pendente · fixture', exact: true })).toBeVisible();
  expect(state.rows.get('21')?.notes).toBe('Anotação pessoal · fixture');
  expect(state.canvasPosts()).toBe(0);
});

test('a delayed sync response cannot replace a newer personal edit', () => {
  const fresh = { ...createAssignment(), notes: 'Nova anotação', project_url: 'https://example.invalid/new', updated_at: '2026-11-05T20:00:00Z' };
  const old = { ...fresh, notes: 'Texto antigo', project_url: '', updated_at: '2026-11-05T19:00:00Z' };
  const [merged] = mergeAssignments([fresh], [old]);
  expect(merged.notes).toBe(fresh.notes);
  expect(merged.project_url).toBe(fresh.project_url);
  expect(isCompleted(merged)).toBe(false);
  expect(canvasState(merged)).toBeUndefined();
  expect(workStatusLabel(merged)).toBe('Rascunho');
});
