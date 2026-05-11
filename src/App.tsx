import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { LucideIcon } from 'lucide-react'
import {
  Brush,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  Gift,
  HandHeart,
  Home,
  History,
  LogOut,
  Mail,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import {
  daysUntilBirthday,
  formatBirthdayDate,
  formatNextBirthday,
  isBirthdayWithinDays,
  isValidMonthDay,
  sortBirthdaysByNext,
} from './lib/birthday'
import { defaultCopy, mergeCopy, type CopyKey } from './lib/copy'
import { buildMentorReportDraft, buildMentorSuggestion, sortMentorReports } from './lib/mentorReports'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type {
  Birthday,
  AppearanceStyle,
  DashboardData,
  Mentor,
  MentorReport,
  ProfileSettings,
  Todo,
  TodoPriority,
  TodoStatus,
} from './types'
import './index.css'

type ViewKey = 'overview' | 'todos' | 'birthdays' | 'mentors'

type TodoForm = {
  title: string
  details: string
  status: TodoStatus
  priority: TodoPriority
  due_date: string
}

type BirthdayForm = {
  name: string
  month: string
  day: string
  birth_year: string
  relationship: string
  notes: string
}

type MentorForm = {
  name: string
  helped_with: string
  report_cycle_days: string
  last_reported_on: string
  notes: string
}

type MentorReportForm = {
  report_date: string
  content: string
  feedback: string
  next_steps: string
}

const REMINDER_EMAIL = '2309117485@qq.com'
const LOCAL_KEY = 'task-manager-panel-data-v1'
const defaultSettings: ProfileSettings = {
  copy: defaultCopy,
  appearance: {
    style: 'paper',
  },
}

const emptyData: DashboardData = {
  todos: [],
  birthdays: [],
  mentors: [],
  mentorReports: [],
  settings: defaultSettings,
}

const emptyTodoForm: TodoForm = {
  title: '',
  details: '',
  status: 'todo',
  priority: 'medium',
  due_date: '',
}

const emptyBirthdayForm: BirthdayForm = {
  name: '',
  month: '',
  day: '',
  birth_year: '',
  relationship: '',
  notes: '',
}

const emptyMentorForm: MentorForm = {
  name: '',
  helped_with: '',
  report_cycle_days: '',
  last_reported_on: '',
  notes: '',
}

const emptyMentorReportForm: MentorReportForm = {
  report_date: '',
  content: '',
  feedback: '',
  next_steps: '',
}

const navItems: Array<{ key: ViewKey; labelKey: CopyKey; icon: LucideIcon }> = [
  { key: 'overview', labelKey: 'navOverview', icon: Home },
  { key: 'todos', labelKey: 'navTodos', icon: CheckCircle2 },
  { key: 'birthdays', labelKey: 'navBirthdays', icon: Gift },
  { key: 'mentors', labelKey: 'navMentors', icon: HandHeart },
]

const styleOptions: Array<{
  key: AppearanceStyle
  labelKey: CopyKey
  descKey: CopyKey
}> = [
  { key: 'paper', labelKey: 'stylePaperName', descKey: 'stylePaperDesc' },
  { key: 'mineral', labelKey: 'styleMineralName', descKey: 'styleMineralDesc' },
  { key: 'night', labelKey: 'styleNightName', descKey: 'styleNightDesc' },
]

const statusMeta: Record<TodoStatus, { labelKey: CopyKey; icon: LucideIcon }> = {
  todo: { labelKey: 'statusTodo', icon: Circle },
  doing: { labelKey: 'statusDoing', icon: Clock3 },
  done: { labelKey: 'statusDone', icon: CheckCircle2 },
}

const priorityMeta: Record<TodoPriority, { labelKey: CopyKey; tone: string }> = {
  low: { labelKey: 'priorityLow', tone: 'jade' },
  medium: { labelKey: 'priorityMedium', tone: 'ochre' },
  high: { labelKey: 'priorityHigh', tone: 'cinnabar' },
}

function nowIso() {
  return new Date().toISOString()
}

function createId() {
  return crypto.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toDateInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function offsetDateInput(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toDateInputValue(date)
}

function getSeedData(): DashboardData {
  const created = nowIso()

  return {
    todos: [
      {
        id: createId(),
        title: '整理本周进展',
        details: '把学习、项目和需要请教的问题写成一页清单。',
        status: 'doing',
        priority: 'high',
        due_date: offsetDateInput(1),
        created_at: created,
        updated_at: created,
      },
      {
        id: createId(),
        title: '复盘一个已完成任务',
        details: '记录做得顺的地方和下次要改进的地方。',
        status: 'todo',
        priority: 'medium',
        due_date: offsetDateInput(4),
        created_at: created,
        updated_at: created,
      },
    ],
    birthdays: [
      {
        id: createId(),
        name: '示例好友',
        month: 5,
        day: 13,
        birth_year: null,
        relationship: '朋友',
        notes: '准备一句真诚的祝福。',
        created_at: created,
        updated_at: created,
      },
    ],
    mentors: [
      {
        id: createId(),
        name: '示例前辈',
        helped_with: '帮我梳理过项目方向和下一步计划。',
        report_cycle_days: 14,
        last_reported_on: offsetDateInput(-10),
        notes: '汇报时带上可验证的进展。',
        created_at: created,
        updated_at: created,
      },
    ],
    mentorReports: [],
    settings: defaultSettings,
  }
}

function readLocalData(): DashboardData {
  if (typeof window === 'undefined') return getSeedData()

  try {
    const stored = window.localStorage.getItem(LOCAL_KEY)
    if (!stored) {
      const seed = getSeedData()
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(seed))
      return seed
    }

    const parsed = JSON.parse(stored) as Partial<DashboardData>
    return {
      todos: parsed.todos ?? [],
      birthdays: parsed.birthdays ?? [],
      mentors: parsed.mentors ?? [],
      mentorReports: parsed.mentorReports ?? [],
      settings: {
        ...defaultSettings,
        ...(parsed.settings ?? {}),
        copy: mergeCopy(parsed.settings?.copy),
        appearance: {
          ...defaultSettings.appearance,
          ...(parsed.settings?.appearance ?? {}),
        },
      },
    }
  } catch {
    return getSeedData()
  }
}

function writeLocalData(data: DashboardData) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  }
}

function makeEmptyReportForm() {
  return {
    ...emptyMentorReportForm,
    report_date: toDateInputValue(new Date()),
  }
}

function getMentorNextReportDate(mentor: Mentor) {
  if (!mentor.report_cycle_days || !mentor.last_reported_on) return null

  const due = new Date(`${mentor.last_reported_on}T00:00:00`)
  due.setDate(due.getDate() + mentor.report_cycle_days)
  return toDateInputValue(due)
}

