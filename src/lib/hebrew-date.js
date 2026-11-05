// Civil date to Hebrew date, with the fixed-day arithmetic of Calendrical Calculations.

const HEBREW_EPOCH = -1373427
const UNIX_DAY_ZERO = 719163

function elapsedDays(year) {
  const months = Math.floor((235 * year - 234) / 19)
  const parts = 12084 + 13753 * months
  const day = 29 * months + Math.floor(parts / 25920)
  return (3 * (day + 1)) % 7 < 3 ? day + 1 : day
}

function newYear(year) {
  const previous = elapsedDays(year - 1), current = elapsedDays(year), next = elapsedDays(year + 1)
  const correction = next - current === 356 ? 2 : current - previous === 382 ? 1 : 0
  return HEBREW_EPOCH + current + correction
}

const isLeap = year => (7 * year + 1) % 19 < 7

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק']

function gematria(n) {
  const rest = n % 100
  const letters = HUNDREDS[Math.floor(n / 100)] + (rest === 15 ? 'טו' : rest === 16 ? 'טז' :
    TENS[Math.floor(rest / 10)] + ONES[rest % 10])
  return letters.length === 1 ? letters + "'" : letters.slice(0, -1) + '"' + letters.slice(-1)
}

export function hebrewDate(y, m, d) {
  const fixed = Date.UTC(y, m - 1, d) / 86400000 + UNIX_DAY_ZERO
  let year = y + 3760
  while (newYear(year + 1) <= fixed) year++
  while (newYear(year) > fixed) year--
  const length = newYear(year + 1) - newYear(year)
  const leap = isLeap(year)
  const months = [
    ['תשרי', 30],
    ['חשון', length % 10 === 5 ? 30 : 29],
    ['כסלו', length % 10 === 3 ? 29 : 30],
    ['טבת', 29],
    ['שבט', 30],
  ]
  if (leap) months.push(['אדר א', 30], ['אדר ב', 29])
  else months.push(['אדר', 29])
  months.push(['ניסן', 30], ['אייר', 29], ['סיון', 30], ['תמוז', 29], ['אב', 30], ['אלול', 29])

  let day = fixed - newYear(year)
  let i = 0
  while (day >= months[i][1]) { day -= months[i][1]; i++ }
  return { day: day + 1, month: months[i][0], year, text: gematria(day + 1) + ' ' + months[i][0] + ' ' + gematria(year % 1000) }
}
