import { api } from '../api';

let sent: Promise<unknown> | null = null;

/**
 * Tells the server the phone's time zone once per app start, so the student's study day
 * (streak, today's plan) starts at local midnight. Today's plan waits for it.
 */
export function syncTimeZone() {
  sent ||= api('/study/settings', { body: { tz: new Date().getTimezoneOffset() } }).catch(() => {
    sent = null;
  });
  return sent;
}