function daysUntilDate(dateString: string) {
  const today = new Date(`${toDateInputValue(new Date())}T00:00:00`)
  const target = new Date(`${dateString}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function App() {
  const initialData = isSupabaseConfigured ? emptyData : readLocalData()
  const [activeView, setActiveView] = useState<ViewKey>('overview')
  const [todos, setTodos] = useState<Todo[]>(initialData.todos)
  const [birthdays, setBirthdays] = useState<Birthday[]>(initialData.birthdays)
  const [mentors, setMentors] = useState<Mentor[]>(initialData.mentors)
  const [mentorReports, setMentorReports] = useState<MentorReport[]>(initialData.mentorReports)
  const [settings, setSettings] = useState<ProfileSettings>(initialData.settings)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState(REMINDER_EMAIL)
  const [authPassword, setAuthPassword] = useState('')

  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [todoForm, setTodoForm] = useState<TodoForm | null>(null)
  const [editingBirthdayId, setEditingBirthdayId] = useState<string | null>(null)
  const [birthdayForm, setBirthdayForm] = useState<BirthdayForm | null>(null)
  const [editingMentorId, setEditingMentorId] = useState<string | null>(null)
  const [mentorForm, setMentorForm] = useState<MentorForm | null>(null)
  const [mentorReportForm, setMentorReportForm] = useState<MentorReportForm | null>(null)
  const [editingMentorReportId, setEditingMentorReportId] = useState<string | null>(null)
  const [customizeMode, setCustomizeMode] = useState(false)
  const [copyEditorKey, setCopyEditorKey] = useState<CopyKey | null>(null)
  const [copyEditorValue, setCopyEditorValue] = useState('')

  const copy = settings.copy
  const appearanceStyle = settings.appearance?.style ?? defaultSettings.appearance.style
  const c = useCallback((key: CopyKey) => copy[key] ?? defaultCopy[key], [copy])

  const currentData = useCallback(
    (overrides: Partial<DashboardData> = {}): DashboardData => ({
      todos,
      birthdays,
      mentors,
      mentorReports,
      settings,
      ...overrides,
    }),
    [birthdays, mentorReports, mentors, settings, todos],
  )

  const commitLocalData = useCallback((next: DashboardData) => {
    setTodos(next.todos)
    setBirthdays(next.birthdays)
    setMentors(next.mentors)
    setMentorReports(next.mentorReports)
    setSettings({
      ...next.settings,
      copy: mergeCopy(next.settings.copy),
      appearance: {
        ...defaultSettings.appearance,
        ...(next.settings.appearance ?? {}),
      },
    })
    writeLocalData(next)
  }, [])

  const loadCloudData = useCallback(async () => {
    if (!supabase || !session) return

    setDataLoading(true)
    setError(null)

    const [todosResponse, birthdaysResponse, mentorsResponse, reportsResponse, settingsResponse] = await Promise.all([
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('birthdays').select('*').order('name', { ascending: true }),
      supabase.from('mentors').select('*').order('name', { ascending: true }),
      supabase.from('mentor_reports').select('*').order('report_date', { ascending: false }),
      supabase.from('profile_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
    ])

    const firstError =
      todosResponse.error ??
      birthdaysResponse.error ??
      mentorsResponse.error ??
      reportsResponse.error ??
      settingsResponse.error
    if (firstError) {
      setError(firstError.message)
    } else {
      setTodos((todosResponse.data ?? []) as Todo[])
      setBirthdays((birthdaysResponse.data ?? []) as Birthday[])
      setMentors((mentorsResponse.data ?? []) as Mentor[])
      setMentorReports((reportsResponse.data ?? []) as MentorReport[])
      setSettings({
        ...defaultSettings,
        ...((settingsResponse.data as ProfileSettings | null) ?? {}),
        copy: mergeCopy((settingsResponse.data as ProfileSettings | null)?.copy),
        appearance: {
          ...defaultSettings.appearance,
          ...((settingsResponse.data as ProfileSettings | null)?.appearance ?? {}),
        },
      })
    }

    setDataLoading(false)
  }, [session])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      void loadCloudData()
    }
  }, [loadCloudData, session])

  const sortedBirthdays = useMemo(() => sortBirthdaysByNext(birthdays), [birthdays])
  const activeTodos = useMemo(() => todos.filter((todo) => todo.status !== 'done'), [todos])
  const doneTodos = todos.length - activeTodos.length
  const birthdayAlerts = useMemo(
    () => sortedBirthdays.filter((birthday) => isBirthdayWithinDays(birthday, 3)),
    [sortedBirthdays],
  )
  const mentorSignals = useMemo(
    () =>
      mentors
        .map((mentor) => {
          const nextReportDate = getMentorNextReportDate(mentor)
          return {
            mentor,
            nextReportDate,
            daysLeft: nextReportDate ? daysUntilDate(nextReportDate) : null,
          }
        })
        .sort((a, b) => {
          if (a.daysLeft === null) return 1
          if (b.daysLeft === null) return -1
          return a.daysLeft - b.daysLeft
        }),
    [mentors],
  )
  const sortedMentorReports = useMemo(() => sortMentorReports(mentorReports), [mentorReports])

  const todayInput = toDateInputValue(new Date())
  const dueSoonTodos = activeTodos
    .filter((todo) => todo.due_date)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 4)

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setError(null)
    setNotice(null)

    const credentials = {
      email: authEmail.trim(),
      password: authPassword,
    }

    const response =
      authMode === 'signin'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials)

    if (response.error) {
      setError(response.error.message)
      return
    }

    setNotice(authMode === 'signup' ? '账号已创建，请按 Supabase 邮件设置完成验证。' : null)
  }

  async function handleSignOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setTodos([])
    setBirthdays([])
    setMentors([])
    setMentorReports([])
    setSettings(defaultSettings)
  }

  function openTodoEditor(todo?: Todo) {
    setEditingTodoId(todo?.id ?? null)
    setTodoForm(
      todo
        ? {
            title: todo.title,
            details: todo.details ?? '',
            status: todo.status,
            priority: todo.priority,
            due_date: todo.due_date ?? '',
          }
        : emptyTodoForm,
    )
  }

  async function handleTodoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!todoForm) return

    const title = todoForm.title.trim()
    if (!title) {
      setError('待办标题不能为空。')
      return
    }

    setError(null)
    const payload = {
      title,
      details: todoForm.details.trim() || null,
      status: todoForm.status,
      priority: todoForm.priority,
      due_date: todoForm.due_date || null,
      updated_at: nowIso(),
    }

    if (supabase && session) {
      const query = editingTodoId
        ? supabase.from('todos').update(payload).eq('id', editingTodoId)
        : supabase.from('todos').insert({ ...payload, user_id: session.user.id })

      const { data, error: saveError } = await query.select().single()
      if (saveError) {
        setError(saveError.message)
        return
      }

      const saved = data as Todo
      setTodos((items) =>
        editingTodoId ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      )
    } else {
      const saved: Todo = {
        id: editingTodoId ?? createId(),
        created_at: todos.find((todo) => todo.id === editingTodoId)?.created_at ?? nowIso(),
        ...payload,
      }

      const nextTodos = editingTodoId
        ? todos.map((todo) => (todo.id === editingTodoId ? saved : todo))
        : [saved, ...todos]

      commitLocalData(currentData({ todos: nextTodos }))
    }

    setTodoForm(null)
    setEditingTodoId(null)
  }

  async function deleteTodo(todoId: string) {
    if (!window.confirm('确定删除这个待办吗？')) return

    if (supabase && session) {
      const { error: deleteError } = await supabase.from('todos').delete().eq('id', todoId)
      if (deleteError) {
        setError(deleteError.message)
        return
      }

      setTodos((items) => items.filter((item) => item.id !== todoId))
    } else {
      const nextTodos = todos.filter((todo) => todo.id !== todoId)
      commitLocalData(currentData({ todos: nextTodos }))
    }
  }

  function openBirthdayEditor(birthday?: Birthday) {
    setEditingBirthdayId(birthday?.id ?? null)
    setBirthdayForm(
      birthday
        ? {
            name: birthday.name,
            month: String(birthday.month),
            day: String(birthday.day),
            birth_year: birthday.birth_year ? String(birthday.birth_year) : '',
            relationship: birthday.relationship ?? '',
            notes: birthday.notes ?? '',
          }
        : emptyBirthdayForm,
    )
  }

  async function handleBirthdaySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!birthdayForm) return

    const month = Number(birthdayForm.month)
    const day = Number(birthdayForm.day)
    const birthYear = birthdayForm.birth_year.trim() ? Number(birthdayForm.birth_year) : null
    const name = birthdayForm.name.trim()

    if (!name) {
      setError('生日对象姓名不能为空。')
      return
    }

    if (!isValidMonthDay(month, day)) {
      setError('生日日期不合法。')
      return
    }

    if (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < 1900)) {
      setError('出生年份需要是 1900 年之后的整数。')
      return
    }

    setError(null)
    const payload = {
      name,
      month,
      day,
      birth_year: birthYear,
      relationship: birthdayForm.relationship.trim() || null,
      notes: birthdayForm.notes.trim() || null,
      updated_at: nowIso(),
    }

    if (supabase && session) {
      const query = editingBirthdayId
        ? supabase.from('birthdays').update(payload).eq('id', editingBirthdayId)
        : supabase.from('birthdays').insert({ ...payload, user_id: session.user.id })

      const { data, error: saveError } = await query.select().single()
      if (saveError) {
        setError(saveError.message)
        return
      }

      const saved = data as Birthday
      setBirthdays((items) =>
        editingBirthdayId
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [...items, saved],
      )
    } else {
      const saved: Birthday = {
        id: editingBirthdayId ?? createId(),
        created_at: birthdays.find((birthday) => birthday.id === editingBirthdayId)?.created_at ?? nowIso(),
        ...payload,
      }

      const nextBirthdays = editingBirthdayId
        ? birthdays.map((birthday) => (birthday.id === editingBirthdayId ? saved : birthday))
        : [...birthdays, saved]

      commitLocalData(currentData({ birthdays: nextBirthdays }))
    }

    setBirthdayForm(null)
    setEditingBirthdayId(null)
  }

  async function deleteBirthday(birthdayId: string) {
    if (!window.confirm('确定删除这个生日记录吗？')) return

    if (supabase && session) {
      const { error: deleteError } = await supabase.from('birthdays').delete().eq('id', birthdayId)
      if (deleteError) {
        setError(deleteError.message)
        return
      }

      setBirthdays((items) => items.filter((item) => item.id !== birthdayId))
    } else {
      const nextBirthdays = birthdays.filter((birthday) => birthday.id !== birthdayId)
      commitLocalData(currentData({ birthdays: nextBirthdays }))
    }
  }

  function openMentorEditor(mentor?: Mentor) {
    setEditingMentorId(mentor?.id ?? null)
    setEditingMentorReportId(null)
    setMentorReportForm(mentor ? makeEmptyReportForm() : null)
    setMentorForm(
      mentor
        ? {
            name: mentor.name,
            helped_with: mentor.helped_with,
            report_cycle_days: mentor.report_cycle_days ? String(mentor.report_cycle_days) : '',
            last_reported_on: mentor.last_reported_on ?? '',
            notes: mentor.notes ?? '',
          }
        : emptyMentorForm,
    )
  }

  async function handleMentorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mentorForm) return

    const name = mentorForm.name.trim()
    const cycleDays = mentorForm.report_cycle_days.trim()
      ? Number(mentorForm.report_cycle_days)
      : null

    if (!name) {
      setError('大佬姓名不能为空。')
      return
    }

    if (!mentorForm.helped_with.trim()) {
      setError('请记录对方帮助过你的事项。')
      return
    }

    if (cycleDays !== null && (!Number.isInteger(cycleDays) || cycleDays <= 0)) {
      setError('汇报周期需要是正整数天数。')
      return
    }

    setError(null)
    const payload = {
      name,
      helped_with: mentorForm.helped_with.trim(),
      report_cycle_days: cycleDays,
      last_reported_on: mentorForm.last_reported_on || null,
      notes: mentorForm.notes.trim() || null,
      updated_at: nowIso(),
    }

    if (supabase && session) {
      const query = editingMentorId
        ? supabase.from('mentors').update(payload).eq('id', editingMentorId)
        : supabase.from('mentors').insert({ ...payload, user_id: session.user.id })

      const { data, error: saveError } = await query.select().single()
      if (saveError) {
        setError(saveError.message)
        return
      }

      const saved = data as Mentor
      setMentors((items) =>
        editingMentorId
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [...items, saved],
      )
    } else {
      const saved: Mentor = {
        id: editingMentorId ?? createId(),
        created_at: mentors.find((mentor) => mentor.id === editingMentorId)?.created_at ?? nowIso(),
        ...payload,
      }

      const nextMentors = editingMentorId
        ? mentors.map((mentor) => (mentor.id === editingMentorId ? saved : mentor))
        : [...mentors, saved]

      commitLocalData(currentData({ mentors: nextMentors }))
    }

    setMentorForm(null)
    setEditingMentorId(null)
  }

  async function deleteMentor(mentorId: string) {
    if (!window.confirm('确定删除这条大佬维护记录吗？')) return

    if (supabase && session) {
      const { error: deleteError } = await supabase.from('mentors').delete().eq('id', mentorId)
      if (deleteError) {
        setError(deleteError.message)
        return
      }

      setMentors((items) => items.filter((item) => item.id !== mentorId))
    } else {
      const nextMentors = mentors.filter((mentor) => mentor.id !== mentorId)
      const nextReports = mentorReports.filter((report) => report.mentor_id !== mentorId)
      commitLocalData(currentData({ mentors: nextMentors, mentorReports: nextReports }))
    }
  }

  function openCopyEditor(key: CopyKey) {
    setCopyEditorKey(key)
    setCopyEditorValue(c(key))
  }

  async function saveCopyValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!copyEditorKey) return

    await persistSettings({
      ...settings,
      copy: mergeCopy({
        ...copy,
        [copyEditorKey]: copyEditorValue.trim() || defaultCopy[copyEditorKey],
      }),
    })
    setCopyEditorKey(null)
  }

  async function resetCopyValue() {
    if (!copyEditorKey) return

    const nextCopy = { ...copy }
    delete nextCopy[copyEditorKey]
    await persistSettings({
      ...settings,
      copy: mergeCopy(nextCopy),
    })
    setCopyEditorValue(defaultCopy[copyEditorKey])
  }

  async function persistSettings(nextSettings: ProfileSettings) {
    const normalized = {
      ...nextSettings,
      copy: mergeCopy(nextSettings.copy),
    }

    if (supabase && session) {
      const payload = {
        user_id: session.user.id,
        copy: normalized.copy,
        appearance: normalized.appearance,
      }
      const { data, error: saveError } = await supabase
        .from('profile_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single()

      if (saveError) {
        setError(saveError.message)
        return
      }

      setSettings({
        ...defaultSettings,
        ...(data as ProfileSettings),
        copy: mergeCopy((data as ProfileSettings).copy),
        appearance: {
          ...defaultSettings.appearance,
          ...((data as ProfileSettings).appearance ?? {}),
        },
      })
    } else {
      commitLocalData(currentData({ settings: normalized }))
    }
  }

  async function changeStyle(style: AppearanceStyle) {
    await persistSettings({
      ...settings,
      appearance: {
        style,
      },
    })
  }

  function openMentorReportEditor(report?: MentorReport) {
    setEditingMentorReportId(report?.id ?? null)
    setMentorReportForm(
      report
        ? {
            report_date: report.report_date,
            content: report.content,
            feedback: report.feedback ?? '',
            next_steps: report.next_steps ?? '',
          }
        : makeEmptyReportForm(),
    )
  }

  function fillMentorReportDraft() {
    if (!editingMentorId) return
    const mentor = mentors.find((item) => item.id === editingMentorId)
    if (!mentor) return

    const reports = sortedMentorReports.filter((report) => report.mentor_id === mentor.id)
    const draft = buildMentorReportDraft(mentor, reports, todos)
    setMentorReportForm({
      ...(mentorReportForm ?? makeEmptyReportForm()),
      content: draft.content,
      next_steps: draft.next_steps ?? '',
    })
  }

  async function handleMentorReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mentorReportForm || !editingMentorId) return

    if (!mentorReportForm.content.trim()) {
      setError('汇报内容不能为空。')
      return
    }

    setError(null)
    const payload = {
      mentor_id: editingMentorId,
      report_date: mentorReportForm.report_date || todayInput,
      content: mentorReportForm.content.trim(),
      feedback: mentorReportForm.feedback.trim() || null,
      next_steps: mentorReportForm.next_steps.trim() || null,
      updated_at: nowIso(),
    }

    if (supabase && session) {
      const query = editingMentorReportId
        ? supabase.from('mentor_reports').update(payload).eq('id', editingMentorReportId)
        : supabase.from('mentor_reports').insert({ ...payload, user_id: session.user.id })

      const { data, error: saveError } = await query.select().single()
      if (saveError) {
        setError(saveError.message)
        return
      }

      const saved = data as MentorReport
      setMentorReports((items) =>
        editingMentorReportId
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      )
    } else {
      const saved: MentorReport = {
        id: editingMentorReportId ?? createId(),
        created_at:
          mentorReports.find((report) => report.id === editingMentorReportId)?.created_at ?? nowIso(),
        ...payload,
      }
      const nextReports = editingMentorReportId
        ? mentorReports.map((report) => (report.id === editingMentorReportId ? saved : report))
        : [saved, ...mentorReports]

      commitLocalData(currentData({ mentorReports: nextReports }))
    }

    setMentorReportForm(makeEmptyReportForm())
    setEditingMentorReportId(null)
  }

  async function deleteMentorReport(reportId: string) {
    if (!window.confirm('确定删除这条汇报记录吗？')) return

    if (supabase && session) {
      const { error: deleteError } = await supabase.from('mentor_reports').delete().eq('id', reportId)
      if (deleteError) {
        setError(deleteError.message)
        return
      }

      setMentorReports((items) => items.filter((item) => item.id !== reportId))
    } else {
      const nextReports = mentorReports.filter((report) => report.id !== reportId)
      commitLocalData(currentData({ mentorReports: nextReports }))
    }
  }

  if (authLoading) {
    return <LoadingScreen label={c('loadingBoot')} />
  }

  function editableText(key: CopyKey, className?: string) {
    return (
      <EditableText
        className={className}
        copyKey={key}
        customizeMode={customizeMode}
        value={c(key)}
        onEdit={openCopyEditor}
      />
    )
  }

  if (isSupabaseConfigured && !session) {
    return (
      <AuthScreen
        authEmail={authEmail}
        authMode={authMode}
        authPassword={authPassword}
        error={error}
        notice={notice}
        text={c}
        onEmailChange={setAuthEmail}
        onModeChange={setAuthMode}
        onPasswordChange={setAuthPassword}
        onSubmit={handleAuthSubmit}
      />
    )
  }

  return (
    <div className={clsx('app-shell', `theme-${appearanceStyle}`)}>
      <img className="ink-landscape" src="/ink-landscape.svg" alt="" aria-hidden="true" />
      <aside className="side-nav" aria-label={c('navOverview')}>
        <div className="brand-block">
          <div className="brand-seal">墨</div>
          <div>
            <p className="brand-title">{editableText('appName')}</p>
            <p className="brand-subtitle">{editableText('brandSubtitle')}</p>
          </div>
        </div>
        <NavList
          activeView={activeView}
          customizeMode={customizeMode}
          text={c}
          onChange={setActiveView}
          onEditCopy={openCopyEditor}
        />
        <div className="sync-chip">
          <Sparkles size={16} />
          <span>{editableText(isSupabaseConfigured ? 'syncCloud' : 'syncLocal')}</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <p className="eyebrow">{editableText('birthdayReminderEyebrow')}</p>
            <h1>{editableText('heroTitle')}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-text-button muted" type="button" onClick={() => setActiveView('birthdays')}>
              <Mail size={18} />
              <span>{REMINDER_EMAIL}</span>
            </button>
            <button
              className={clsx('icon-text-button', customizeMode && 'active')}
              type="button"
              onClick={() => setCustomizeMode((value) => !value)}
            >
              <Brush size={18} />
              <span>{customizeMode ? c('doneCustomizing') : c('customize')}</span>
            </button>
            <div className="style-switcher" aria-label={c('styleSwitcherLabel')}>
              <span className="style-switcher-label">
                <Palette size={16} />
                <span>{editableText('styleSwitcherLabel')}</span>
              </span>
              <div className="style-options">
                {styleOptions.map((option) => (
                  <button
                    className={clsx('style-option', `style-option-${option.key}`, appearanceStyle === option.key && 'active')}
                    key={option.key}
                    type="button"
                    onClick={() => changeStyle(option.key)}
                    title={c(option.descKey)}
                    aria-label={`${c('styleSwitcherLabel')}：${c(option.labelKey)}`}
                  >
                    <span className="style-swatch" aria-hidden="true" />
                    <span>{editableText(option.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
            {session ? (
              <button className="icon-button" type="button" onClick={handleSignOut} aria-label={c('signOut')}>
                <LogOut size={20} />
              </button>
            ) : null}
          </div>
        </header>

        {!isSupabaseConfigured ? (
          <div className="notice-bar">
            {editableText('localPreviewNotice')}
          </div>
        ) : null}
        {error ? <div className="error-bar">{error}</div> : null}
        {notice ? <div className="notice-bar">{notice}</div> : null}

        {dataLoading ? (
          <LoadingScreen label={c('loadingData')} compact />
        ) : (
          <main className="workspace">
            {activeView === 'overview'
              ? renderOverview()
              : activeView === 'todos'
                ? renderTodos()
                : activeView === 'birthdays'
                  ? renderBirthdays()
                  : renderMentors()}
          </main>
        )}
      </div>

      <nav className="bottom-nav" aria-label={c('navOverview')}>
        <NavList
          activeView={activeView}
          compact
          customizeMode={customizeMode}
          text={c}
          onChange={setActiveView}
          onEditCopy={openCopyEditor}
        />
      </nav>

      {todoForm ? renderTodoDrawer() : null}
      {birthdayForm ? renderBirthdayDrawer() : null}
      {mentorForm ? renderMentorDrawer() : null}
      {copyEditorKey ? renderCopyEditor() : null}
    </div>
  )

  function renderOverview() {
    return (
      <>
        <section className="overview-band">
          <div>
            <p className="eyebrow">{editableText('overviewEyebrow')}</p>
            <h2>{editableText('overviewTitle')}</h2>
          </div>
          <div className="stat-grid">
            <StatTile label={editableText('statActiveTodos')} value={activeTodos.length} icon={CheckCircle2} />
            <StatTile label={editableText('statDoneTodos')} value={doneTodos} icon={CheckCircle2} />
            <StatTile label={editableText('statBirthdayAlerts')} value={birthdayAlerts.length} icon={Gift} />
            <StatTile label={editableText('statMentors')} value={mentors.length} icon={HandHeart} />
          </div>
        </section>

        <section className="overview-grid">
          <ListColumn
            title={editableText('upcomingTodos')}
            icon={Clock3}
            actionLabel={editableText('newTodo')}
            onAction={() => openTodoEditor()}
          >
            {dueSoonTodos.length ? (
              dueSoonTodos.map((todo) => (
                <TodoCard key={todo.id} text={c} todo={todo} onDelete={deleteTodo} onOpen={openTodoEditor} />
              ))
            ) : (
              <EmptyState label={editableText('emptyUpcomingTodos')} />
            )}
          </ListColumn>

          <ListColumn
            title={editableText('birthdayOrder')}
            icon={Gift}
            actionLabel={editableText('addBirthday')}
            onAction={() => openBirthdayEditor()}
          >
            {sortedBirthdays.slice(0, 4).length ? (
              sortedBirthdays
                .slice(0, 4)
                .map((birthday) => (
                  <BirthdayCard
                    key={birthday.id}
                    birthday={birthday}
                    text={c}
                    onDelete={deleteBirthday}
                    onOpen={openBirthdayEditor}
                  />
                ))
            ) : (
              <EmptyState label={editableText('emptyBirthdays')} />
            )}
          </ListColumn>

          <ListColumn
            title={editableText('mentorCare')}
            icon={HandHeart}
            actionLabel={editableText('addMentor')}
            onAction={() => openMentorEditor()}
          >
            {mentorSignals.slice(0, 4).length ? (
              mentorSignals
                .slice(0, 4)
                .map(({ mentor, daysLeft, nextReportDate }) => (
                  <MentorCard
                    key={mentor.id}
                    daysLeft={daysLeft}
                    mentor={mentor}
                    nextReportDate={nextReportDate}
                    reportsCount={mentorReports.filter((report) => report.mentor_id === mentor.id).length}
                    text={c}
                    onDelete={deleteMentor}
                    onOpen={openMentorEditor}
                  />
                ))
            ) : (
              <EmptyState label={editableText('emptyMentors')} />
            )}
          </ListColumn>
        </section>
      </>
    )
  }

  function renderTodos() {
    return (
      <section className="page-section">
        <SectionHeader
          actionLabel={editableText('newTodo')}
          icon={CheckCircle2}
          eyebrow={editableText('listEyebrow')}
          title={editableText('todosTitle')}
          onAction={() => openTodoEditor()}
        />
        <div className="record-list">
          {todos.length ? (
            todos.map((todo) => (
              <TodoCard key={todo.id} text={c} todo={todo} onDelete={deleteTodo} onOpen={openTodoEditor} />
            ))
          ) : (
            <EmptyState label={editableText('emptyTodos')} />
          )}
        </div>
      </section>
    )
  }

  function renderBirthdays() {
    return (
      <section className="page-section">
        <SectionHeader
          actionLabel={editableText('addBirthday')}
          icon={Gift}
          eyebrow={editableText('listEyebrow')}
          title={editableText('birthdaysTitle')}
          onAction={() => openBirthdayEditor()}
        />
        <div className="record-list">
          {sortedBirthdays.length ? (
            sortedBirthdays.map((birthday) => (
              <BirthdayCard
                key={birthday.id}
                birthday={birthday}
                text={c}
                onDelete={deleteBirthday}
                onOpen={openBirthdayEditor}
              />
            ))
          ) : (
            <EmptyState label={editableText('emptyBirthdays')} />
          )}
        </div>
      </section>
    )
  }

  function renderMentors() {
    return (
      <section className="page-section">
        <SectionHeader
          actionLabel={editableText('addMentor')}
          icon={HandHeart}
          eyebrow={editableText('listEyebrow')}
          title={editableText('mentorsTitle')}
          onAction={() => openMentorEditor()}
        />
        <div className="record-list">
          {mentorSignals.length ? (
            mentorSignals.map(({ mentor, daysLeft, nextReportDate }) => (
              <MentorCard
                key={mentor.id}
                daysLeft={daysLeft}
                mentor={mentor}
                nextReportDate={nextReportDate}
                reportsCount={mentorReports.filter((report) => report.mentor_id === mentor.id).length}
                text={c}
                onDelete={deleteMentor}
                onOpen={openMentorEditor}
              />
            ))
          ) : (
              <EmptyState label={editableText('emptyMentors')} />
          )}
        </div>
      </section>
    )
  }

  function renderTodoDrawer() {
    if (!todoForm) return null

    return (
      <Drawer
        closeLabel={c('close')}
        icon={CheckCircle2}
        title={editingTodoId ? editableText('editTodoTitle') : editableText('newTodoTitle')}
        onClose={() => setTodoForm(null)}
      >
        <form className="editor-form" onSubmit={handleTodoSubmit}>
          <label>
            <span>{editableText('todoTitleLabel')}</span>
            <input
              required
              value={todoForm.title}
              onChange={(event) => setTodoForm({ ...todoForm, title: event.target.value })}
              placeholder={c('todoTitlePlaceholder')}
            />
          </label>
          <label>
            <span>{editableText('todoDetailsLabel')}</span>
            <textarea
              value={todoForm.details}
              onChange={(event) => setTodoForm({ ...todoForm, details: event.target.value })}
              placeholder={c('todoDetailsPlaceholder')}
              rows={8}
            />
          </label>
          <div className="form-grid">
            <label>
              <span>{editableText('statusLabel')}</span>
              <select
                value={todoForm.status}
                onChange={(event) => setTodoForm({ ...todoForm, status: event.target.value as TodoStatus })}
              >
                <option value="todo">{c('statusTodo')}</option>
                <option value="doing">{c('statusDoing')}</option>
                <option value="done">{c('statusDone')}</option>
              </select>
            </label>
            <label>
              <span>{editableText('priorityLabel')}</span>
              <select
                value={todoForm.priority}
                onChange={(event) => setTodoForm({ ...todoForm, priority: event.target.value as TodoPriority })}
              >
                <option value="low">{c('priorityLow')}</option>
                <option value="medium">{c('priorityMedium')}</option>
                <option value="high">{c('priorityHigh')}</option>
              </select>
            </label>
          </div>
          <label>
            <span>{editableText('dueDateLabel')}</span>
            <input
              min="2000-01-01"
              type="date"
              value={todoForm.due_date}
              onChange={(event) => setTodoForm({ ...todoForm, due_date: event.target.value })}
            />
          </label>
          <FormActions cancelLabel={c('cancel')} saveLabel={c('save')} onCancel={() => setTodoForm(null)} />
        </form>
      </Drawer>
    )
  }

  function renderBirthdayDrawer() {
    if (!birthdayForm) return null

    return (
      <Drawer
        closeLabel={c('close')}
        icon={Gift}
        title={editingBirthdayId ? editableText('editBirthdayTitle') : editableText('newBirthdayTitle')}
        onClose={() => setBirthdayForm(null)}
      >
        <form className="editor-form" onSubmit={handleBirthdaySubmit}>
          <label>
            <span>{editableText('nameLabel')}</span>
            <input
              required
              value={birthdayForm.name}
              onChange={(event) => setBirthdayForm({ ...birthdayForm, name: event.target.value })}
              placeholder={c('birthdayNamePlaceholder')}
            />
          </label>
          <div className="form-grid">
            <label>
              <span>{editableText('monthLabel')}</span>
              <input
                max={12}
                min={1}
                required
                type="number"
                value={birthdayForm.month}
                onChange={(event) => setBirthdayForm({ ...birthdayForm, month: event.target.value })}
              />
            </label>
            <label>
              <span>{editableText('dayLabel')}</span>
              <input
                max={31}
                min={1}
                required
                type="number"
                value={birthdayForm.day}
                onChange={(event) => setBirthdayForm({ ...birthdayForm, day: event.target.value })}
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              <span>{editableText('birthYearLabel')}</span>
              <input
                min={1900}
                type="number"
                value={birthdayForm.birth_year}
                onChange={(event) => setBirthdayForm({ ...birthdayForm, birth_year: event.target.value })}
                placeholder={c('optionalPlaceholder')}
              />
            </label>
            <label>
              <span>{editableText('relationshipLabel')}</span>
              <input
                value={birthdayForm.relationship}
                onChange={(event) => setBirthdayForm({ ...birthdayForm, relationship: event.target.value })}
                placeholder={c('relationshipPlaceholder')}
              />
            </label>
          </div>
          <label>
            <span>{editableText('notesLabel')}</span>
            <textarea
              value={birthdayForm.notes}
              onChange={(event) => setBirthdayForm({ ...birthdayForm, notes: event.target.value })}
              placeholder={c('birthdayNotesPlaceholder')}
              rows={5}
            />
          </label>
          <FormActions cancelLabel={c('cancel')} saveLabel={c('save')} onCancel={() => setBirthdayForm(null)} />
        </form>
      </Drawer>
    )
  }

  function renderMentorDrawer() {
    if (!mentorForm) return null
    const currentMentor = editingMentorId ? mentors.find((mentor) => mentor.id === editingMentorId) : null
    const reportsForMentor = editingMentorId
      ? sortedMentorReports.filter((report) => report.mentor_id === editingMentorId)
      : []
    const suggestion = currentMentor
      ? buildMentorSuggestion(currentMentor, reportsForMentor, todos)
      : ''

    return (
      <Drawer
        closeLabel={c('close')}
        icon={HandHeart}
        title={editingMentorId ? editableText('editMentorTitle') : editableText('newMentorTitle')}
        onClose={() => setMentorForm(null)}
      >
        <form className="editor-form" onSubmit={handleMentorSubmit}>
          <label>
            <span>{editableText('nameLabel')}</span>
            <input
              required
              value={mentorForm.name}
              onChange={(event) => setMentorForm({ ...mentorForm, name: event.target.value })}
              placeholder={c('mentorNamePlaceholder')}
            />
          </label>
          <label>
            <span>{editableText('helpedWithLabel')}</span>
            <textarea
              required
              value={mentorForm.helped_with}
              onChange={(event) => setMentorForm({ ...mentorForm, helped_with: event.target.value })}
              placeholder={c('helpedWithPlaceholder')}
              rows={6}
            />
          </label>
          <div className="form-grid">
            <label>
              <span>{editableText('reportCycleLabel')}</span>
              <input
                min={1}
                type="number"
                value={mentorForm.report_cycle_days}
                onChange={(event) => setMentorForm({ ...mentorForm, report_cycle_days: event.target.value })}
                placeholder={c('daysPlaceholder')}
              />
            </label>
            <label>
              <span>{editableText('lastReportedLabel')}</span>
              <input
                max={todayInput}
                type="date"
                value={mentorForm.last_reported_on}
                onChange={(event) => setMentorForm({ ...mentorForm, last_reported_on: event.target.value })}
              />
            </label>
          </div>
          <label>
            <span>{editableText('notesLabel')}</span>
            <textarea
              value={mentorForm.notes}
              onChange={(event) => setMentorForm({ ...mentorForm, notes: event.target.value })}
              placeholder={c('mentorNotesPlaceholder')}
              rows={5}
            />
          </label>
          <FormActions cancelLabel={c('cancel')} saveLabel={c('save')} onCancel={() => setMentorForm(null)} />
        </form>
        {currentMentor ? (
          <div className="mentor-report-zone">
            <section className="suggestion-panel">
              <header>
                <h3>
                  <WandSparkles size={18} />
                  <span>{editableText('reportSuggestionTitle')}</span>
                </h3>
                <button className="small-action" type="button" onClick={fillMentorReportDraft}>
                  <Sparkles size={16} />
                  <span>{editableText('reportDraftButton')}</span>
                </button>
              </header>
              <p>{suggestion}</p>
            </section>

            <section className="report-editor-panel">
              <h3>
                <History size={18} />
                <span>
                  {editingMentorReportId ? editableText('editReportTitle') : editableText('newReportTitle')}
                </span>
              </h3>
              <form className="editor-form" onSubmit={handleMentorReportSubmit}>
                <label>
                  <span>{editableText('reportDateLabel')}</span>
                  <input
                    max={todayInput}
                    type="date"
                    value={mentorReportForm?.report_date ?? todayInput}
                    onChange={(event) =>
                      setMentorReportForm({ ...(mentorReportForm ?? makeEmptyReportForm()), report_date: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>{editableText('reportContentLabel')}</span>
                  <textarea
                    value={mentorReportForm?.content ?? ''}
                    onChange={(event) =>
                      setMentorReportForm({ ...(mentorReportForm ?? makeEmptyReportForm()), content: event.target.value })
                    }
                    placeholder={c('reportContentPlaceholder')}
                    rows={7}
                  />
                </label>
                <label>
                  <span>{editableText('reportFeedbackLabel')}</span>
                  <textarea
                    value={mentorReportForm?.feedback ?? ''}
                    onChange={(event) =>
                      setMentorReportForm({ ...(mentorReportForm ?? makeEmptyReportForm()), feedback: event.target.value })
                    }
                    placeholder={c('reportFeedbackPlaceholder')}
                    rows={4}
                  />
                </label>
                <label>
                  <span>{editableText('nextStepsLabel')}</span>
                  <textarea
                    value={mentorReportForm?.next_steps ?? ''}
                    onChange={(event) =>
                      setMentorReportForm({ ...(mentorReportForm ?? makeEmptyReportForm()), next_steps: event.target.value })
                    }
                    placeholder={c('nextStepsPlaceholder')}
                    rows={4}
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setMentorReportForm(makeEmptyReportForm())
                      setEditingMentorReportId(null)
                    }}
                  >
                    <X size={18} />
                    <span>{c('cancel')}</span>
                  </button>
                  <button className="primary-button" type="submit">
                    <Save size={18} />
                    <span>{editingMentorReportId ? c('updateReport') : c('addReport')}</span>
                  </button>
                </div>
              </form>
            </section>

            <section className="timeline-panel">
              <h3>
                <History size={18} />
                <span>{editableText('reportTimelineTitle')}</span>
              </h3>
              {reportsForMentor.length ? (
                <div className="timeline-list">
                  {reportsForMentor.map((report) => (
                    <article className="timeline-item" key={report.id}>
                      <div className="timeline-date">{report.report_date}</div>
                      <p>{report.content}</p>
                      {report.feedback ? <p className="timeline-muted">{report.feedback}</p> : null}
                      {report.next_steps ? <p className="timeline-muted">{report.next_steps}</p> : null}
                      <CardActions
                        editLabel={c('edit')}
                        deleteLabel={c('delete')}
                        onDelete={() => deleteMentorReport(report.id)}
                        onEdit={() => openMentorReportEditor(report)}
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState label={editableText('noReports')} />
              )}
            </section>
          </div>
        ) : null}
      </Drawer>
    )
  }

  function renderCopyEditor() {
    if (!copyEditorKey) return null

    return (
      <Drawer
        closeLabel={c('close')}
        icon={Brush}
        title={editableText('copyEditorTitle')}
        onClose={() => setCopyEditorKey(null)}
      >
        <form className="editor-form" onSubmit={saveCopyValue}>
          <p className="form-hint">{editableText('copyEditorHint')}</p>
          <label>
            <span>{editableText('copyValueLabel')}</span>
            <textarea
              value={copyEditorValue}
              onChange={(event) => setCopyEditorValue(event.target.value)}
              placeholder={c('copyValuePlaceholder')}
              rows={5}
            />
          </label>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={resetCopyValue}>
              <RotateCcw size={18} />
              <span>{c('resetDefault')}</span>
            </button>
            <button className="secondary-button" type="button" onClick={() => setCopyEditorKey(null)}>
              <X size={18} />
              <span>{c('cancel')}</span>
            </button>
            <button className="primary-button" type="submit">
              <Save size={18} />
              <span>{c('save')}</span>
            </button>
          </div>
        </form>
      </Drawer>
    )
  }
}

function NavList({
  activeView,
  compact = false,
  customizeMode,
  onEditCopy,
  text,
  onChange,
}: {
  activeView: ViewKey
  compact?: boolean
  customizeMode: boolean
  text: (key: CopyKey) => string
  onChange: (view: ViewKey) => void
  onEditCopy: (key: CopyKey) => void
}) {
  return (
    <div className={clsx('nav-list', compact && 'compact')}>
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            className={clsx('nav-item', activeView === item.key && 'active')}
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
          >
            <Icon size={20} />
            <EditableText
              copyKey={item.labelKey}
              customizeMode={customizeMode}
              value={text(item.labelKey)}
              onEdit={onEditCopy}
            />
          </button>
        )
      })}
    </div>
  )
}

function AuthScreen({
  authEmail,
  authMode,
  authPassword,
  error,
  notice,
  text,
  onEmailChange,
  onModeChange,
  onPasswordChange,
  onSubmit,
}: {
  authEmail: string
  authMode: 'signin' | 'signup'
  authPassword: string
  error: string | null
  notice: string | null
  text: (key: CopyKey) => string
  onEmailChange: (value: string) => void
  onModeChange: (value: 'signin' | 'signup') => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="auth-page">
      <img className="ink-landscape" src="/ink-landscape.svg" alt="" aria-hidden="true" />
      <section className="auth-panel">
        <div className="brand-block">
          <div className="brand-seal">墨</div>
          <div>
            <p className="brand-title">{text('appName')}</p>
            <p className="brand-subtitle">{text('authCloudEnabled')}</p>
          </div>
        </div>
        <div>
          <p className="eyebrow">{text('authEyebrow')}</p>
          <h1>{text('authTitle')}</h1>
        </div>
        {error ? <div className="error-bar">{error}</div> : null}
        {notice ? <div className="notice-bar">{notice}</div> : null}
        <form className="editor-form" onSubmit={onSubmit}>
          <label>
            <span>{text('emailLabel')}</span>
            <input
              autoComplete="email"
              type="email"
              value={authEmail}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </label>
          <label>
            <span>{text('passwordLabel')}</span>
            <input
              autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
              type="password"
              value={authPassword}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </label>
          <button className="primary-button" type="submit">
            <UserRound size={18} />
            <span>{authMode === 'signin' ? text('login') : text('createAccount')}</span>
          </button>
        </form>
        <button
          className="text-button"
          type="button"
          onClick={() => onModeChange(authMode === 'signin' ? 'signup' : 'signin')}
        >
          {authMode === 'signin' ? text('firstUseCreate') : text('backToLogin')}
        </button>
      </section>
    </div>
  )
}

function LoadingScreen({ compact = false, label }: { compact?: boolean; label: string }) {
  return (
    <div className={clsx('loading-screen', compact && 'compact')}>
      <div className="loading-mark">墨</div>
      <span>{label}</span>
    </div>
  )
}

function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: ReactNode; value: number }) {
  return (
    <div className="stat-tile">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SectionHeader({
  actionLabel,
  eyebrow,
  icon: Icon,
  onAction,
  title,
}: {
  actionLabel: ReactNode
  eyebrow: ReactNode
  icon: LucideIcon
  onAction: () => void
  title: ReactNode
}) {
  return (
    <header className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>
          <Icon size={24} />
          <span>{title}</span>
        </h2>
      </div>
      <button className="primary-button" type="button" onClick={onAction}>
        <Plus size={18} />
        <span>{actionLabel}</span>
      </button>
    </header>
  )
}

function ListColumn({
  actionLabel,
  children,
  icon: Icon,
  onAction,
  title,
}: {
  actionLabel: ReactNode
  children: ReactNode
  icon: LucideIcon
  onAction: () => void
  title: ReactNode
}) {
  return (
    <section className="list-column">
      <header>
        <h3>
          <Icon size={20} />
          <span>{title}</span>
        </h3>
        <button className="small-action" type="button" onClick={onAction}>
          <Plus size={16} />
          <span>{actionLabel}</span>
        </button>
      </header>
      <div className="record-list compact">{children}</div>
    </section>
  )
}

function TodoCard({
  onDelete,
  onOpen,
  text,
  todo,
}: {
  onDelete: (todoId: string) => void
  onOpen: (todo: Todo) => void
  text: (key: CopyKey) => string
  todo: Todo
}) {
  const StatusIcon = statusMeta[todo.status].icon
  const dueState =
    todo.due_date && todo.status !== 'done'
      ? daysUntilDate(todo.due_date) < 0
        ? text('overdue')
        : daysUntilDate(todo.due_date) === 0
          ? text('today')
          : `${daysUntilDate(todo.due_date)}${text('daysLater')}`
      : null

  return (
    <article className="record-card todo-card" role="button" tabIndex={0} onClick={() => onOpen(todo)}>
      <div className="record-main">
        <div className={clsx('status-dot', todo.status)}>
          <StatusIcon size={18} />
        </div>
        <div>
          <div className="record-title-row">
            <h4>{todo.title}</h4>
            <span className={clsx('pill', priorityMeta[todo.priority].tone)}>
              {text(priorityMeta[todo.priority].labelKey)}
            </span>
          </div>
          {todo.details ? <p className="record-note">{todo.details}</p> : null}
          <div className="record-meta">
            <span>{text(statusMeta[todo.status].labelKey)}</span>
            {todo.due_date ? <span>{todo.due_date}</span> : null}
            {dueState ? <span>{dueState}</span> : null}
          </div>
        </div>
      </div>
      <CardActions
        editLabel={text('edit')}
        deleteLabel={text('delete')}
        onDelete={() => onDelete(todo.id)}
        onEdit={() => onOpen(todo)}
      />
    </article>
  )
}

function BirthdayCard({
  birthday,
  onDelete,
  onOpen,
  text,
}: {
  birthday: Birthday
  onDelete: (birthdayId: string) => void
  onOpen: (birthday: Birthday) => void
  text: (key: CopyKey) => string
}) {
  const urgent = isBirthdayWithinDays(birthday, 3)

  return (
    <article className="record-card birthday-card" role="button" tabIndex={0} onClick={() => onOpen(birthday)}>
      <div className="record-main">
        <div className={clsx('status-dot', urgent ? 'urgent' : 'calm')}>
          <Gift size={18} />
        </div>
        <div>
          <div className="record-title-row">
            <h4>{birthday.name}</h4>
            <span className={clsx('pill', urgent ? 'cinnabar' : 'jade')}>{formatNextBirthday(birthday)}</span>
          </div>
          <p className="record-note">
            {formatBirthdayDate(birthday.month, birthday.day)}
            {birthday.relationship ? ` · ${birthday.relationship}` : ''}
          </p>
          <div className="record-meta">
            <span>{daysUntilBirthday(birthday)}天</span>
            {birthday.notes ? <span>{birthday.notes}</span> : null}
          </div>
        </div>
      </div>
      <CardActions
        editLabel={text('edit')}
        deleteLabel={text('delete')}
        onDelete={() => onDelete(birthday.id)}
        onEdit={() => onOpen(birthday)}
      />
    </article>
  )
}

function MentorCard({
  daysLeft,
  mentor,
  nextReportDate,
  onDelete,
  onOpen,
  reportsCount,
  text,
}: {
  daysLeft: number | null
  mentor: Mentor
  nextReportDate: string | null
  onDelete: (mentorId: string) => void
  onOpen: (mentor: Mentor) => void
  reportsCount: number
  text: (key: CopyKey) => string
}) {
  const dueText =
    daysLeft === null
      ? text('noReportCycle')
      : daysLeft < 0
        ? `${text('reportOverduePrefix')}${Math.abs(daysLeft)}${text('reportOverdueSuffix')}`
        : daysLeft === 0
          ? text('reportToday')
          : `${daysLeft}${text('daysLater')}`

  return (
    <article className="record-card mentor-card" role="button" tabIndex={0} onClick={() => onOpen(mentor)}>
      <div className="record-main">
        <div className={clsx('status-dot', daysLeft !== null && daysLeft <= 0 ? 'urgent' : 'calm')}>
          <HandHeart size={18} />
        </div>
        <div>
          <div className="record-title-row">
            <h4>{mentor.name}</h4>
            <span className={clsx('pill', daysLeft !== null && daysLeft <= 0 ? 'cinnabar' : 'jade')}>
              {dueText}
            </span>
          </div>
          <p className="record-note">{mentor.helped_with}</p>
          <div className="record-meta">
            {mentor.report_cycle_days ? <span>{mentor.report_cycle_days}{text('reportEverySuffix')}</span> : null}
            {nextReportDate ? <span>{nextReportDate}</span> : null}
            {reportsCount ? <span>{reportsCount} {text('reportCountSuffix')}</span> : null}
            {mentor.notes ? <span>{mentor.notes}</span> : null}
          </div>
        </div>
      </div>
      <CardActions
        editLabel={text('edit')}
        deleteLabel={text('delete')}
        onDelete={() => onDelete(mentor.id)}
        onEdit={() => onOpen(mentor)}
      />
    </article>
  )
}

function CardActions({
  deleteLabel,
  editLabel,
  onDelete,
  onEdit,
}: {
  deleteLabel: string
  editLabel: string
  onDelete: () => void
  onEdit: () => void
}) {
  return (
    <div className="card-actions">
      <button
        className="icon-button subtle"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onEdit()
        }}
        aria-label={editLabel}
        title={editLabel}
      >
        <Edit3 size={17} />
      </button>
      <button
        className="icon-button danger"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
        aria-label={deleteLabel}
        title={deleteLabel}
      >
        <Trash2 size={17} />
      </button>
    </div>
  )
}

function Drawer({
  children,
  closeLabel,
  icon: Icon,
  onClose,
  title,
}: {
  children: ReactNode
  closeLabel: string
  icon: LucideIcon
  onClose: () => void
  title: ReactNode
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <section className="drawer-panel" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
        <header className="drawer-header">
          <h2>
            <Icon size={22} />
            <span>{title}</span>
          </h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label={closeLabel}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function FormActions({
  cancelLabel,
  onCancel,
  saveLabel,
}: {
  cancelLabel: ReactNode
  onCancel: () => void
  saveLabel: ReactNode
}) {
  return (
    <div className="form-actions">
      <button className="secondary-button" type="button" onClick={onCancel}>
        <X size={18} />
        <span>{cancelLabel}</span>
      </button>
      <button className="primary-button" type="submit">
        <Save size={18} />
        <span>{saveLabel}</span>
      </button>
    </div>
  )
}

function EmptyState({ label }: { label: ReactNode }) {
  return (
    <div className="empty-state">
      <CalendarDays size={20} />
      <span>{label}</span>
    </div>
  )
}

function EditableText({
  className,
  copyKey,
  customizeMode,
  onEdit,
  value,
}: {
  className?: string
  copyKey: CopyKey
  customizeMode: boolean
  onEdit: (key: CopyKey) => void
  value: string
}) {
  if (!customizeMode) {
    return <span className={className}>{value}</span>
  }

  return (
    <span
      className={clsx('editable-copy', className)}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onEdit(copyKey)
      }}
      title="点击编辑这段文案"
    >
      <Edit3 size={13} />
      <span>{value}</span>
    </span>
  )
}

export default App
