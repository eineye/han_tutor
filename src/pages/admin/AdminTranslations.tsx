import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { ErrorBox, Loading } from '../../components/ui';
import { BUILTIN_CONTENT, useI18n, type Overrides } from '../../i18n';

type TLang = 'mn' | 'ko';
interface StringRow {
  en: string;
  where: { kind: 'unit' | 'lesson' | 'video'; id: string; label: string; draft?: boolean }[];
}
type Status = 'custom' | 'builtin' | 'missing';
type StatusFilter = 'all' | 'missing' | 'custom';

const LANG_LABEL: Record<TLang, string> = { mn: '몽골어 (Монгол)', ko: '한국어' };
const PAGE = 40;

/** 교사용 번역 관리: 학생에게 보이는 영어 문장의 몽골어·한국어 번역을 보고 고치는 화면 */
export default function AdminTranslations() {
  const { reloadOverrides } = useI18n();
  const [rows, setRows] = useState<StringRow[] | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [error, setError] = useState<unknown>(null);
  const [lang, setLang] = useState<TLang>('mn');
  const [place, setPlace] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // unsaved edits for the current language
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ai, setAi] = useState(false);
  const [withDrafts, setWithDrafts] = useState(false);

  useEffect(() => {
    Promise.all([api<StringRow[]>('/admin/i18n/strings'), api<Overrides>('/i18n/overrides'), api<{ ai: boolean }>('/admin/settings')])
      .then(([r, o, s]) => {
        setRows(r);
        setOverrides(o || {});
        setAi(Boolean(s.ai));
      })
      .catch(setError);
  }, []);

  // switching language drops unsaved edits of the previous language
  useEffect(() => {
    setDrafts({});
    setLimit(PAGE);
  }, [lang]);

  const custom = overrides[lang] || {};
  const builtin = BUILTIN_CONTENT[lang];
  const statusOf = (en: string): Status => (custom[en] ? 'custom' : builtin[en] ? 'builtin' : 'missing');
  const current = (en: string) => drafts[en] ?? custom[en] ?? builtin[en] ?? '';

  const places = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows || []) for (const w of r.where) m.set(`${w.kind}:${w.id}`, w.label);
    return [...m.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (!withDrafts && !place && r.where.every((w) => w.draft)) return false;
      if (place && !r.where.some((w) => `${w.kind}:${w.id}` === place)) return false;
      const st = statusOf(r.en);
      if (status === 'missing' && st !== 'missing') return false;
      if (status === 'custom' && st !== 'custom') return false;
      if (needle && !r.en.toLowerCase().includes(needle) && !current(r.en).toLowerCase().includes(needle)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, place, status, q, lang, overrides, withDrafts]);

  if (error) return <ErrorBox error={error} />;
  if (!rows) return <Loading />;

  const visible = withDrafts ? rows : rows.filter((r) => r.where.some((w) => !w.draft));
  const counts = visible.reduce(
    (acc, r) => {
      acc[statusOf(r.en)]++;
      return acc;
    },
    { custom: 0, builtin: 0, missing: 0 } as Record<Status, number>,
  );
  const dirtyCount = Object.keys(drafts).length;

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  };

  const save = async () => {
    if (!dirtyCount) return;
    setBusy(true);
    try {
      // A text equal to the built-in translation is stored as "no override"
      const items = Object.fromEntries(Object.entries(drafts).map(([en, text]) => [en, text.trim() === (builtin[en] || '') ? '' : text]));
      const r = await api<{ translations: Overrides }>('/admin/i18n/translations', { method: 'PUT', body: { lang, items } });
      setOverrides(r.translations);
      setDrafts({});
      reloadOverrides();
      flash(`${dirtyCount}개 문장을 저장했습니다 ✓ 학생 화면에 바로 반영됩니다.`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetToBuiltin = (en: string) => setDrafts((d) => ({ ...d, [en]: builtin[en] || '' }));

  const aiDraft = async () => {
    const targets = filtered.filter((r) => !current(r.en).trim()).slice(0, 40).map((r) => r.en);
    if (!targets.length) return flash('지금 목록에는 번역이 비어 있는 문장이 없습니다.');
    setBusy(true);
    try {
      const r = await api<{ items: { en: string; text: string }[] }>('/admin/i18n/ai-translate', { body: { lang, texts: targets } });
      const filled = r.items.filter((i) => i.text);
      setDrafts((d) => ({ ...d, ...Object.fromEntries(filled.map((i) => [i.en, i.text])) }));
      flash(`AI가 ${filled.length}개 문장의 초안을 만들었습니다. 확인한 뒤 「저장」을 누르세요.`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="translations">
      <div className="page-head sticky-head">
        <h1>번역 관리</h1>
        <div className="row">
          {msg && <span className="muted">{msg}</span>}
          <button className="btn btn--ghost" onClick={aiDraft} disabled={busy || !ai} title={ai ? '' : '설정에서 Gemini 키를 넣으면 사용할 수 있어요'}>
            🤖 빈 번역 AI 초안 (최대 40개)
          </button>
          <button className="btn" onClick={save} disabled={busy || !dirtyCount}>
            💾 저장{dirtyCount ? ` (${dirtyCount})` : ''}
          </button>
        </div>
      </div>
      <p className="muted small">
        학생 화면의 설명·퀴즈·단어 뜻·드라마 해석은 영어 원문을 기준으로 번역됩니다. 여기서 입력한 번역은 기본 번역보다 우선 적용되고, 비워 두면 기본 번역(없으면 영어)이 보입니다. 레슨 내용을 새로 쓰거나 고친 뒤에는 「번역 없음」 필터로 빠진 문장을 채워 주세요.
      </p>

      <div className="tabs">
        {(['mn', 'ko'] as TLang[]).map((l) => (
          <button key={l} className={lang === l ? 'is-active' : ''} onClick={() => (dirtyCount && !confirm('저장하지 않은 번역이 있습니다. 언어를 바꿀까요?') ? null : setLang(l))}>
            {LANG_LABEL[l]}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <button className={`stat card stat--btn ${status === 'all' ? 'is-active' : ''}`} onClick={() => setStatus('all')}>
          <b>{visible.length}</b>
          <small>{withDrafts ? '전체 문장 (초안 포함)' : '공개된 문장'}</small>
        </button>
        <div className="stat card">
          <b>{counts.builtin}</b>
          <small>기본 번역</small>
        </div>
        <button className={`stat card stat--btn ${status === 'custom' ? 'is-active' : ''}`} onClick={() => setStatus('custom')}>
          <b>{counts.custom}</b>
          <small>교사 수정</small>
        </button>
        <button className={`stat card stat--btn ${status === 'missing' ? 'is-active' : ''}`} onClick={() => setStatus('missing')}>
          <b className={counts.missing ? 'text-bad' : ''}>{counts.missing}</b>
          <small>번역 없음 (영어로 표시)</small>
        </button>
      </div>

      <div className="filters card">
        <select value={place} onChange={(e) => (setPlace(e.target.value), setLimit(PAGE))} aria-label="위치">
          <option value="">전체 위치</option>
          {places.map(([k, label]) => (
            <option key={k} value={k}>
              {k.startsWith('video') ? '🎬 ' : k.startsWith('unit') ? '📁 ' : '📘 '}
              {label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="상태">
          <option value="all">모든 상태</option>
          <option value="missing">번역 없음만</option>
          <option value="custom">교사 수정만</option>
        </select>
        <input placeholder="영어 원문 또는 번역 검색" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} />
        <label className="toggle">
          <input type="checkbox" checked={withDrafts} onChange={(e) => setWithDrafts(e.target.checked)} />
          <span className="toggle__track" />
          <span>초안 레슨·영상 포함</span>
        </label>
        <span className="muted">{filtered.length}개</span>
      </div>

      <div className="card table-wrap">
        <table className="table table--edit tr-table">
          <thead>
            <tr>
              <th style={{ width: '38%' }}>영어 원문 (학생에게 보이는 문장)</th>
              <th>{LANG_LABEL[lang]} 번역</th>
              <th style={{ width: 110 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((r) => {
              const st = statusOf(r.en);
              const dirty = r.en in drafts;
              return (
                <tr key={r.en} className={dirty ? 'is-dirty' : ''}>
                  <td>
                    <div className="tr-en">{r.en}</div>
                    <div className="tr-where">
                      {r.where.slice(0, 3).map((w) => (
                        <span key={`${w.kind}:${w.id}`} className="badge">
                          {w.label}
                        </span>
                      ))}
                      {r.where.length > 3 && <span className="badge">+{r.where.length - 3}</span>}
                    </div>
                  </td>
                  <td>
                    <textarea
                      rows={Math.min(6, Math.max(2, Math.ceil(r.en.length / 60)))}
                      value={current(r.en)}
                      placeholder="번역을 입력하세요 (비우면 영어로 표시)"
                      lang={lang}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.en]: e.target.value }))}
                      aria-label={`${LANG_LABEL[lang]} 번역: ${r.en.slice(0, 40)}`}
                    />
                  </td>
                  <td>
                    {dirty ? (
                      <span className="badge badge--ok">수정 중</span>
                    ) : st === 'custom' ? (
                      <span className="badge badge--good">교사 수정</span>
                    ) : st === 'builtin' ? (
                      <span className="badge">기본 번역</span>
                    ) : (
                      <span className="badge badge--low">번역 없음</span>
                    )}
                    {st === 'custom' && builtin[r.en] && (
                      <button className="btn btn--ghost btn--small tr-reset" onClick={() => resetToBuiltin(r.en)}>
                        기본값으로
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  조건에 맞는 문장이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filtered.length > limit && (
          <button className="btn btn--ghost btn--small" onClick={() => setLimit(limit + PAGE)}>
            더 보기 ({filtered.length - limit}개 남음)
          </button>
        )}
      </div>
    </div>
  );
}
