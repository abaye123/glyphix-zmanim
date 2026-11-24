import storage from '@system.storage'
import schedule from '@system.schedule'
import notification from '@system.notification'
import vibrator from '@system.vibrator'
import prompt from '@system.prompt'
import * as core from './reminders-core.js'

const KEY = 'reminders'
let list = null
let stored = true

function all() {
  if (!list) {
    try {
      list = core.parse(storage.get(KEY))
    } catch (e) {
      console.warn('load reminders failed: ' + e)
      list = []
    }
  }
  return list
}

export function toast(message) {
  try {
    prompt.showToast({ message: message })
  } catch (e) {
    console.warn('toast failed: ' + e)
  }
}

function buzz() {
  try {
    vibrator.vibrate({ mode: 'long' })
  } catch (e) {
    console.warn('vibrate failed: ' + e)
  }
}

function env() {
  return {
    now: Date.now(),
    schedule(r, delay) {
      try {
        // Type 2 is elapsed time, so it does not depend on how the system clock keeps the zone.
        const id = schedule.scheduleJob({
          type: 2,
          timeout: Math.round(delay),
          triggerMethod: 'onReminder',
          params: { id: r.id }
        })
        return typeof id === 'number' ? id : -1
      } catch (e) {
        console.warn('schedule failed: ' + e)
        return -1
      }
    },
    cancel(job) {
      try {
        schedule.cancel(job)
      } catch (e) {
        console.warn('cancel failed: ' + e)
      }
    },
    alert(r) {
      try {
        notification.publish({
          icon: '/assets/icon.png',
          id: r.id,
          contentType: 1,
          content: { title: 'תזכורת ' + timeText(r.at), text: r.text },
          deliveryTime: Date.now(),
          actionUri: ''
        })
      } catch (e) {
        console.warn('notification failed: ' + e)
      }
      buzz()
      setTimeout(buzz, 1200)
      setTimeout(buzz, 2400)
      toast(r.text)
    },
    save() {
      const text = JSON.stringify(list)
      try {
        storage.set(KEY, text)
        stored = storage.get(KEY) === text
      } catch (e) {
        stored = false
        console.warn('save reminders failed: ' + e)
      }
    }
  }
}

const pad = n => (n < 10 ? '0' : '') + n

export function timeText(at) {
  const t = new Date(at)
  return pad(t.getHours()) + ':' + pad(t.getMinutes())
}

export function startReminders() {
  core.reconcile(all(), env())
}

// Called by the page timer, while the app is open.
export function checkDue() {
  return core.fireDue(all(), env(), core.LATE)
}

export function jobFired(params) {
  let id = -1
  try {
    const p = typeof params === 'string' ? JSON.parse(params) : params
    id = Number(p && p.id)
  } catch (e) {
    console.warn('bad job params: ' + e)
  }
  core.onJob(all(), env(), id)
}

export function saveReminder(draft) {
  if (!draft.id && all().length >= core.MAX_REMINDERS) return 'full'
  const ok = core.upsert(all(), env(), draft)
  return !stored ? 'storage' : ok ? 'ok' : 'schedule'
}

export function deleteReminder(id) {
  core.remove(all(), env(), id)
}

export function getReminder(id) {
  return all().find(r => r.id === id)
}

export const upcoming = () => all().filter(r => core.isPending(r, Date.now())).sort((a, b) => a.at - b.at)

export const missed = () => all().filter(r => core.isMissed(r, Date.now())).sort((a, b) => a.at - b.at)

export function dismissMissed() {
  missed().forEach(r => { r.seen = true })
  env().save()
}

export function ofDay(y, m, d) {
  const from = new Date(y, m - 1, d).getTime(), to = new Date(y, m - 1, d + 1).getTime()
  return all().filter(r => r.at >= from && r.at < to).sort((a, b) => a.at - b.at)
}
