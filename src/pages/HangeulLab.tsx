import { useState } from 'react';
import Mascot from '../components/Mascot';
import { useMascotSpeech } from '../components/useMascotSpeech';
import { CHO, JONG, JUNG, compose, romanize, visemesFor } from '../lib/hangul';
import { useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';

const VOWELS: { c: string; r: string }[] = [
  ['ㅏ', 'a'], ['ㅑ', 'ya'], ['ㅓ', 'eo'], ['ㅕ', 'yeo'], ['ㅗ', 'o'], ['ㅛ', 'yo'], ['ㅜ', 'u'], ['ㅠ', 'yu'], ['ㅡ', 'eu'], ['ㅣ', 'i'],
  ['ㅐ', 'ae'], ['ㅒ', 'yae'], ['ㅔ', 'e'], ['ㅖ', 'ye'], ['ㅘ', 'wa'], ['ㅙ', 'wae'], ['ㅚ', 'oe'], ['ㅝ', 'wo'], ['ㅞ', 'we'], ['ㅟ', 'wi'], ['ㅢ', 'ui'],
].map(([c, r]) => ({ c, r }));

// name = the letter's Korean name (기역, 니은 …)
const CONSONANTS: { c: string; r: string; name: string; group: 'basic' | 'aspirated' | 'tense' }[] = [
  ['ㄱ', 'g/k', '기역', 'basic'], ['ㄴ', 'n', '니은', 'basic'], ['ㄷ', 'd/t', '디귿', 'basic'], ['ㄹ', 'r/l', '리을', 'basic'], ['ㅁ', 'm', '미음', 'basic'],
  ['ㅂ', 'b/p', '비읍', 'basic'], ['ㅅ', 's', '시옷', 'basic'], ['ㅇ', '–/ng', '이응', 'basic'], ['ㅈ', 'j', '지읒', 'basic'], ['ㅎ', 'h', '히읗', 'basic'],
  ['ㅋ', 'k', '키읔', 'aspirated'], ['ㅌ', 't', '티읕', 'aspirated'], ['ㅍ', 'p', '피읖', 'aspirated'], ['ㅊ', 'ch', '치읓', 'aspirated'],
  ['ㄲ', 'kk', '쌍기역', 'tense'], ['ㄸ', 'tt', '쌍디귿', 'tense'], ['ㅃ', 'pp', '쌍비읍', 'tense'], ['ㅆ', 'ss', '쌍시옷', 'tense'], ['ㅉ', 'jj', '쌍지읒', 'tense'],
].map(([c, r, name, group]) => ({ c, r, name, group: group as 'basic' | 'aspirated' | 'tense' }));

type Tab = 'vowels' | 'consonants' | 'builder';

export default function HangeulLab() {
  const { t, lang } = useI18n();
  const ko = (s: string) => (lang === 'ko' ? '' : ` ${s}`);
  const [tab, setTab] = useState<Tab>('vowels');
  const mascot = useMascotSpeech();
  const [focus, setFocus] = useState<string>('ㅏ');
  const [cho, setCho] = useState('ㅎ');
  const [jung, setJung] = useState('ㅏ');
  const [jong, setJong] = useState('ㄴ');

  const say = (text: string, rate = 0.7) => mascot.say(text, { rate });
  const built = compose(cho, jung, jong);
  const focusViseme = /[ㅏ-ㅣ]/.test(focus) ? visemesFor(focus)[0] : null;

  return (
    <div className="lab">
      <h1>{t('lab.title')}{ko('한글 연구소')}</h1>
      <div className="tabs tabs--wide">
        <button className={tab === 'vowels' ? 'is-active' : ''} onClick={() => setTab('vowels')}>
          {t('lab.vowels')}{ko('모음')}
        </button>
        <button className={tab === 'consonants' ? 'is-active' : ''} onClick={() => setTab('consonants')}>
          {t('lab.consonants')}{ko('자음')}
        </button>
        <button className={tab === 'builder' ? 'is-active' : ''} onClick={() => setTab('builder')}>
          {t('lab.builder')}{ko('글자 만들기')}
        </button>
      </div>

      <div className="lab__layout">
        <div className="lab__mascot card">
          <Mascot viseme={mascot.speaking ? mascot.viseme : focusViseme && tab === 'vowels' ? focusViseme : 'rest'} talking={mascot.speaking} size={190} />
          <div className="lab__focus" lang="ko">
            {tab === 'builder' ? built : focus}
          </div>
          {tab === 'vowels' && focusViseme && <p className="muted">👄 {t(`viseme.${focusViseme}` as UIKey)}</p>}
          {tab === 'builder' && (
            <p className="roman">
              {romanize(built)} <button className="btn-icon" onClick={() => say(built)}>🔊</button>
            </p>
          )}
        </div>

        <div className="card">
          {tab === 'vowels' && (
            <>
              <p className="muted">{t('lab.vowelHint')}</p>
              <div className="jamo-grid">
                {VOWELS.map((v, i) => (
                  <button
                    key={v.c}
                    className={`jamo ${focus === v.c ? 'is-active' : ''} ${i >= 10 ? 'jamo--compound' : ''}`}
                    onClick={() => {
                      setFocus(v.c);
                      say(compose('ㅇ', v.c));
                    }}
                  >
                    <span lang="ko">{v.c}</span>
                    <small>{v.r}</small>
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'consonants' && (
            <>
              <p className="muted">{t('lab.consHint')}</p>
              {(['basic', 'aspirated', 'tense'] as const).map((g) => (
                <div key={g}>
                  <h4 className="jamo-group">{g === 'basic' ? `${t('lab.basic')}${ko('기본')}` : g === 'aspirated' ? `${t('lab.aspirated')}${ko('거센소리')} 💨` : `${t('lab.tense')}${ko('된소리')} 💪`}</h4>
                  <div className="jamo-grid">
                    {CONSONANTS.filter((c) => c.group === g).map((c) => (
                      <button
                        key={c.c}
                        className={`jamo ${focus === c.c ? 'is-active' : ''}`}
                        onClick={() => {
                          setFocus(c.c);
                          // A lone syllable gets its first consonant clipped by many voices, so it
                          // follows the letter name: "기역, 가." — the syllable is then heard clearly.
                          say(`${c.name}, ${compose(c.c, 'ㅏ')}.`);
                        }}
                      >
                        <span lang="ko">{c.c}</span>
                        <small>{c.r}</small>
                        <small lang="ko" className="jamo__name">{c.name}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="minimal-pairs">
                <h4>{t('lab.pairs')}{ko('비교')}</h4>
                {['가 카 까', '다 타 따', '바 파 빠', '자 차 짜', '사 싸'].map((set) => (
                  <button key={set} className="chip" onClick={() => say(`${set.replace(/ /g, ', ')}.`, 0.6)}>
                    🔊 {set}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'builder' && (
            <div className="builder">
              <p className="muted">{t('lab.builderHint')}</p>
              <div className="builder__row">
                <label>
                  {t('lab.initial')}{ko('초성')}
                  <div className="jamo-grid jamo-grid--small">
                    {CHO.map((c) => (
                      <button key={c} className={`jamo ${cho === c ? 'is-active' : ''}`} onClick={() => setCho(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  {t('lab.vowel')}{ko('중성')}
                  <div className="jamo-grid jamo-grid--small">
                    {JUNG.map((c) => (
                      <button key={c} className={`jamo ${jung === c ? 'is-active' : ''}`} onClick={() => setJung(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  {t('lab.final')}{ko('받침')}
                  <div className="jamo-grid jamo-grid--small">
                    {JONG.filter((c) => c.length <= 1).map((c) => (
                      <button key={c || 'none'} className={`jamo ${jong === c ? 'is-active' : ''}`} onClick={() => setJong(c)}>
                        {c || '∅'}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
              <div className="builder__result">
                <span className="builder__parts">
                  {cho} + {jung}
                  {jong && ` + ${jong}`} =
                </span>
                <span className="builder__syllable" lang="ko">
                  {built}
                </span>
                <button className="btn" onClick={() => say(built)}>
                  🔊 {t('common.listen')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
