// Run: node tools/test-reminders.mjs
import assert from 'node:assert'
import * as core from '../src/lib/reminders-core.js'
import { monthGrid, hebrewTitle, shiftMonth, shiftDate } from '../src/lib/month.js'

function world(now) {
  const w = { now, jobs: new Map(), next: 1, alerts: [], saved: '', list: [] }
  w.env = () => ({
    now: w.now,
    schedule(r, delay) { const id = w.next++; w.jobs.set(id, { id: r.id, when: w.now + delay }); return id },
    cancel(id) { w.jobs.delete(id) },
    alert(r) { w.alerts.push(r.id) },
    save() { w.saved = JSON.stringify(w.list) }
  })
  // New JS context.
  w.restart = () => { w.list = core.parse(w.saved); core.reconcile(w.list, w.env()) }
  w.runTo = t => {
    for (;;) {
      const due = [...w.jobs].filter(j => j[1].when <= t).sort((a, b) => a[1].when - b[1].when)[0]
      if (!due) break
      w.now = due[1].when
      w.jobs.delete(due[0])
      w.restart()
      core.onJob(w.list, w.env(), due[1].id)
    }
    w.now = t
  }
  return w
}
const DAY = 86400000, NOW = new Date(2026, 10, 24, 12, 0).getTime()

let w = world(NOW)
core.upsert(w.list, w.env(), { id: 0, at: NOW + 3600000, text: 'a' })
w.restart(); w.restart()
assert.equal(w.jobs.size, 1, 'no duplicate jobs')
w.runTo(NOW + 2 * DAY)
assert.deepEqual(w.alerts, [1], 'one alert')
w.restart()
assert.deepEqual(w.alerts, [1], 'no alert after restart')

w = world(NOW)
core.upsert(w.list, w.env(), { id: 0, at: NOW + 50 * DAY, text: 'far' })
w.runTo(NOW + 49 * DAY)
assert.equal(w.alerts.length, 0, 'hops do not alert')
assert.equal(w.jobs.size, 1, 'a hop leaves one job')
w.runTo(NOW + 51 * DAY)
assert.deepEqual(w.alerts, [1], 'far reminder alerts once')

w = world(NOW)
core.upsert(w.list, w.env(), { id: 0, at: NOW + 3600000, text: 'a' })
core.upsert(w.list, w.env(), { id: 0, at: NOW + 7200000, text: 'b' })
w.jobs.clear(); w.next = 1 // reboot, ids reused
w.now = NOW + 5000000
w.restart()
assert.equal(w.jobs.size, 1, 'missing job renewed')
assert.equal(w.alerts.length, 0)
assert.equal(w.list.filter(r => core.isMissed(r, w.now)).length, 1, 'shown as missed')
w.runTo(NOW + 7300000)
assert.ok(w.alerts.includes(2))

w = world(NOW)
core.upsert(w.list, w.env(), { id: 0, at: NOW + 3600000, text: 'a' })
core.upsert(w.list, w.env(), { id: 1, at: NOW + 1800000, text: 'b' })
assert.equal(w.list.length, 1)
assert.equal(w.jobs.size, 1)
core.remove(w.list, w.env(), 1)
assert.equal(w.jobs.size, 0)

// A late job still alerts.
w = world(NOW)
core.upsert(w.list, w.env(), { id: 0, at: NOW + 3600000, text: 'a' })
w.now = NOW + 7200000
w.restart()
core.onJob(w.list, w.env(), 1)
assert.deepEqual(w.alerts, [1])
assert.deepEqual(core.parse('garbage'), [])
assert.deepEqual(core.parse(undefined), [])

for (let i = 0; i < 600; i++) {
  const [y, m] = shiftMonth(2026, 1, i)
  const cells = monthGrid(y, m, [2026, 11, 24], { 3: true }).flatMap(r => {
    assert.equal(r.cells.length, 7)
    return r.cells.slice().reverse()
  })
  const days = cells.filter(c => c.n)
  assert.equal(days.length, new Date(y, m, 0).getDate())
  assert.equal(cells.indexOf(days[0]), new Date(y, m - 1, 1).getDay())
  assert.ok(days[2].dot && !days[3].dot)
  assert.equal(cells.filter(c => c.kind === 'today').length, y === 2026 && m === 11 ? 1 : 0)
  assert.ok(hebrewTitle(y, m))
}
assert.deepEqual(shiftMonth(2026, 1, -1), [2025, 12])
assert.deepEqual(shiftDate([2026, 12, 31], 1), [2027, 1, 1])
console.log('ok')
