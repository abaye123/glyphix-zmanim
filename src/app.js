import { startReminders, jobFired } from './lib/reminders.js'

export default {
  onCreate() {
    console.info('zmanim started')
    startReminders()
  },
  // Run by the system scheduler, also when the app was closed.
  onReminder(params) {
    jobFired(params)
  }
}
