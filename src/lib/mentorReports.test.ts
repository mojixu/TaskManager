import { describe, expect, it } from 'vitest'
import type { Mentor, MentorReport, Todo } from '../types'
import { buildMentorReportDraft, buildMentorSuggestion, sortMentorReports } from './mentorReports'

const mentor: Mentor = {
  id: 'mentor-1',
  name: '张老师',
  helped_with: '项目方向梳理',
  report_cycle_days: 14,
  last_reported_on: '2026-05-01',
  notes: '喜欢看到明确产物',
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
}

const reports: MentorReport[] = [
  {
    id: 'r1',
    mentor_id: 'mentor-1',
    report_date: '2026-05-01',
    content: '旧汇报',
    feedback: null,
    next_steps: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'r2',
    mentor_id: 'mentor-1',
    report_date: '2026-05-08',
    content: '新汇报',
    feedback: null,
    next_steps: null,
    created_at: '2026-05-08T00:00:00.000Z',
    updated_at: '2026-05-08T00:00:00.000Z',
  },
]

const todos: Todo[] = [
  {
    id: 'todo-1',
    title: '完成原型',
    details: null,
    status: 'done',
    priority: 'high',
    due_date: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-10T00:00:00.000Z',
  },
  {
    id: 'todo-2',
    title: '整理下一步计划',
    details: null,
    status: 'todo',
    priority: 'medium',
    due_date: '2026-05-12',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  },
]

describe('mentor report helpers', () => {
  it('sorts reports by report date descending', () => {
    expect(sortMentorReports(reports).map((report) => report.id)).toEqual(['r2', 'r1'])
  })

  it('builds a suggestion from mentor, reports, and todos', () => {
    const suggestion = buildMentorSuggestion(mentor, reports, todos)

    expect(suggestion).toContain('张老师')
    expect(suggestion).toContain('完成原型')
    expect(suggestion).toContain('整理下一步计划')
  })

  it('builds an editable report draft', () => {
    const draft = buildMentorReportDraft(mentor, reports, todos)

    expect(draft.content).toContain('感谢您之前')
    expect(draft.content).toContain('完成原型')
    expect(draft.next_steps).toContain('整理下一步计划')
  })
})
