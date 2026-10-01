import { useEffect, useState } from 'react';
import { api, download } from '../../api';
import { ErrorBox, Loading } from '../../components/ui';

interface Settings {
  classCodes: string[];
  geminiModel: string;
  ai: boolean;
}

export default function AdminSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [codes, setCodes] = useState('');
  const [model, setModel] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api<Settings>('/admin/settings')
      .then((r) => {
        setS(r);
        setCodes(r.classCodes.join(', '));
        setModel(r.geminiModel);
      })
      .catch(setError);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!s) return <Loading />;

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };

  const save = async () => {
    const r = await api<Settings>('/admin/settings', { method: 'PUT', body: { classCodes: codes.split(',').map((c) => c.trim()), geminiModel: model } });
    setS(r);
    setCodes(r.classCodes.join(', '));
    flash('저장되었습니다 ✓');
  };

  const importContent = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('현재 콘텐츠(단원·레슨·영상)를 파일 내용으로 교체할까요? 학생 기록은 유지됩니다.')) return;
      await api('/admin/content/import', { body: data });
      flash('가져오기 완료 ✓');
    } catch (e) {
      alert('가져오기 실패: ' + (e as Error).message);
    }
  };

  return (
    <div>
      <h1>설정</h1>
      {msg && <div className="alert alert--info">{msg}</div>}
      <section className="card form">
        <h3>반 코드</h3>
        <p className="muted small">학생은 가입할 때 반 코드를 입력해야 합니다. 여러 반은 쉼표로 구분하세요. (예: DEMO, LA-2026, SYDNEY-A)</p>
        <input value={codes} onChange={(e) => setCodes(e.target.value)} />
        <h3>Gemini AI</h3>
        <p>
          상태: {s.ai ? '✅ API 키 설정됨' : '⚪ 데모 모드 — 서버 .env 파일에 GEMINI_API_KEY 를 설정하세요'}
        </p>
        <label>
          사용 모델
          <input value={model} onChange={(e) => setModel(e.target.value)} list="gemini-models" />
          <datalist id="gemini-models">
            <option value="gemini-2.5-flash" />
            <option value="gemini-2.5-flash-lite" />
            <option value="gemini-2.5-pro" />
          </datalist>
          <small className="muted">대화·발음 피드백·리포트에 사용됩니다. 빠른 응답에는 flash 계열을 권장합니다.</small>
        </label>
        <button className="btn" onClick={save}>
          저장
        </button>
      </section>

      <section className="card form">
        <h3>콘텐츠 백업 / 가져오기</h3>
        <div className="row">
          <button className="btn btn--ghost" onClick={() => download('/admin/content/export', 'han-tutor-content.json')}>
            ⬇ 콘텐츠 내보내기 (JSON)
          </button>
          <label className="btn btn--ghost">
            ⬆ 콘텐츠 가져오기
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importContent(e.target.files[0])} />
          </label>
          <button
            className="btn btn--danger"
            onClick={async () => {
              if (!confirm('모든 단원·레슨·영상을 기본 샘플로 되돌릴까요? 수정 내용이 사라집니다. (학생 기록은 유지)')) return;
              await api('/admin/content/reset', { method: 'POST' });
              flash('기본 콘텐츠로 초기화되었습니다.');
            }}
          >
            기본 콘텐츠로 초기화
          </button>
        </div>
      </section>
    </div>
  );
}
