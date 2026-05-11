import type { Mentor, MentorReport, Todo } from '../types'

export type MentorReportDraft = Pick<MentorReport, 'content' | 'next_steps'>

export function sortMentorReports<T extends Pick<MentorReport, 'report_date' | 'created_at'>>(
  reports: T[],
) {
  return [...reports].sort((a, b) => {
    const dateDiff = b.report_date.localeCompare(a.report_date)
    return dateDiff === 0 ? b.created_at.localeCompare(a.created_at) : dateDiff
  })
}

export function buildMentorSuggestion(
  mentor: Mentor,
  reports: MentorReport[],
  todos: Todo[],
) {
  const latestReport = sortMentorReports(reports)[0]
  const activeTodos = todos
    .filter((todo) => todo.status !== 'done')
    .sort((a, b) => String(a.due_date ?? '9999-12-31').localeCompare(String(b.due_date ?? '9999-12-31')))
    .slice(0, 3)

  const completedTodos = todos
    .filter((todo) => todo.status === 'done')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3)

  const lines = [
    `先感谢 ${mentor.name} 之前在「${mentor.helped_with}」上的帮助。`,
    latestReport
      ? `可以承接上次 ${latestReport.report_date} 的汇报，说明这段时间的新进展。`
      : '这是第一次正式记录汇报，可以先交代背景和当前状态。',
  ]

  if (completedTodos.length) {
    lines.push(`可提到已完成：${completedTodos.map((todo) => todo.title).join('、')}。`)
  }

  if (activeTodos.length) {
    lines.push(`下一步建议聚焦：${activeTodos.map((todo) => todo.title).join('、')}。`)
  }

  if (mentor.notes) {
    lines.push(`注意对方偏好或备注：${mentor.notes}`)
  }

  return lines.join('\n')
}

export function buildMentorReportDraft(
  mentor: Mentor,
  reports: MentorReport[],
  todos: Todo[],
): MentorReportDraft {
  const completedTodos = todos
    .filter((todo) => todo.status === 'done')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3)
  const activeTodos = todos
    .filter((todo) => todo.status !== 'done')
    .sort((a, b) => String(a.due_date ?? '9999-12-31').localeCompare(String(b.due_date ?? '9999-12-31')))
    .slice(0, 3)
  const latestReport = sortMentorReports(reports)[0]

  const progress = completedTodos.length
    ? completedTodos.map((todo) => `- 已完成：${todo.title}`).join('\n')
    : '- 最近主要在推进基础整理和下一步计划，还没有标记为完成的任务。'
  const nextSteps = activeTodos.length
    ? activeTodos.map((todo) => `- ${todo.title}${todo.due_date ? `（计划 ${todo.due_date} 前推进）` : ''}`).join('\n')
    : '- 继续沉淀当前方向，整理出下一轮可验证的成果。'

  return {
    content: [
      `${mentor.name}，您好：`,
      '',
      `感谢您之前在「${mentor.helped_with}」上给我的帮助。`,
      latestReport ? `上次汇报是 ${latestReport.report_date}，这次我想同步一下后续进展。` : '这是我第一次把进展整理成正式汇报。',
      '',
      progress,
      '',
      '我目前的理解和收获：',
      '- 我会继续把问题拆小，把每一步结果尽量做成可检查的产物。',
    ].join('\n'),
    next_steps: nextSteps,
  }
}
