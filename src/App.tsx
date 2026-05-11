import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  Gift,
  HandHeart,
  Home,
  LogOut,
  Mail,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRound,
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
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Birthday, DashboardData, Mentor, Todo, TodoPriority, TodoStatus } from './types'
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

const REMINDER_EMAIL = '2309117485@qq.com'
const LOCAL_KEY = 'task-manager-panel-data-v1'

const emptyData: DashboardData = {
  todos: [],
  birthdays: [],
  mentors: [],
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

const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: 'overview', label: '总览', icon: Home },
  { key: 'todos', label: '待办', icon: CheckCircle2 },
  { key: 'birthdays', label: '生日', icon: Gift },
  { key: 'mentors', label: '大佬', icon: HandHeart },
]

const statusMeta: Record<TodoStatus, { label: string; icon: LucideIcon }> = {
  todo: { label: '待启', icon: Circle },
  doing: { label: '进行', icon: Clock3 },
  done: { label: '已成', icon: CheckCircle2 },
}

const priorityMeta: Record<TodoPriority, { label: string; tone: string }> = {
  low: { label: '从容', tone: 'jade' },
  medium: { label: '适中', tone: 'ochre' },
  high: { label: '要紧', tone: 'cinnabar' },
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

  const currentData = useCallback(
    (overrides: Partial<DashboardData> = {}): DashboardData => ({
      todos,
      birthdays,
      mentors,
      ...overrides,
    }),
    [birthdays, mentors, todos],
  )

  const commitLocalData = useCallback((next: DashboardData) => {
    setTodos(next.todos)
    setBirthdays(next.birthdays)
    setMentors(next.mentors)
    writeLocalData(next)
  }, [])

  const loadCloudData = useCallback(async () => {
    if (!supabase || !session) return

    setDataLoading(true)
    setError(null)

    const [todosResponse, birthdaysResponse, mentorsResponse] = await Promise.all([
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('birthdays').select('*').order('name', { ascending: true }),
      supabase.from('mentors').select('*').order('name', { ascending: true }),
    ])

    const firstError = todosResponse.error ?? birthdaysResponse.error ?? mentorsResponse.error
    if (firstError) {
      setError(firstError.message)
    } else {
      setTodos((todosResponse.data ?? []) as Todo[])
      setBirthdays((birthdaysResponse.data ?? []) as Birthday[])
      setMentors((mentorsResponse.data ?? []) as Mentor[])
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
      commitLocalData(currentData({ mentors: nextMentors }))
    }
  }

  if (authLoading) {
    return <LoadingScreen label="正在开卷" />
  }

  if (isSupabaseConfigured && !session) {
    return (
      <AuthScreen
        authEmail={authEmail}
        authMode={authMode}
        authPassword={authPassword}
        error={error}
        notice={notice}
        onEmailChange={setAuthEmail}
        onModeChange={setAuthMode}
        onPasswordChange={setAuthPassword}
        onSubmit={handleAuthSubmit}
      />
    )
  }

  return (
    <div className="app-shell">
      <img className="ink-landscape" src="/ink-landscape.svg" alt="" aria-hidden="true" />
      <aside className="side-nav" aria-label="主导航">
        <div className="brand-block">
          <div className="brand-seal">墨</div>
          <div>
            <p className="brand-title">墨迹面板</p>
            <p className="brand-subtitle">任务有序，人情不忘</p>
          </div>
        </div>
        <NavList activeView={activeView} onChange={setActiveView} />
        <div className="sync-chip">
          <Sparkles size={16} />
          <span>{isSupabaseConfigured ? '云同步' : '本地预览'}</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <p className="eyebrow">北京时间 20:00 生日提醒</p>
            <h1>把眼前事与重要的人，都稳稳放在手边</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-text-button muted" type="button" onClick={() => setActiveView('birthdays')}>
              <Mail size={18} />
              <span>{REMINDER_EMAIL}</span>
            </button>
            {session ? (
              <button className="icon-button" type="button" onClick={handleSignOut} aria-label="退出登录">
                <LogOut size={20} />
              </button>
            ) : null}
          </div>
        </header>

        {!isSupabaseConfigured ? (
          <div className="notice-bar">
            当前为本地预览模式。填入 Supabase 环境变量后，Android 和 Windows 会自动使用云同步。
          </div>
        ) : null}
        {error ? <div className="error-bar">{error}</div> : null}
        {notice ? <div className="notice-bar">{notice}</div> : null}

        {dataLoading ? (
          <LoadingScreen label="正在取数" compact />
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

      <nav className="bottom-nav" aria-label="移动端主导航">
        <NavList activeView={activeView} onChange={setActiveView} compact />
      </nav>

      {todoForm ? renderTodoDrawer() : null}
      {birthdayForm ? renderBirthdayDrawer() : null}
      {mentorForm ? renderMentorDrawer() : null}
    </div>
  )

  function renderOverview() {
    return (
      <>
        <section className="overview-band">
          <div>
            <p className="eyebrow">今日总览</p>
            <h2>案头清爽，心里就有余地</h2>
          </div>
          <div className="stat-grid">
            <StatTile label="未完成" value={activeTodos.length} icon={CheckCircle2} />
            <StatTile label="已完成" value={doneTodos} icon={CheckCircle2} />
            <StatTile label="三日生日" value={birthdayAlerts.length} icon={Gift} />
            <StatTile label="维护对象" value={mentors.length} icon={HandHeart} />
          </div>
        </section>

        <section className="overview-grid">
          <ListColumn
            title="近期待办"
            icon={Clock3}
            actionLabel="新待办"
            onAction={() => openTodoEditor()}
          >
            {dueSoonTodos.length ? (
              dueSoonTodos.map((todo) => (
                <TodoCard key={todo.id} todo={todo} onDelete={deleteTodo} onOpen={openTodoEditor} />
              ))
            ) : (
              <EmptyState label="暂无临近截止的待办" />
            )}
          </ListColumn>

          <ListColumn
            title="生日顺序"
            icon={Gift}
            actionLabel="记生日"
            onAction={() => openBirthdayEditor()}
          >
            {sortedBirthdays.slice(0, 4).length ? (
              sortedBirthdays
                .slice(0, 4)
                .map((birthday) => (
                  <BirthdayCard
                    key={birthday.id}
                    birthday={birthday}
                    onDelete={deleteBirthday}
                    onOpen={openBirthdayEditor}
                  />
                ))
            ) : (
              <EmptyState label="暂无生日记录" />
            )}
          </ListColumn>

          <ListColumn
            title="大佬维护"
            icon={HandHeart}
            actionLabel="加记录"
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
                    onDelete={deleteMentor}
                    onOpen={openMentorEditor}
                  />
                ))
            ) : (
              <EmptyState label="暂无维护记录" />
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
          actionLabel="新待办"
          icon={CheckCircle2}
          title="待办任务"
          onAction={() => openTodoEditor()}
        />
        <div className="record-list">
          {todos.length ? (
            todos.map((todo) => (
              <TodoCard key={todo.id} todo={todo} onDelete={deleteTodo} onOpen={openTodoEditor} />
            ))
          ) : (
            <EmptyState label="还没有待办" />
          )}
        </div>
      </section>
    )
  }

  function renderBirthdays() {
    return (
      <section className="page-section">
        <SectionHeader
          actionLabel="记生日"
          icon={Gift}
          title="生日清单"
          onAction={() => openBirthdayEditor()}
        />
        <div className="record-list">
          {sortedBirthdays.length ? (
            sortedBirthdays.map((birthday) => (
              <BirthdayCard
                key={birthday.id}
                birthday={birthday}
                onDelete={deleteBirthday}
                onOpen={openBirthdayEditor}
              />
            ))
          ) : (
            <EmptyState label="还没有生日记录" />
          )}
        </div>
      </section>
    )
  }

  function renderMentors() {
    return (
      <section className="page-section">
        <SectionHeader
          actionLabel="加记录"
          icon={HandHeart}
          title="大佬维护清单"
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
                onDelete={deleteMentor}
                onOpen={openMentorEditor}
              />
            ))
          ) : (
            <EmptyState label="还没有维护记录" />
          )}
        </div>
      </section>
    )
  }

  function renderTodoDrawer() {
    if (!todoForm) return null

    return (
      <Drawer icon={CheckCircle2} title={editingTodoId ? '编辑待办' : '新建待办'} onClose={() => setTodoForm(null)}>
        <form className="editor-form" onSubmit={handleTodoSubmit}>
          <label>
            <span>标题</span>
            <input
              required
              value={todoForm.title}
              onChange={(event) => setTodoForm({ ...todoForm, title: event.target.value })}
              placeholder="这件事叫什么"
            />
          </label>
          <label>
            <span>具体要求</span>
            <textarea
              value={todoForm.details}
              onChange={(event) => setTodoForm({ ...todoForm, details: event.target.value })}
              placeholder="验收标准、背景、注意事项"
              rows={8}
            />
          </label>
          <div className="form-grid">
            <label>
              <span>状态</span>
              <select
                value={todoForm.status}
                onChange={(event) => setTodoForm({ ...todoForm, status: event.target.value as TodoStatus })}
              >
                <option value="todo">待启</option>
                <option value="doing">进行</option>
                <option value="done">已成</option>
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select
                value={todoForm.priority}
                onChange={(event) => setTodoForm({ ...todoForm, priority: event.target.value as TodoPriority })}
              >
                <option value="low">从容</option>
                <option value="medium">适中</option>
                <option value="high">要紧</option>
              </select>
            </label>
          </div>
          <label>
            <span>截止时间</span>
            <input
              min="2000-01-01"
              type="date"
              value={todoForm.due_date}
              onChange={(event) => setTodoForm({ ...todoForm, due_date: event.target.value })}
            />
          </label>
          <FormActions onCancel={() => setTodoForm(null)} />
        </form>
      </Drawer>
    )
  }

  function renderBirthdayDrawer() {
    if (!birthdayForm) return null

    return (
      <Drawer icon={Gift} title={editingBirthdayId ? '编辑生日' : '记录生日'} onClose={() => setBirthdayForm(null)}>
        <form className="editor-form" onSubmit={handleBirthdaySubmit}>
          <label>
            <span>姓名</span>
            <input
              required
              value={birthdayForm.name}
              onChange={(event) => setBirthdayForm({ ...birthdayForm, name: event.target.value })}
              placeholder="要记住谁"
            />
          </label>
          <div className="form-grid">
            <label>
              <span>月份</span>
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
              <span>日期</span>
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
              <span>出生年份</span>
              <input
                min={1900}
                type="number"
                value={birthdayForm.birth_year}
                onChange={(event) => setBirthdayForm({ ...birthdayForm, birth_year: event.target.value })}
                placeholder="可不填"
              />
            </label>
            <label>
              <span>关系</span>
              <input
                value={birthdayForm.relationship}
                onChange={(event) => setBirthdayForm({ ...birthdayForm, relationship: event.target.value })}
                placeholder="朋友、家人、同学"
              />
            </label>
          </div>
          <label>
            <span>备注</span>
            <textarea
              value={birthdayForm.notes}
              onChange={(event) => setBirthdayForm({ ...birthdayForm, notes: event.target.value })}
              placeholder="礼物、祝福、忌口"
              rows={5}
            />
          </label>
          <FormActions onCancel={() => setBirthdayForm(null)} />
        </form>
      </Drawer>
    )
  }

  function renderMentorDrawer() {
    if (!mentorForm) return null

    return (
      <Drawer icon={HandHeart} title={editingMentorId ? '编辑维护' : '记录大佬'} onClose={() => setMentorForm(null)}>
        <form className="editor-form" onSubmit={handleMentorSubmit}>
          <label>
            <span>姓名</span>
            <input
              required
              value={mentorForm.name}
              onChange={(event) => setMentorForm({ ...mentorForm, name: event.target.value })}
              placeholder="对方怎么称呼"
            />
          </label>
          <label>
            <span>帮助过我的事</span>
            <textarea
              required
              value={mentorForm.helped_with}
              onChange={(event) => setMentorForm({ ...mentorForm, helped_with: event.target.value })}
              placeholder="对方给过什么建议、资源或关键帮助"
              rows={6}
            />
          </label>
          <div className="form-grid">
            <label>
              <span>汇报周期</span>
              <input
                min={1}
                type="number"
                value={mentorForm.report_cycle_days}
                onChange={(event) => setMentorForm({ ...mentorForm, report_cycle_days: event.target.value })}
                placeholder="天数"
              />
            </label>
            <label>
              <span>上次汇报</span>
              <input
                max={todayInput}
                type="date"
                value={mentorForm.last_reported_on}
                onChange={(event) => setMentorForm({ ...mentorForm, last_reported_on: event.target.value })}
              />
            </label>
          </div>
          <label>
            <span>备注</span>
            <textarea
              value={mentorForm.notes}
              onChange={(event) => setMentorForm({ ...mentorForm, notes: event.target.value })}
              placeholder="下次汇报重点、对方偏好"
              rows={5}
            />
          </label>
          <FormActions onCancel={() => setMentorForm(null)} />
        </form>
      </Drawer>
    )
  }
}

