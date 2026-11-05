// Full reference calculation, ported line by line from KosherKotlin 3.0 (LGPL-2.1):
// util/SolarPosition.kt, util/SpaCalculator.kt, util/Atmosphere.kt, util/HorizonRefraction.kt,
// util/ItimLabinaCalculator.kt, and the ITIM_LABINA day plan of app/domain/ZmanimRepository.kt.
// Too heavy for the watch. It is used to generate the city table and to verify src/lib/zmanim.js.
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('./kk-data.json', import.meta.url)))
const T = data.spa
const RAD = Math.PI / 180
const DEG = 180 / Math.PI
const norm360 = d => ((d % 360) + 360) % 360
const norm180 = d => norm360(d + 180) - 180

function series(tau, tables) {
  let sum = 0, power = 1
  for (const table of tables) {
    let term = 0
    for (const r of table) term += r[0] * Math.cos(r[1] + r[2] * tau)
    sum += term * power
    power *= tau
  }
  return sum / 1e8
}

export function sun(jd) {
  const t = (jd - 2451544.5) / 365.25
  const jde = jd + (62.92 + 0.32217 * t + 0.005589 * t * t) / 86400
  const jc = (jd - 2451545) / 36525
  const jce = (jde - 2451545) / 36525
  const jme = jce / 10
  const l = series(jme, [T.L0, T.L1, T.L2, T.L3, T.L4, T.L5]) * DEG
  const b = series(jme, [T.B0, T.B1]) * DEG
  const r = series(jme, [T.R0, T.R1, T.R2, T.R3, T.R4])
  const theta = norm360(l + 180)
  const beta = -b
  const x = [
    297.85036 + 445267.11148 * jce - 0.0019142 * jce * jce + jce * jce * jce / 189474,
    357.52772 + 35999.05034 * jce - 0.0001603 * jce * jce - jce * jce * jce / 300000,
    134.96298 + 477198.867398 * jce + 0.0086972 * jce * jce + jce * jce * jce / 56250,
    93.27191 + 483202.017538 * jce - 0.0036825 * jce * jce + jce * jce * jce / 327270,
    125.04452 - 1934.136261 * jce + 0.0020708 * jce * jce + jce * jce * jce / 450000,
  ]
  let dPsi = 0, dEps = 0
  for (let i = 0; i < T.NUTATION_Y.length; i++) {
    const y = T.NUTATION_Y[i], abcd = T.NUTATION_ABCD[i]
    const arg = (y[0] * x[0] + y[1] * x[1] + y[2] * x[2] + y[3] * x[3] + y[4] * x[4]) * RAD
    dPsi += (abcd[0] + abcd[1] * jce) * Math.sin(arg)
    dEps += (abcd[2] + abcd[3] * jce) * Math.cos(arg)
  }
  dPsi /= 36000000
  dEps /= 36000000
  const u = jme / 10
  const eps0 = 84381.448 + u * (-4680.93 + u * (-1.55 + u * (1999.25 + u * (-51.38 + u * (-249.67 +
    u * (-39.05 + u * (7.12 + u * (27.87 + u * (5.79 + u * 2.45)))))))))
  const eps = eps0 / 3600 + dEps
  const lambda = theta + dPsi - 20.4898 / (3600 * r)
  const nu0 = norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * jc * jc - jc * jc * jc / 38710000)
  const nu = nu0 + dPsi * Math.cos(eps * RAD)
  const alpha = norm360(Math.atan2(Math.sin(lambda * RAD) * Math.cos(eps * RAD) - Math.tan(beta * RAD) * Math.sin(eps * RAD), Math.cos(lambda * RAD)) * DEG)
  const delta = Math.asin(Math.sin(beta * RAD) * Math.cos(eps * RAD) + Math.cos(beta * RAD) * Math.sin(eps * RAD) * Math.sin(lambda * RAD)) * DEG
  return { alpha, delta, nu, r, semidiameter: 959.63 / 3600 / r }
}

const hourAngle = (s, lon) => norm180(s.nu + lon - s.alpha)
const altitude = (s, lat, lon) => {
  const p = lat * RAD, d = s.delta * RAD
  return Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(hourAngle(s, lon) * RAD)) * DEG
}

export const dayNumber = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + 2440587.5

function hourAngleCrossing(guess, target, lon) {
  let jd = guess
  for (let i = 0; i < 4; i++) jd -= (((hourAngle(sun(jd), lon) - target) % 360 + 540) % 360 - 180) / 360
  return jd
}

class SolarDay {
  constructor(jd0, lon) {
    this.lon = lon
    this.noon = hourAngleCrossing(jd0 + 0.5 - lon / 360, 0, lon)
  }
  get before() { return (this._b ??= hourAngleCrossing(this.noon - 0.5, 180, this.lon)) }
  get after() { return (this._a ??= hourAngleCrossing(this.noon + 0.5, 180, this.lon)) }
  crossing(lat, alt, rising) {
    const f = jd => altitude(sun(jd), lat, this.lon) - alt
    let low = rising ? this.before : this.noon
    let high = rising ? this.noon : this.after
    const increasing = f(low) < 0
    for (let i = 0; i < 26; i++) {
      const mid = (low + high) / 2
      if ((f(mid) < 0) === increasing) low = mid; else high = mid
    }
    return (low + high) / 2
  }
}

