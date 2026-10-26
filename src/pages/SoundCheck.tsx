import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { isNativeApp, withTts } from '../lib/native';
import { speak } from '../lib/speech';

// 소리 점검 · Sound check: finds out where sound stops on a phone (app audio, phone speech engine, Korean voice).
// Students/teachers can screenshot the log and send it to the teacher.

/** 0.6 s 440 Hz beep as a WAV data URL (no network, no speech engine) */
function beepUrl() {
  const rate = 22050;
  const n = Math.round(rate * 0.6);
  const buf = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  buf.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVEfmt ');
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true);
  buf.setUint16(22, 1, true);
  buf.setUint32(24, rate, true);
  buf.setUint32(28, rate * 2, true);
  buf.setUint16(32, 2, true);
  buf.setUint16(34, 16, true);
  str(36, 'data');
  buf.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) buf.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 440 * i) / rate) * 12000 * Math.min(1, (n - i) / 2000), true);
  return URL.createObjectURL(new Blob([buf.buffer], { type: 'audio/wav' }));
}

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e));

export default function SoundCheck() {
  const { role } = useAuth();
  const [log, setLog] = useState<string[]>(() => {
    const ss = 'speechSynthesis' in window;
    return [
      `앱(App): ${isNativeApp() ? 'Android 앱 ✅' : '웹 브라우저 (web)'}`,
      `speechSynthesis: ${ss ? `있음, 한국어 음성 ${window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('ko')).length}개` : '없음'}`,
      `UA: ${navigator.userAgent}`,
    ];
  });
  const add = (line: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()}  ${line}`]);

  const beepAudio = () => {
    const a = new Audio(beepUrl());
    a.volume = 1;
    a.onended = () => add('① 삐 소리(Audio) 재생 끝 — 들렸나요? / ended');
    a.onerror = () => add(`① 삐 소리(Audio) 오류: ${a.error?.message || a.error?.code}`);
    a.play().then(
      () => add('① 삐 소리(Audio) 재생 시작 / playing'),
      (e) => add(`① 삐 소리(Audio) 재생 실패: ${errText(e)}`),
    );
  };

  const beepWebAudio = async () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      await ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.3;
      o.frequency.value = 660;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.6);
      add(`② 삐 소리(Web Audio) state=${ctx.state}`);
      o.onended = () => ctx.close();
    } catch (e) {
      add(`② Web Audio 오류: ${errText(e)}`);
    }
  };

  const engineInfo = async () => {
    if (!isNativeApp()) return add('③ 휴대폰 음성 엔진: 앱에서만 점검할 수 있어요 (app only)');
    try {
      await withTts(async (t) => {
        const ko = await t.isLanguageSupported({ lang: 'ko-KR' }).catch((e) => ({ supported: `오류 ${errText(e)}` }));
        const en = await t.isLanguageSupported({ lang: 'en-US' }).catch((e) => ({ supported: `오류 ${errText(e)}` }));
        const langs = await t.getSupportedLanguages().catch(() => ({ languages: [] as string[] }));
        const voices = await t.getSupportedVoices().catch(() => ({ voices: [] as unknown[] }));
        const koLangs = langs.languages.filter((l) => l.toLowerCase().startsWith('ko'));
        add(`③ 엔진: 한국어 지원=${ko.supported}, 영어 지원=${en.supported}, 언어 ${langs.languages.length}개 (한국어: ${koLangs.join(', ') || '없음'}), 음성 ${voices.voices.length}개`);
      });
    } catch (e) {
      add(`③ 엔진 정보 오류: ${errText(e)}`);
    }
  };

  const engineSpeak = async (text: string, lang: string, label: string) => {
    if (!isNativeApp()) return add(`${label}: 앱에서만 점검할 수 있어요 (app only)`);
    const t0 = performance.now();
    try {
      add(`${label}: 말하기 요청 / speaking…`);
      await withTts((t) => t.speak({ text, lang, rate: 1, pitch: 1, volume: 1 }));
      add(`${label}: 끝 (${Math.round(performance.now() - t0)}ms) — 들렸나요?`);
    } catch (e) {
      add(`${label}: 실패 — ${errText(e)}`);
    }
  };

  const appSpeak = () => {
    const t0 = performance.now();
    add('⑥ 앱 음성(보리) 요청');
    speak('안녕하세요. 저는 보리예요.', {
      onStart: () => add(`⑥ 시작 (${Math.round(performance.now() - t0)}ms)`),
      onEnd: () => add(`⑥ 끝 (${Math.round(performance.now() - t0)}ms)`),
    });
  };

  const openInstall = () =>
    withTts((t) => t.openInstall())
      .then(() => add('⑦ 음성 데이터 설치 화면 열기 요청'))
      .catch((e) => add(`⑦ 열기 실패: ${errText(e)}`));

  return (
    <div className="main soundcheck">
      <Link to={role === 'admin' ? '/admin/settings' : role === 'student' ? '/home' : '/login'} className="muted small">
        ← 돌아가기 / Back
      </Link>
      <h1>🔊 소리 점검 · Sound check</h1>
      <p className="muted small">
        위에서부터 차례로 눌러 보세요. 들린 것과 안 들린 것, 아래 기록 화면을 캡처해서 선생님께 보내 주세요. / Tap each button from the top and send a screenshot of the log.
      </p>
      <div className="card soundcheck__buttons">
        <button className="btn" onClick={beepAudio}>
          ① 삐 소리 (Audio)
        </button>
        <button className="btn" onClick={beepWebAudio}>
          ② 삐 소리 (Web Audio)
        </button>
        <button className="btn btn--ghost" onClick={engineInfo}>
          ③ 휴대폰 음성 엔진 정보
        </button>
        <button className="btn" onClick={() => engineSpeak('Hello, this is a sound test.', 'en-US', '④ 영어 음성 (English)')}>
          ④ 영어 음성 (English)
        </button>
        <button className="btn" onClick={() => engineSpeak('안녕하세요. 소리 점검입니다.', 'ko-KR', '⑤ 한국어 음성 (Korean)')}>
          ⑤ 한국어 음성 (Korean)
        </button>
        <button className="btn" onClick={appSpeak}>
          ⑥ 보리 목소리 (앱 설정대로)
        </button>
        {isNativeApp() && (
          <button className="btn btn--ghost" onClick={openInstall}>
            ⑦ 한국어 음성 데이터 설치 화면
          </button>
        )}
      </div>
      <div className="alert alert--info small">
        ①②가 안 들리면: 휴대폰 <b>미디어 볼륨</b>(음량 버튼 → 미디어), 무음·방해 금지 모드, 블루투스 연결을 확인하세요. ④는 들리고 ⑤만 안 들리면: 설정 › 텍스트 음성 변환 › Google 엔진 › 음성 데이터
        설치 › 한국어.
      </div>
      <pre className="card soundcheck__log">{log.join('\n')}</pre>
    </div>
  );
}