function NavList({
  activeView,
  compact = false,
  onChange,
}: {
  activeView: ViewKey
  compact?: boolean
  onChange: (view: ViewKey) => void
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
            <span>{item.label}</span>
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
            <p className="brand-title">墨迹面板</p>
            <p className="brand-subtitle">云端同步已开启</p>
          </div>
        </div>
        <div>
          <p className="eyebrow">个人面板</p>
          <h1>先落座，再开卷</h1>
        </div>
        {error ? <div className="error-bar">{error}</div> : null}
        {notice ? <div className="notice-bar">{notice}</div> : null}
        <form className="editor-form" onSubmit={onSubmit}>
          <label>
            <span>邮箱</span>
            <input
              autoComplete="email"
              type="email"
              value={authEmail}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </label>
          <label>
            <span>密码</span>
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
            <span>{authMode === 'signin' ? '登录' : '创建账号'}</span>
          </button>
        </form>
        <button
          className="text-button"
          type="button"
          onClick={() => onModeChange(authMode === 'signin' ? 'signup' : 'signin')}
        >
          {authMode === 'signin' ? '第一次使用，创建账号' : '已有账号，返回登录'}
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

function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
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
  icon: Icon,
  onAction,
  title,
}: {
  actionLabel: string
  icon: LucideIcon
  onAction: () => void
  title: string
}) {
  return (
    <header className="section-header">
      <div>
        <p className="eyebrow">清单</p>
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
  actionLabel: string
  children: ReactNode
  icon: LucideIcon
  onAction: () => void
  title: string
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
  todo,
}: {
  onDelete: (todoId: string) => void
  onOpen: (todo: Todo) => void
  todo: Todo
}) {
  const StatusIcon = statusMeta[todo.status].icon
  const dueState =
    todo.due_date && todo.status !== 'done'
      ? daysUntilDate(todo.due_date) < 0
        ? '逾期'
        : daysUntilDate(todo.due_date) === 0
          ? '今日'
          : `${daysUntilDate(todo.due_date)}天后`
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
              {priorityMeta[todo.priority].label}
            </span>
          </div>
          {todo.details ? <p className="record-note">{todo.details}</p> : null}
          <div className="record-meta">
            <span>{statusMeta[todo.status].label}</span>
            {todo.due_date ? <span>{todo.due_date}</span> : null}
            {dueState ? <span>{dueState}</span> : null}
          </div>
        </div>
      </div>
      <CardActions onDelete={() => onDelete(todo.id)} onEdit={() => onOpen(todo)} />
    </article>
  )
}

