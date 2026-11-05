// Zmanim for Eretz Yisrael, following the Itim Labina definitions of KosherKotlin 3.0 (LGPL-2.1):
// the horizon of ItimLabinaCalculator and the ITIM_LABINA day plan of its app.
// The sun comes from a compact series, so this file stays small enough for the watch.
// tools/verify.mjs measures it against tools/reference.mjs, the full port.

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

function julianDay(y, m, d) {
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) -
    Math.floor(yy / 100) + Math.floor(yy / 400) - 32045 - 0.5
}

function sun(jd) {
  const t = (jd + 70 / 86400 - 2451545) / 36525
  const m = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * RAD
  const e = 0.016708634 - 0.000042037 * t
  const c = (1.914602 - 0.004817 * t) * Math.sin(m) + (0.019993 - 0.000101 * t) * Math.sin(2 * m) +
    0.000289 * Math.sin(3 * m)
  const omega = (125.04 - 1934.136 * t) * RAD
  const nutation = -0.00478 * Math.sin(omega)
  const lambda = (280.46646 + 36000.76983 * t + 0.0003032 * t * t + c - 0.00569 + nutation) * RAD
  const eps = (23.4392911 - 0.0130042 * t + 0.00256 * Math.cos(omega)) * RAD
  const v = m + c * RAD
  const sidereal = 280.46061837 + 360.98564736629 * (jd - 2451545) + nutation * Math.cos(eps)
  return {
    alpha: Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * DEG,
    delta: Math.asin(Math.sin(eps) * Math.sin(lambda)),
    sidereal,
    r: 1.000001018 * (1 - e * e) / (1 + e * Math.cos(v)),
  }
}

// Hour angle in degrees, in (-180, 180].
function hourAngle(s, lon) {
  const h = (s.sidereal + lon - s.alpha) % 360
  const n = h < 0 ? h + 360 : h
  return n > 180 ? n - 360 : n
}

function transit(jd0, lon) {
  let jd = jd0 + 0.5 - lon / 360
  for (let i = 0; i < 3; i++) jd -= hourAngle(sun(jd), lon) / 360
  return jd
}

// Moment the sun reaches the zenith distance z, before (rising) or after solar noon.
function crossing(noon, lat, lon, z, rising) {
  const phi = lat * RAD
  const cosZ = Math.cos(z * RAD)
  let jd = noon + (rising ? -0.25 : 0.25)
  for (let i = 0; i < 4; i++) {
    const s = sun(jd)
    const cosH = (cosZ - Math.sin(phi) * Math.sin(s.delta)) / (Math.cos(phi) * Math.cos(s.delta))
    const target = Math.acos(cosH) * DEG * (rising ? -1 : 1)
    jd -= (hourAngle(s, lon) - target) / 360
  }
  return jd
}

const toMs = jd => (jd - 2440587.5) * 86400000

// Refraction models are by month: November to April is winter.
const isWinter = m => m >= 11 || m <= 4

// Times are returned as epoch milliseconds. city = { lat, lon, candles, ref: [winter am, winter pm, summer am, summer pm] }.
export function zmanimFor(city, y, m, d) {
  const jd0 = julianDay(y, m, d)
  const lat = city.lat, lon = city.lon
  const noon = transit(jd0, lon)
  const tomorrow = transit(jd0 + 1, lon)
  const semidiameter = 959.63 / 3600 / sun(noon).r
  const base = isWinter(m) ? 0 : 2
  const horizonAm = 90 + semidiameter + city.ref[base]
  const horizonPm = 90 + semidiameter + city.ref[base + 1]
  const up = z => toMs(crossing(noon, lat, lon, z, true))
  const down = z => toMs(crossing(noon, lat, lon, z, false))

  const netz = up(horizonAm)
  const shkia = down(horizonPm)
  const shaahGRA = (shkia - netz) / 12
  const alos72 = netz - 4320000
  const shaahMGA = (shkia + 4320000 - alos72) / 12

  return {
    alot90: up(horizonAm + 18.9712),
    alot72: up(horizonAm + 15.2193),
    misheyakir: up(101.5),
    netz,
    shmaMGA: alos72 + 3 * shaahMGA,
    shmaGRA: netz + 3 * shaahGRA,
    tfilaMGA: alos72 + 4 * shaahMGA,
    tfilaGRA: netz + 4 * shaahGRA,
    chatzot: toMs(noon),
    minchaG: netz + 6.5 * shaahGRA,
    minchaK: netz + 9.5 * shaahGRA,
    plag: netz + 10.75 * shaahGRA,
    candles: shkia - city.candles * 60000,
    shkia,
    tzeit: down(horizonPm + 3.8217),
    tzeitShabbat: down(98.5),
    tzeitChazonIsh: down(99.29),
    tzeitRT: down(horizonPm + 15.2193),
    chatzotL: toMs((noon + tomorrow) / 2),
  }
}

// Israel: from the Friday before the last Sunday of March, 02:00, to the last Sunday of October, 02:00.
function lastSunday(y, m) {
  const last = new Date(Date.UTC(y, m, 0))
  return last.getUTCDate() - last.getUTCDay()
}

export function israelOffsetMinutes(ms) {
  const y = new Date(ms + 7200000).getUTCFullYear()
  const start = Date.UTC(y, 2, lastSunday(y, 3) - 2, 0)
  const end = Date.UTC(y, 9, lastSunday(y, 10), -1)
  return ms >= start && ms < end ? 180 : 120
}

// Minutes after local midnight. Seconds are dropped, as in the KosherKotlin app.
export function localMinutes(ms) {
  const local = Math.floor((ms + israelOffsetMinutes(ms) * 60000) / 60000)
  return ((local % 1440) + 1440) % 1440
}

export function clock(ms) {
  const t = localMinutes(ms)
  const h = Math.floor(t / 60), m = t % 60
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m
}

// Key and name of each row, in the order of the KosherKotlin ITIM_LABINA plan.
// A third value limits the row to one weekday (5 = Friday, 6 = Shabbat).
// Candle lighting is sunset minus the minutes of the city. Tzeit Shabbat is its `tzais`, 8.5 degrees,
// the time its isAssurBemelacha uses. Tzeit Chazon Ish is not in KosherKotlin: 9.29 degrees below the geometric horizon.
export const ROWS = [
  ['alot90', 'עלות השחר 90'],
  ['alot72', 'עלות השחר 72'],
  ['misheyakir', 'משיכיר'],
  ['netz', 'הנץ החמה'],
  ['shmaMGA', 'סוף ק"ש מג"א'],
  ['shmaGRA', 'סוף ק"ש גר"א'],
  ['tfilaMGA', 'סוף תפילה מג"א'],
  ['tfilaGRA', 'סוף תפילה גר"א'],
  ['chatzot', 'חצות היום'],
  ['minchaG', 'מנחה גדולה'],
  ['minchaK', 'מנחה קטנה'],
  ['plag', 'פלג המנחה'],
  ['candles', 'הדלקת נרות', 5],
  ['shkia', 'שקיעה'],
  ['tzeit', 'צאת הכוכבים'],
  ['tzeitShabbat', 'צאת השבת', 6],
  ['tzeitChazonIsh', 'צאת שבת חזו"א', 6],
  ['tzeitRT', 'רבנו תם'],
  ['chatzotL', 'חצות הלילה'],
]
