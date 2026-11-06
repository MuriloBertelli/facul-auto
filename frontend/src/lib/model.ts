import type { Assignment, AssignmentStatus } from '../../shared/types';
export type { Assignment, AssignmentStatus, Course, CanvasAssignment, Health } from '../../shared/types';

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  draft: 'Rascunho', in_progress: 'Em andamento', ready: 'Pronto para entregar', submitted: 'Entregue',
};
export const STORAGE_KEY = 'facul-auto.assignments.v1';
const statuses = Object.keys(STATUS_LABELS);

export function isAssignment(value: unknown): value is Assignment {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const strings = ['id', 'title', 'course_name', 'project_url', 'notes', 'created_at', 'updated_at'];
  const nullable = ['due_at', 'canvas_course_id', 'canvas_assignment_id', 'canvas_html_url'];
  return strings.every((key) => typeof row[key] === 'string')
    && nullable.every((key) => row[key] === null || typeof row[key] === 'string')
    && typeof row.status === 'string' && statuses.includes(row.status)
    && (row.user_id === undefined || typeof row.user_id === 'string')
    && (row.due_at === null || Number.isFinite(Date.parse(row.due_at as string)))
    && Number.isFinite(Date.parse(row.created_at as string))
    && Number.isFinite(Date.parse(row.updated_at as string))
    && (row.canvas_sync === undefined || (row.canvas_sync !== null && typeof row.canvas_sync === 'object'
      && !Array.isArray(row.canvas_sync) && (Object.keys(row.canvas_sync).length === 0
        || (['pending', 'submitted', 'graded', 'excused'].includes(String((row.canvas_sync as Record<string, unknown>).state))
          && typeof (row.canvas_sync as Record<string, unknown>).groupAssignment === 'boolean'))));
}

export type LocalAssignmentsRead =
  | { kind: 'missing' }
  | { kind: 'valid'; assignments: Assignment[] }
  | { kind: 'invalid'; raw: string }
  | { kind: 'unavailable' };

export function readLocalAssignments(storage: Pick<Storage, 'getItem'>): LocalAssignmentsRead {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch { return { kind: 'unavailable' }; }
  if (raw === null) return { kind: 'missing' };
  try {
    const rows: unknown = JSON.parse(raw);
    return Array.isArray(rows) && rows.every(isAssignment)
      ? { kind: 'valid', assignments: rows }
      : { kind: 'invalid', raw };
  } catch { return { kind: 'invalid', raw }; }
}

export function httpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

export function createAssignment(now = new Date()): Assignment {
  return {
    id: crypto.randomUUID(), title: '', course_name: '', due_at: null, status: 'draft', project_url: '', notes: '',
    canvas_course_id: null, canvas_assignment_id: null, canvas_html_url: null,
    created_at: now.toISOString(), updated_at: now.toISOString(),
  };
}

export function demoAssignments(now = new Date()): Assignment[] {
  const date = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  return [
    { ...createAssignment(now), title: 'Portfólio de desenvolvimento web', course_name: 'Desenvolvimento Web · exemplo', due_at: date(2), status: 'in_progress', notes: 'Exemplo fictício. Substitua por um trabalho seu.' },
    { ...createAssignment(now), title: 'Documentação do projeto integrador', course_name: 'Projeto Integrador · exemplo', due_at: date(5), status: 'draft', notes: 'Exemplo fictício para conhecer a organização dos trabalhos.' },
    { ...createAssignment(now), title: 'Landing page acessível', course_name: 'Interfaces Web · exemplo', due_at: date(7), status: 'ready', notes: 'Exemplo fictício. Nenhum trabalho foi importado ou entregue.' },
  ];
}

export function formatDueDate(value: string | null): string {
  if (!value) return 'Sem prazo';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).format(date)
    : 'Prazo inválido';
}

export function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
