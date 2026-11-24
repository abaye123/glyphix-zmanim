// Reminder rules with no system calls, so they can be tested in node.
// A reminder is { id, at, text, job, fired, seen }. `at` is a local timestamp in ms.

export const MIN_DELAY = 61000
// A relative timeout may be held in 32 bits, so long waits are split into hops.
export const MAX_DELAY = 20 * 86400000
// A job may arrive slightly early; anything this close counts as due.
export const EARLY = 30000
// A due reminder this recent is still alerted when the app merely opens.
export const LATE = 5 * 60000
export const MAX_REMINDERS = 50
const KEEP_OLD = 30 * 86400000

export function parse(text) {
  let data = null
  try {
    data = JSON.parse(text)
  } catch (e) {
    return []
  }
  if (!Array.isArray(data)) return []
  return data.filter(r => r && r.id > 0 && r.at > 0).map(r => ({
    id: r.id,
    at: r.at,
    text: String(r.text || ''),
    job: typeof r.job === 'number' ? r.job : -1,
    fired: r.fired === true,
    seen: r.seen === true
  }))
}

export const delayFor = (at, now) => Math.min(MAX_DELAY, Math.max(MIN_DELAY, at - now))

export const isDue = (r, now) => !r.fired && !r.seen && r.at <= now + EARLY

export const isPending = (r, now) => !r.fired && !r.seen && r.at > now + EARLY

// Past and never alerted, for example because the watch was off.
export const isMissed = (r, now) => isDue(r, now) && r.at <= now

// env: { now, schedule(reminder, delay) -> job id or -1, cancel(job), alert(reminder), save() }.
// Saving before alerting means a crash can not cause a second alert.
export function fireDue(list, env, maxLate) {
  const due = list.filter(r => isDue(r, env.now) && env.now - r.at <= maxLate)
  if (!due.length) return 0
  due.forEach(r => { r.fired = true; r.job = -1 })
  env.save()
  due.forEach(r => env.alert(r))
  return due.length
}

function arm(r, env) {
  r.job = env.schedule(r, delayFor(r.at, env.now))
  return r.job >= 0
}

export function schedulePending(list, env) {
  // All cancels come first: after a reboot the system may hand out old ids again.
  const pending = list.filter(r => isPending(r, env.now))
  pending.forEach(r => { if (r.job >= 0) env.cancel(r.job) })
  let failed = 0
  pending.forEach(r => { if (!arm(r, env)) failed++ })
  env.save()
  return failed
}

// Once per JS context. Jobs can not be listed and may be lost in a reboot, so all are renewed.
// Due ones keep their job: its callback may be about to run, and it alerts however late it is.
export function reconcile(list, env) {
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i]
    if ((r.fired || r.seen) && env.now - r.at > KEEP_OLD) list.splice(i, 1)
  }
  fireDue(list, env, LATE)
  return schedulePending(list, env)
}

// A job ran. It may be a hop, or early after a clock change, and then it is renewed.
export function onJob(list, env, id) {
  const r = list.find(x => x.id === id)
  if (r && isPending(r, env.now)) {
    // The startup reconcile of this context may have armed it again already.
    if (r.job >= 0) env.cancel(r.job)
    arm(r, env)
    env.save()
  }
  return fireDue(list, env, Infinity)
}

export function upsert(list, env, draft) {
  let r = list.find(x => x.id === draft.id)
  if (r) {
    if (r.job >= 0) env.cancel(r.job)
  } else {
    r = { id: list.reduce((m, x) => Math.max(m, x.id), 0) + 1 }
    list.push(r)
  }
  r.at = draft.at
  r.text = draft.text
  r.fired = false
  r.seen = false
  const ok = arm(r, env)
  env.save()
  return ok
}

export function remove(list, env, id) {
  const i = list.findIndex(x => x.id === id)
  if (i < 0) return
  if (list[i].job >= 0 && isPending(list[i], env.now)) env.cancel(list[i].job)
  list.splice(i, 1)
  env.save()
}