function BirthdayCard({
  birthday,
  onDelete,
  onOpen,
}: {
  birthday: Birthday
  onDelete: (birthdayId: string) => void
  onOpen: (birthday: Birthday) => void
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
      <CardActions onDelete={() => onDelete(birthday.id)} onEdit={() => onOpen(birthday)} />
    </article>
  )
}

function MentorCard({
  daysLeft,
  mentor,
  nextReportDate,
  onDelete,
  onOpen,
}: {
  daysLeft: number | null
  mentor: Mentor
  nextReportDate: string | null
  onDelete: (mentorId: string) => void
  onOpen: (mentor: Mentor) => void
}) {
  const dueText =
    daysLeft === null ? '未设周期' : daysLeft < 0 ? `已过 ${Math.abs(daysLeft)} 天` : daysLeft === 0 ? '今日可汇报' : `${daysLeft}天后`

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
            {mentor.report_cycle_days ? <span>{mentor.report_cycle_days}天一汇报</span> : null}
            {nextReportDate ? <span>{nextReportDate}</span> : null}
            {mentor.notes ? <span>{mentor.notes}</span> : null}
          </div>
        </div>
      </div>
      <CardActions onDelete={() => onDelete(mentor.id)} onEdit={() => onOpen(mentor)} />
    </article>
  )
}

function CardActions({ onDelete, onEdit }: { onDelete: () => void; onEdit: () => void }) {
  return (
    <div className="card-actions">
      <button
        className="icon-button subtle"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onEdit()
        }}
        aria-label="编辑"
        title="编辑"
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
        aria-label="删除"
        title="删除"
      >
        <Trash2 size={17} />
      </button>
    </div>
  )
}

function Drawer({
  children,
  icon: Icon,
  onClose,
  title,
}: {
  children: ReactNode
  icon: LucideIcon
  onClose: () => void
  title: string
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <section className="drawer-panel" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
        <header className="drawer-header">
          <h2>
            <Icon size={22} />
            <span>{title}</span>
          </h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function FormActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="form-actions">
      <button className="secondary-button" type="button" onClick={onCancel}>
        <X size={18} />
        <span>取消</span>
      </button>
      <button className="primary-button" type="submit">
        <Save size={18} />
        <span>保存</span>
      </button>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="empty-state">
      <CalendarDays size={20} />
      <span>{label}</span>
    </div>
  )
}

export default App