// Atmosphere.kt
const HYDROSTATIC = 34.16, TOP_M = 70000, EARTH = 6371000, REFRACTIVITY = (77.46 + 0.459 / 0.36) * 1e-6
function at(layers, heightM) {
  const km = heightM / 1000
  let i = 0
  for (let k = 0; k < layers.length; k++) if (layers[k][0] <= km) i = k
  const [bottom, temp, pressure, lapse, exponent] = layers[i]
  const t = temp + lapse * (km - bottom)
  const p = lapse !== 0 ? pressure * Math.pow(t / temp, exponent) : pressure * Math.exp(-(km - bottom) * HYDROSTATIC / temp)
  return [t, p]
}
const index = (layers, h) => { const [t, p] = at(layers, h); return 1 + REFRACTIVITY * p / t }
const traceCache = new Map()
export function traceRefraction(model, observerM) {
  const h0 = Math.floor(observerM / 100) * 100
  const key = model + h0
  if (traceCache.has(key)) return traceCache.get(key)
  const layers = data.atmosphere[model]
  const du = 0.02, count = Math.trunc(Math.sqrt(TOP_M - h0) / du)
  const n0 = index(layers, h0), r0 = EARTH + h0
  let sum = 0, previous = NaN
  for (let k = 0; k < count; k++) {
    const u = (k + 0.5) * du, h = h0 + u * u, n = index(layers, h)
    const dndh = index(layers, h + 0.5) - index(layers, h - 0.5)
    const s = n0 * r0 / (n * (EARTH + h))
    const tanZ = s / Math.sqrt(Math.max(1 - s * s, 1e-30))
    const integrand = -dndh / n * tanZ * 2 * u
    if (!Number.isNaN(previous)) sum += (previous + integrand) / 2 * du
    previous = integrand
  }
  const result = sum * DEG
  traceCache.set(key, result)
  return result
}

// HorizonRefraction.kt, Israel branch with the default STANDARD climate (15 C at sea level).
export function refraction(elevation, winter, morning) {
  const model = winter ? 'MENAT_WINTER' : 'MENAT_SUMMER'
  const observed = 15 + 273.15 + 0.00367 * (0 - elevation)
  const scale = morning ? 0.98878 : 0.99227
  return scale * traceRefraction(model, elevation) * at(data.atmosphere[model], Math.floor(elevation / 100) * 100)[0] / observed
}

const isWinterMonth = m0 => m0 >= 10 || m0 <= 3
const MIDNIGHT_LAG = [0.1963, 0.0318, 0.0009, 0.018, -0.0073]

const ms = jd => (jd - 2440587.5) * 86400000

// One civil day, sea level (useElevation = false), as the ITIM_LABINA plan prints it.
export function referenceDay(city, y, m, d) {
  const { lat, lon, elev } = city
  const jd0 = dayNumber(y, m, d)
  const day = new SolarDay(jd0, lon)
  const winter = isWinterMonth(m - 1)
  const sd = sun(day.noon).semidiameter
  const horizon = morning => 90 + sd + refraction(elev, winter, morning)
  const up = z => ms(day.crossing(lat, 90 - z, true))
  const down = z => ms(day.crossing(lat, 90 - z, false))

  const netz = up(horizon(true))
  const shkia = down(horizon(false))
  const shaahGRA = Math.trunc((shkia - netz) / 12)
  const alos72 = netz - 72 * 60000
  const tzais72 = shkia + 72 * 60000
  const shaahMGA = Math.trunc((tzais72 - alos72) / 12)

  const tomorrow = new SolarDay(jd0 + 1, lon)
  const lead = (tomorrow.noon - day.after) * 86400 - 43200
  const doy = Math.round(jd0 + 1 - dayNumber(new Date((jd0 + 1 - 2440587.5) * 86400000).getUTCFullYear(), 1, 1))
  const w = 2 * Math.PI * doy / 365.25
  const lagged = lead + MIDNIGHT_LAG[0] + MIDNIGHT_LAG[1] * Math.cos(w) + MIDNIGHT_LAG[2] * Math.sin(w) +
    MIDNIGHT_LAG[3] * Math.cos(2 * w) + MIDNIGHT_LAG[4] * Math.sin(2 * w)
  const seconds = lagged > 0 ? Math.ceil(lagged) : Math.floor(lagged)

  return {
    alot90: up(horizon(true) + 18.9712),
    alot72: up(horizon(true) + 15.2193),
    misheyakir: up(101.5),
    netz,
    shmaMGA: alos72 + 3 * shaahMGA,
    shmaGRA: netz + 3 * shaahGRA,
    tfilaMGA: alos72 + 4 * shaahMGA,
    tfilaGRA: netz + 4 * shaahGRA,
    chatzot: ms(day.noon),
    minchaG: netz + 6.5 * shaahGRA,
    minchaK: netz + 9.5 * shaahGRA,
    plag: netz + 10.75 * shaahGRA,
    candles: shkia - city.candles * 60000,
    shkia,
    tzeit: down(horizon(false) + 3.8217),
    tzeitShabbat: down(98.5),
    tzeitChazonIsh: down(99.29),
    tzeitRT: down(horizon(false) + 15.2193),
    chatzotL: ms(tomorrow.noon - 0.5 - seconds / 86400),
  }
}
