import { createClient } from '@supabase/supabase-js'
import nodemailer from 'npm:nodemailer@6.9.16'

type BirthdayRow = {
  id: string
  user_id: string
  name: string
  month: number
  day: number
  birth_year: number | null
  relationship: string | null
  notes: string | null
}

const TIME_ZONE = 'Asia/Shanghai'
const REMINDER_WINDOW_DAYS = 3

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function shanghaiToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)

  return new Date(Date.UTC(year, month - 1, day))
}

function birthdayDate(year: number, month: number, day: number) {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return new Date(Date.UTC(year, 1, 28))
  }

  return new Date(Date.UTC(year, month - 1, day))
}

function daysUntil(row: BirthdayRow, today: Date) {
  let next = birthdayDate(today.getUTCFullYear(), row.month, row.day)

  if (next < today) {
    next = birthdayDate(today.getUTCFullYear() + 1, row.month, row.day)
  }

  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildEmailHtml(rows: BirthdayRow[], today: Date) {
  const items = rows
    .map((row) => {
      const days = daysUntil(row, today)
      const birthday = `${row.month}月${row.day}日`
      const relation = row.relationship ? ` · ${row.relationship}` : ''
      const note = row.notes ? `<p style="margin:6px 0 0;color:#6b5c50;">${escapeHtml(row.notes)}</p>` : ''

      return `
        <li style="margin:0 0 14px;padding:12px;border:1px solid #eadccb;border-radius:8px;background:#fffaf2;">
          <strong style="color:#7d1f1f;">${escapeHtml(row.name)}</strong>
          <span style="color:#6b5c50;">${birthday}${relation} · ${days === 0 ? '今天' : `${days}天后`}</span>
          ${note}
        </li>
      `
    })
    .join('')

  return `
    <div style="font-family:Arial,'Microsoft YaHei',sans-serif;line-height:1.6;color:#2a211c;background:#f7f1e4;padding:24px;">
      <h1 style="margin:0 0 12px;color:#7d1f1f;font-size:22px;">未来三天生日提醒</h1>
      <p style="margin:0 0 18px;color:#6b5c50;">检查日期：${isoDate(today)}，时区：${TIME_ZONE}</p>
      <ul style="list-style:none;margin:0;padding:0;">${items}</ul>
    </div>
  `
}

function buildEmailText(rows: BirthdayRow[], today: Date) {
  const lines = rows.map((row) => {
    const days = daysUntil(row, today)
    return `- ${row.name}: ${row.month}月${row.day}日，${days === 0 ? '今天' : `${days}天后`}${
      row.relationship ? `，${row.relationship}` : ''
    }${row.notes ? `，备注：${row.notes}` : ''}`
  })

  return [`未来三天生日提醒`, `检查日期：${isoDate(today)} (${TIME_ZONE})`, '', ...lines].join('\n')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const cronSecret = requiredEnv('CRON_SECRET')
    const authorization = req.headers.get('authorization')

    if (authorization !== `Bearer ${cronSecret}`) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const smtpUser = requiredEnv('QQ_SMTP_USER')
    const smtpAuthCode = requiredEnv('QQ_SMTP_AUTH_CODE')
    const reminderTo = requiredEnv('REMINDER_TO')

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await admin
      .from('birthdays')
      .select('id,user_id,name,month,day,birth_year,relationship,notes')

    if (error) throw error

    const today = shanghaiToday()
    const dueRows = (data ?? [])
      .filter((row) => {
        const days = daysUntil(row as BirthdayRow, today)
        return days >= 0 && days <= REMINDER_WINDOW_DAYS
      })
      .sort((a, b) => daysUntil(a as BirthdayRow, today) - daysUntil(b as BirthdayRow, today)) as BirthdayRow[]

    if (dueRows.length === 0) {
      return json({ sent: 0, message: 'No birthdays in reminder window' })
    }

    const byUser = new Map<string, BirthdayRow[]>()
    for (const row of dueRows) {
      const rows = byUser.get(row.user_id) ?? []
      rows.push(row)
      byUser.set(row.user_id, rows)
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.qq.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpAuthCode,
      },
    })

    let sent = 0
    const fingerprint = `${isoDate(today)}:birthday:${REMINDER_WINDOW_DAYS}`

    for (const [userId, rows] of byUser) {
      const { data: existing, error: logReadError } = await admin
        .from('reminder_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('kind', 'birthday')
        .eq('fingerprint', fingerprint)
        .maybeSingle()

      if (logReadError) throw logReadError
      if (existing) continue

      await transporter.sendMail({
        from: `"墨迹任务面板" <${smtpUser}>`,
        to: reminderTo,
        subject: `未来三天生日提醒 · ${rows.length} 人`,
        text: buildEmailText(rows, today),
        html: buildEmailHtml(rows, today),
      })

      const { error: logWriteError } = await admin.from('reminder_logs').insert({
        user_id: userId,
        kind: 'birthday',
        fingerprint,
        details: {
          count: rows.length,
          names: rows.map((row) => row.name),
          reminder_to: reminderTo,
        },
      })

      if (logWriteError) throw logWriteError
      sent += 1
    }

    return json({ sent, users_checked: byUser.size, birthdays_due: dueRows.length })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
