import { hebrewDate } from './hebrew-date.js'

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר',
  'נובמבר', 'דצמבר']
export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

export const weekdayOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()

export function shiftMonth(y, m, by) {
  const n = y * 12 + m - 1 + by
  return [Math.floor(n / 12), n % 12 + 1]
}

export function shiftDate(day, by) {
  const t = new Date(Date.UTC(day[0], day[1] - 1, day[2] + by))
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]
}

export function dateTitle(y, m, d) {
  return 'יום ' + WEEKDAYS[weekdayOf(y, m, d)] + ' ' + hebrewDate(y, m, d).text
}

// Rows of seven cells. Flex rows run left to right, so each row is reversed: Sunday is last.
export function monthGrid(y, m, today, marked) {
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells = []
  for (let i = weekdayOf(y, m, 1); i > 0; i--) cells.push({ n: 0, kind: 'blank', heb: '', dot: false })
  for (let d = 1; d <= length; d++) {
    const isToday = today[0] === y && today[1] === m && today[2] === d
    cells.push({ n: d, kind: isToday ? 'today' : 'day', heb: hebrewDate(y, m, d).letters, dot: !!marked[d] })
  }
  while (cells.length % 7) cells.push({ n: 0, kind: 'blank', heb: '', dot: false })
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push({ cells: cells.slice(i, i + 7).reverse() })
  return rows
}

export function hebrewTitle(y, m) {
  const a = hebrewDate(y, m, 1), b = hebrewDate(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate())
  if (a.month === b.month) return a.month + ' ' + a.yearText
  const first = a.year === b.year ? a.month : a.month + ' ' + a.yearText
  return first + ' - ' + b.month + ' ' + b.yearText
}
