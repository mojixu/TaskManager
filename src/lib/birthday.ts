import type { Birthday } from '../types'

export const APP_TIME_ZONE = 'Asia/Shanghai'

export function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

export function isValidMonthDay(month: number, day: number) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1) return false

  const monthDays = [31, isLeapYear(2024) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= monthDays[month - 1]
}

export function startOfDateInTimeZone(input: Date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(input)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)

  return new Date(Date.UTC(year, month - 1, day))
}

export function birthdayOccurrenceDate(year: number, month: number, day: number) {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return new Date(Date.UTC(year, 1, 28))
  }

  return new Date(Date.UTC(year, month - 1, day))
}

export function getNextBirthdayDate(
  birthday: Pick<Birthday, 'month' | 'day'>,
  from = new Date(),
  timeZone = APP_TIME_ZONE,
) {
  const today = startOfDateInTimeZone(from, timeZone)
  let next = birthdayOccurrenceDate(today.getUTCFullYear(), birthday.month, birthday.day)

  if (next < today) {
    next = birthdayOccurrenceDate(today.getUTCFullYear() + 1, birthday.month, birthday.day)
  }

  return next
}

export function daysUntilBirthday(
  birthday: Pick<Birthday, 'month' | 'day'>,
  from = new Date(),
  timeZone = APP_TIME_ZONE,
) {
  const today = startOfDateInTimeZone(from, timeZone)
  const next = getNextBirthdayDate(birthday, from, timeZone)
  const dayMs = 24 * 60 * 60 * 1000

  return Math.round((next.getTime() - today.getTime()) / dayMs)
}

export function isBirthdayWithinDays(
  birthday: Pick<Birthday, 'month' | 'day'>,
  days: number,
  from = new Date(),
  timeZone = APP_TIME_ZONE,
) {
  const remainingDays = daysUntilBirthday(birthday, from, timeZone)
  return remainingDays >= 0 && remainingDays <= days
}

export function sortBirthdaysByNext<T extends Pick<Birthday, 'month' | 'day' | 'name'>>(
  birthdays: T[],
  from = new Date(),
  timeZone = APP_TIME_ZONE,
) {
  return [...birthdays].sort((a, b) => {
    const diff = daysUntilBirthday(a, from, timeZone) - daysUntilBirthday(b, from, timeZone)
    return diff === 0 ? a.name.localeCompare(b.name, 'zh-CN') : diff
  })
}

export function formatBirthdayDate(month: number, day: number) {
  return `${month}月${day}日`
}

export function formatNextBirthday(
  birthday: Pick<Birthday, 'month' | 'day' | 'birth_year'>,
  from = new Date(),
  timeZone = APP_TIME_ZONE,
) {
  const days = daysUntilBirthday(birthday, from, timeZone)
  const next = getNextBirthdayDate(birthday, from, timeZone)
  const age = birthday.birth_year ? next.getUTCFullYear() - birthday.birth_year : null

  if (days === 0) return age ? `今天，${age}岁` : '今天'
  if (days === 1) return age ? `明天，${age}岁` : '明天'
  return age ? `${days}天后，${age}岁` : `${days}天后`
}
