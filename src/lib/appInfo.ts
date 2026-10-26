import { API_BASE, IS_APP, IS_DEMO } from '../api';
import { isNativeApp } from './native';

/** e.g. "1.0.45" (CI run number) */
export const APP_VERSION = String(import.meta.env.VITE_APP_VERSION || '');
export const APP_VERSION_CODE = Number(import.meta.env.VITE_APP_VERSION_CODE || 0);

/**
 * Update notice for APKs handed out directly (not for Google Play builds: Play installs updates itself,
 * and Play apps must not update from elsewhere). Set by the build: VITE_UPDATE_CHECK=apk.
 */
const UPDATE_CHECK = import.meta.env.VITE_UPDATE_CHECK === 'apk';
const RELEASE = 'https://github.com/eineye/han_tutor/releases/download/android-latest';
export const APK_URL = `${RELEASE}/hangeulon.apk`;

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  apk: string;
}

let checked: Promise<UpdateInfo | null> | null = null;

/** The newer APK on the release page, or null (up to date, no internet, or not an APK build). */
export function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!UPDATE_CHECK || !isNativeApp() || !APP_VERSION_CODE) return Promise.resolve(null);
  checked ||= import('@capacitor/core')
    .then(async ({ CapacitorHttp }) => {
      // native request: GitHub's download links do not allow browser (CORS) requests
      const r = await CapacitorHttp.get({ url: `${RELEASE}/version.json?t=${Date.now()}`, responseType: 'json' });
      const info = (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as UpdateInfo;
      return Number(info?.versionCode) > APP_VERSION_CODE ? { ...info, apk: info.apk || APK_URL } : null;
    })
    .catch(() => null);
  return checked;
}

/** Public pages (privacy policy, account deletion): on the class server, or on GitHub Pages for the trial app. */
export function pageUrl(name: string) {
  if (IS_APP) return API_BASE ? `${API_BASE}/${name}` : `https://eineye.github.io/han_tutor/${name}`;
  return IS_DEMO ? name : `/${name}`;
}
