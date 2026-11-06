import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Assignment, CanvasAssignment, CanvasSync, Course } from '../../shared/types';
import { apiRequest } from './api';
import { isAssignment, STATUS_LABELS } from './model';

export function canvasState(task: Assignment): CanvasSync | undefined {
  const value = task.canvas_sync;
  return value && 'state' in value ? value as CanvasSync : undefined;
}

export function isCompleted(task: Assignment): boolean {
  const state = canvasState(task);
  return state ? state.state !== 'pending' : task.status === 'submitted';
}

export function workStatusLabel(task: Assignment): string {
  const state = canvasState(task);
  if (!state) return STATUS_LABELS[task.status];
  if (state.state === 'excused') return 'Dispensada';
  if (state.state === 'graded') return 'Avaliada sem envio online';
  if (state.state === 'submitted') return state.groupAssignment ? 'Entregue em grupo' : 'Entregue no Canvas';
  if (state.resubmissionRequired) return 'Reenvio solicitado';
  if (state.missing || (task.due_at && Date.parse(task.due_at) < Date.now())) return 'Em atraso';
  return task.status === 'draft' || task.status === 'submitted' ? 'Pendente' : STATUS_LABELS[task.status];
}

export function mergeAssignments(current: Assignment[], incoming: Assignment[]): Assignment[] {
  const byId = new Map(current.map(task => [task.id, task]));
  for (const task of incoming) {
    const existing = byId.get(task.id);
    byId.set(task.id, existing && Date.parse(existing.updated_at) > Date.parse(task.updated_at)
      ? { ...task, notes: existing.notes, project_url: existing.project_url, updated_at: existing.updated_at } : task);
  }
  return [...byId.values()];
}

export function canvasSyncItem(course: Course, task: CanvasAssignment, syncedAt: string) {
  return {
    title: task.name, course_name: course.name, due_at: task.dueAt,
    canvas_course_id: course.id, canvas_assignment_id: task.id, canvas_html_url: task.url,
    canvas_sync: {
      state: task.completionState, groupAssignment: task.groupAssignment,
      missing: task.missing, late: task.late, submittedAt: task.submittedAt,
      gradedAt: task.gradedAt, resubmissionRequired: task.resubmissionRequired, syncedAt,
    } satisfies CanvasSync,
  };
}

export async function synchronizeCanvas(session: Session, database: SupabaseClient, hooks: {
  isCurrent: () => boolean;
  onRows: (rows: Assignment[]) => void;
  onProgress: (done: number, total: number) => void;
}): Promise<{ failedCourses: number; syncedAt: string }> {
  const { courses } = await apiRequest<{ courses: Course[] }>('/api/canvas/courses', session);
  let cursor = 0, done = 0, failedCourses = 0;
  const syncedAt = new Date().toISOString();
  hooks.onProgress(0, courses.length);
  async function worker() {
    while (hooks.isCurrent()) {
      const course = courses[cursor++];
      if (!course) return;
      let tasks: CanvasAssignment[];
      try {
        const result = await apiRequest<{ assignments: CanvasAssignment[] }>(`/api/canvas/assignments?courseId=${encodeURIComponent(course.id)}`, session);
        tasks = result.assignments;
      } catch {
        if (hooks.isCurrent()) { failedCourses++; hooks.onProgress(++done, courses.length); }
        continue;
      }
      // Deduplicate remote pages before an atomic database batch. Never POST to Canvas.
      const unique = [...new Map(tasks.map(task => [task.id, task])).values()];
      for (let start = 0; start < unique.length; start += 100) {
        if (!hooks.isCurrent()) return;
        const { data, error } = await database.rpc('sync_canvas_assignments', {
          p_items: unique.slice(start, start + 100).map(task => canvasSyncItem(course, task, syncedAt)),
        });
        if (!hooks.isCurrent()) return;
        if (error || !Array.isArray(data) || !data.every(isAssignment)) {
          throw new Error('Não foi possível salvar a atualização do Canvas. Os trabalhos já salvos foram preservados.');
        }
        hooks.onRows(data);
      }
      if (hooks.isCurrent()) hooks.onProgress(++done, courses.length);
    }
  }
  // Three read requests at a time, preserving Canvas rate limits and partial results.
  const results = await Promise.allSettled(Array.from({ length: Math.min(3, courses.length) }, worker));
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return { failedCourses, syncedAt };
}
