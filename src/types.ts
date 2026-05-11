export type TodoStatus = 'todo' | 'doing' | 'done'
export type TodoPriority = 'low' | 'medium' | 'high'

export interface Todo {
  id: string
  user_id?: string
  title: string
  details: string | null
  status: TodoStatus
  priority: TodoPriority
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface Birthday {
  id: string
  user_id?: string
  name: string
  month: number
  day: number
  birth_year: number | null
  relationship: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Mentor {
  id: string
  user_id?: string
  name: string
  helped_with: string
  report_cycle_days: number | null
  last_reported_on: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MentorReport {
  id: string
  user_id?: string
  mentor_id: string
  report_date: string
  content: string
  feedback: string | null
  next_steps: string | null
  created_at: string
  updated_at: string
}

export type CopyMap = Record<string, string>

export interface ProfileSettings {
  id?: string
  user_id?: string
  copy: CopyMap
  created_at?: string
  updated_at?: string
}

export interface DashboardData {
  todos: Todo[]
  birthdays: Birthday[]
  mentors: Mentor[]
  mentorReports: MentorReport[]
  settings: ProfileSettings
}
