// Router params are not relied on: the next page takes its input from here.
export const nav = {
  // [year, month, day] of the day page.
  day: null,
  // { id, day, hour, minute, text } of the reminder being edited.
  draft: null
}

export function newDraft(day) {
  const t = new Date(Date.now() + 3600000)
  const draft = { id: 0, day: day || [t.getFullYear(), t.getMonth() + 1, t.getDate()], hour: t.getHours(), minute: 0, text: '' }
  // After 23:00 the next hour is tomorrow, but the picked day may be today.
  if (draftTime(draft) <= Date.now()) {
    draft.hour = 23
    draft.minute = 59
  }
  return draft
}

export function draftOf(r) {
  const t = new Date(r.at)
  return {
    id: r.id,
    day: [t.getFullYear(), t.getMonth() + 1, t.getDate()],
    hour: t.getHours(),
    minute: t.getMinutes(),
    text: r.text
  }
}

export const draftTime = d => new Date(d.day[0], d.day[1] - 1, d.day[2], d.hour, d.minute).getTime()
