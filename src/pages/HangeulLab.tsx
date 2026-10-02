import { useState } from 'react';
import Mascot from '../components/Mascot';
import { useMascotSpeech } from '../components/useMascotSpeech';
import { CHO, JONG, JUNG, compose, romanize, visemesFor } from '../lib/hangul';
import { useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';
import { CONSONANTS, PAIRS, VOWELS } from '../lib/hangeulSets';

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

  // recordingText: a teacher recording of just the syllable (e.g. 가) is preferred when there is one
  const say = (text: string, rate = 0.7, recordingText?: string) => mascot.say(text, { rate, recordingText });
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
                          say(`${c.name}, ${compose(c.c, 'ㅏ')}.`, 0.7, compose(c.c, 'ㅏ'));
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
                {PAIRS.map((set) => (
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
