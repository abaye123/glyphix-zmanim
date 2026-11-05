// Measures the watch engine against the full reference, and the date helpers against Intl.
import { readFileSync } from 'node:fs'
import { referenceDay, traceRefraction } from './reference.mjs'
import { zmanimFor, israelOffsetMinutes, clock, ROWS } from '../src/lib/zmanim.js'
import { hebrewDate } from '../src/lib/hebrew-date.js'
import { CITIES } from '../src/lib/cities.js'

// 1. Known values from KosherKotlin's own test (ItimLabinaCalculatorTest).
const sea = traceRefraction('MENAT_WINTER', 0)
const km = traceRefraction('MENAT_WINTER', 1000) / sea
console.log(`refraction test: sea level ${sea.toFixed(4)} (want 0.5694 +-0.0005), 1000m ratio ${km.toFixed(4)} (want 0.905..0.913)`)

// 2. Engine against reference.
const elevations = readFileSync(new URL('./cities.csv', import.meta.url), 'utf8').trim().split(/\r?\n/).map(l => Number(l.split(',')[3]))
const worst = {}
let days = 0, minuteDiffs = 0, rows = 0
const local = ms => { const t = new Date(ms); return t }
CITIES.forEach((c, i) => {
  const city = { lat: c.lat, lon: c.lon, elev: elevations[i], candles: c.candles }
  const step = i === 0 ? 1 : 11
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2036, 0, 1); t += step * 86400000) {
    const u = new Date(t), y = u.getUTCFullYear(), m = u.getUTCMonth() + 1, d = u.getUTCDate()
    const a = zmanimFor(c, y, m, d), b = referenceDay(city, y, m, d)
    days++
    for (const [key] of ROWS) {
      const diff = Math.abs(a[key] - b[key]) / 1000
      if (!(key in worst) || diff > worst[key].diff) worst[key] = { diff, city: c.name, date: `${y}-${m}-${d}` }
      rows++
      if (clock(a[key]) !== clock(b[key])) minuteDiffs++
    }
  }
})
console.log(`engine vs reference: ${days} city-days, ${rows} times`)
for (const [key, w] of Object.entries(worst)) console.log(`  ${key.padEnd(11)} worst ${w.diff.toFixed(1).padStart(5)}s`)
console.log(`  displayed minute differs in ${minuteDiffs} of ${rows} (${(100 * minuteDiffs / rows).toFixed(2)}%)`)

// 3. Israel clock rule against the time zone database.
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', timeZoneName: 'longOffset' })
let tzErrors = 0, tzChecks = 0
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2036, 0, 1); t += 3600000) {
  const name = fmt.formatToParts(t).find(p => p.type === 'timeZoneName').value
  const want = name.includes('+03') ? 180 : 120
  tzChecks++
  if (israelOffsetMinutes(t) !== want) { if (!tzErrors) console.log('  first tz error', new Date(t).toISOString(), name); tzErrors++ }
}
console.log(`israel offset: ${tzErrors} errors in ${tzChecks} hours`)

// 4. Hebrew date against ICU.
const heb = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
const normal = { Tishri: 'תשרי', Heshvan: 'חשון', Kislev: 'כסלו', Tevet: 'טבת', Shevat: 'שבט', 'Adar I': 'אדר א', 'Adar II': 'אדר ב', Adar: 'אדר', Nisan: 'ניסן', Iyar: 'אייר', Sivan: 'סיון', Tamuz: 'תמוז', Av: 'אב', Elul: 'אלול' }
let dateErrors = 0, dateChecks = 0
for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2060, 0, 1); t += 86400000) {
  const u = new Date(t)
  const p = Object.fromEntries(heb.formatToParts(t).map(x => [x.type, x.value]))
  const h = hebrewDate(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate())
  dateChecks++
  if (h.day !== Number(p.day) || h.month !== normal[p.month] || h.year !== Number(p.year)) {
    if (!dateErrors) console.log('  first date error', u.toISOString(), h, p)
    dateErrors++
  }
}
console.log(`hebrew date: ${dateErrors} errors in ${dateChecks} days`)

// 5. A readable sample.
const c = CITIES[0]
console.log(hebrewDate(2026, 11, 5).text, hebrewDate(2027, 3, 15).text, hebrewDate(2026, 11, 26).text, hebrewDate(2027, 2, 1).text)
const z = zmanimFor(c, 2026, 11, 5), r = referenceDay({ lat: c.lat, lon: c.lon, elev: 800, candles: c.candles }, 2026, 11, 5)
for (const [k, label] of ROWS) console.log(`  ${clock(z[k])}  ${clock(r[k])}  ${k}`)
