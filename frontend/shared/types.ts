export type AssignmentStatus = 'draft' | 'in_progress' | 'ready' | 'submitted'

export interface Assignment {
  id: string
  user_id?: string
  title: string
  course_name: string
  due_at: string | null
  status: AssignmentStatus
  project_url: string
  notes: string
  canvas_course_id: string | null
  canvas_assignment_id: string | null
  canvas_html_url: string | null
  created_at: string
  updated_at: string
  canvas_sync?: CanvasSync | Record<string, never>
}

export interface CanvasSync {
  state: 'pending' | 'submitted' | 'graded' | 'excused'
  groupAssignment: boolean
  missing: boolean
  late: boolean
  submittedAt: string | null
  gradedAt: string | null
  resubmissionRequired: boolean
  syncedAt: string
}

export interface Course { id: string; name: string; code: string }
export interface CanvasAssignment {
  id: string
  courseId: string
  name: string
  dueAt: string | null
  url: string | null
  submissionTypes: string[]
  submitted: boolean
  completionState: CanvasSync['state']
  groupAssignment: boolean
  missing: boolean
  late: boolean
  submittedAt: string | null
  gradedAt: string | null
  resubmissionRequired: boolean
}
export interface Health {
  status: 'ok'
  canvasConfigured: boolean
  supabaseConfigured: boolean
  submissionsEnabled: boolean
}
