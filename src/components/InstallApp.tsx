import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { isNativeApp } from '../lib/native';

// "Install app" button. Android / desktop Chrome: the browser's own install prompt.
// iPhone / iPad (no prompt): a short how-to. Hidden once installed, in the Android app and in frames.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isAndroid = () => /android/i.test(navigator.userAgent);
/** APK built by .github/workflows/android.yml and published on the "android-latest" release */
export const APK_URL = 'https://github.com/eineye/han_tutor/releases/download/android-latest/hangeulon.apk';
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function InstallApp({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [, rerender] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const f = () => rerender((n) => n + 1);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);

  if (isNativeApp() || standalone() || window.self !== window.top) return null;
  const label = (
    <>
      📲{compact ? '' : ` ${t('install.button')}`}
    </>
  );

  // Login screen on an Android phone: the real app (APK) as well
  const apk = !compact && isAndroid() && (
    <a className="btn btn--ghost btn--small install-app" href={APK_URL}>
      🤖 {t('install.apk')}
    </a>
  );

  if (deferred) {
    const button = (
      <button
        type="button"
        className="btn btn--ghost btn--small install-app"
        title={t('install.button')}
        onClick={async () => {
          const d = deferred;
          deferred = null;
          await d?.prompt();
          await d?.userChoice.catch(() => {});
          notify();
        }}
      >
        {label}
      </button>
    );
    return apk ? (
      <div className="row">
        {button}
        {apk}
      </div>
    ) : (
      button
    );
  }
  if (apk) return apk;
  if (!isIos()) return null;
  return (
    <span className="install-app">
      <button type="button" className="btn btn--ghost btn--small" title={t('install.button')} onClick={() => setHelp(!help)} aria-expanded={help}>
        {label}
      </button>
      {help && <div className="alert alert--info small install-app__help">{t('install.ios')}</div>}
    </span>
  );
}
