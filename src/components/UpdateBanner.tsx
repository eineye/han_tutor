import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { checkForUpdate, type UpdateInfo } from '../lib/appInfo';

const DISMISS_KEY = 'hantutor.updateDismissed';

/** "A new version is available" bar for directly installed APKs (see checkForUpdate). */
export default function UpdateBanner() {
  const { t } = useI18n();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    let alive = true;
    checkForUpdate().then((u) => {
      let dismissed = 0;
      try {
        dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
      } catch {
        /* storage unavailable */
      }
      if (alive && u && u.versionCode !== dismissed) setInfo(u);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!info) return null;
  const later = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(info.versionCode));
    } catch {
      /* storage unavailable */
    }
    setInfo(null);
  };
  return (
    <div className="update-banner" role="status">
      <div>
        <b>🆕 {t('update.available', { v: info.versionName })}</b>
        <div className="small">{t('update.how')}</div>
      </div>
      <div className="update-banner__actions">
        <a className="btn btn--small" href={info.apk} target="_blank" rel="noreferrer">
          ⬇ {t('update.download')}
        </a>
        <button type="button" className="btn btn--ghost btn--small" onClick={later}>
          {t('update.later')}
        </button>
      </div>
    </div>
  );
}
