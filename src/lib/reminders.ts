import { isNativeApp } from './native';

// Daily study reminder (Android app): one local notification a day at the student's chosen time.
// Nothing goes through a server. The text is refreshed every time the app opens (e.g. "12 words to review").

const KEY = 'hantutor.reminder';
const ID = 7001;

export interface ReminderSetting {
  on: boolean;
  time: string; // "19:00"
}

export function getReminder(): ReminderSetting {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (r && typeof r.time === 'string') return { on: Boolean(r.on), time: r.time };
  } catch {
    /* storage unavailable */
  }
  return { on: false, time: '19:00' };
}

type LN = typeof import('@capacitor/local-notifications').LocalNotifications;
// never resolve a promise WITH a plugin object (see native.ts): pass a callback instead
async function withLn<T>(fn: (ln: LN) => Promise<T>): Promise<T> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return fn(LocalNotifications);
}

export const remindersSupported = () => isNativeApp();

/**
 * Saves the setting and (re)schedules the notification. Returns 'denied' when the phone blocks notifications.
 */
export async function setReminder(setting: ReminderSetting, text: { title: string; body: string }): Promise<'ok' | 'denied' | 'unsupported'> {
  try {
    localStorage.setItem(KEY, JSON.stringify(setting));
  } catch {
    /* storage unavailable */
  }
  if (!remindersSupported()) return 'unsupported';
  return withLn(async (ln) => {
    await ln.cancel({ notifications: [{ id: ID }] }).catch(() => {});
    if (!setting.on) return 'ok';
    let perm = await ln.checkPermissions();
    if (perm.display !== 'granted') perm = await ln.requestPermissions();
    if (perm.display !== 'granted') return 'denied';
    const [hour, minute] = setting.time.split(':').map(Number);
    await ln.schedule({
      notifications: [{ id: ID, title: text.title, body: text.body, schedule: { on: { hour, minute }, allowWhileIdle: true } }],
    });
    return 'ok';
  }).catch(() => 'denied' as const);
}

/** Refreshes the reminder text (called when today's plan loads). */
export function refreshReminder(text: { title: string; body: string }) {
  const r = getReminder();
  if (r.on && remindersSupported()) setReminder(r, text).catch(() => {});
}
