import { describe, expect, it } from 'vitest'
import type { Birthday } from '../types'
import {
  daysUntilBirthday,
  formatNextBirthday,
  getNextBirthdayDate,
  isBirthdayWithinDays,
  isValidMonthDay,
  sortBirthdaysByNext,
} from './birthday'

function birthday(name: string, month: number, day: number, birthYear: number | null = null): Birthday {
  return {
    id: name,
    name,
    month,
    day,
    birth_year: birthYear,
    relationship: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('birthday utilities', () => {
  it('sorts birthdays from nearest to farthest', () => {
    const from = new Date('2026-05-11T12:00:00+08:00')
    const sorted = sortBirthdaysByNext(
      [birthday('远方', 12, 1), birthday('明天', 5, 12), birthday('三天', 5, 14)],
      from,
    )

    expect(sorted.map((item) => item.name)).toEqual(['明天', '三天', '远方'])
  })

  it('detects birthdays inside the three day reminder window', () => {
    const from = new Date('2026-05-11T12:00:00+08:00')

    expect(isBirthdayWithinDays(birthday('今天', 5, 11), 3, from)).toBe(true)
    expect(isBirthdayWithinDays(birthday('三天', 5, 14), 3, from)).toBe(true)
    expect(isBirthdayWithinDays(birthday('四天', 5, 15), 3, from)).toBe(false)
  })

  it('handles birthdays that cross into the next year', () => {
    const from = new Date('2026-12-30T12:00:00+08:00')

    expect(daysUntilBirthday(birthday('新年', 1, 1), from)).toBe(2)
  })

  it('treats February 29 as February 28 in non-leap years', () => {
    const from = new Date('2025-02-27T12:00:00+08:00')
    const next = getNextBirthdayDate(birthday('闰日', 2, 29), from)

    expect(daysUntilBirthday(birthday('闰日', 2, 29), from)).toBe(1)
    expect(next.toISOString().slice(0, 10)).toBe('2025-02-28')
  })

  it('uses February 29 itself in leap years', () => {
    const from = new Date('2024-02-28T12:00:00+08:00')
    const next = getNextBirthdayDate(birthday('闰日', 2, 29), from)

    expect(daysUntilBirthday(birthday('闰日', 2, 29), from)).toBe(1)
    expect(next.toISOString().slice(0, 10)).toBe('2024-02-29')
  })

  it('formats countdown text and age', () => {
    const from = new Date('2026-05-11T12:00:00+08:00')

    expect(formatNextBirthday(birthday('生日', 5, 13, 2000), from)).toBe('2天后，26岁')
  })

  it('validates month and day input', () => {
    expect(isValidMonthDay(2, 29)).toBe(true)
    expect(isValidMonthDay(2, 30)).toBe(false)
    expect(isValidMonthDay(13, 1)).toBe(false)
  })
})
