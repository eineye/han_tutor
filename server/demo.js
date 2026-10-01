// Canned responses used when no GEMINI_API_KEY is configured, so the prototype
// can be demoed end-to-end without network access or billing.
const SCRIPT = [
  {
    ko: '안녕하세요! 저는 보리예요. 이름이 뭐예요?',
    roman: 'Annyeonghaseyo! Jeoneun Boriyeyo. Ireumi mwoyeyo?',
    en: "Hello! I'm Bori. What's your name?",
    hint_en: 'Answer with: 저는 ___이에요/예요.',
    suggestions_ko: ['저는 민수예요.', '제 이름은 에마예요.'],
  },
  {
    ko: '만나서 반가워요! 어느 나라 사람이에요?',
    roman: 'Mannaseo bangawoyo! Eoneu nara saramieyo?',
    en: 'Nice to meet you! Which country are you from?',
    hint_en: 'Try: 저는 ___ 사람이에요.',
    suggestions_ko: ['저는 미국 사람이에요.', '저는 호주 사람이에요.'],
  },
  {
    ko: '와, 멋있어요! 몇 학년이에요?',
    roman: 'Wa, meosisseoyo! Myeot hagnyeonieyo?',
    en: 'Wow, cool! What grade are you in?',
    hint_en: 'Try: ___학년이에요. (e.g. 9학년)',
    suggestions_ko: ['9학년이에요.', '고등학교 1학년이에요.'],
  },
  {
    ko: '좋아요! 한국 드라마 좋아해요?',
    roman: 'Joayo! Hanguk deurama joahaeyo?',
    en: 'Great! Do you like Korean dramas?',
    hint_en: 'Answer with 네, 좋아해요 / 아니요, 안 좋아해요.',
    suggestions_ko: ['네, 좋아해요!', '아니요, K-pop을 좋아해요.'],
  },
  {
    ko: '저도요! 오늘 정말 잘했어요. 또 이야기해요!',
    roman: 'Jeodoyo! Oneul jeongmal jalhaesseoyo. Tto iyagihaeyo!',
    en: 'Me too! You did really well today. Let’s talk again!',
    hint_en: 'Say goodbye: 안녕히 계세요!',
    suggestions_ko: ['고마워요!', '안녕히 계세요!'],
  },
];

export function demoChatReply(messages = []) {
  const userTurns = messages.filter((m) => m.role === 'user').length;
  const base = SCRIPT[Math.min(userTurns, SCRIPT.length - 1)];
  const last = [...messages].reverse().find((m) => m.role === 'user')?.text || '';
  let correction = null;
  if (last && !/[가-힣]/.test(last)) {
    correction = {
      original: last,
      corrected: base.suggestions_ko[0],
      explanation_en: 'Try answering in Korean! Here is one way to say it.',
    };
  } else {
    // Common beginner mistake: 이예요 → 이에요 (after consonant) / 예요 (after vowel)
    const m = last.match(/([가-힣])이예요/);
    if (m) {
      const hasFinal = (m[1].charCodeAt(0) - 0xac00) % 28 !== 0;
      correction = {
        original: last,
        corrected: last.replace(`${m[1]}이예요`, hasFinal ? `${m[1]}이에요` : `${m[1]}예요`),
        explanation_en: 'After a consonant (받침) use 이에요; after a vowel use 예요.',
      };
    }
  }
  return { ...base, correction };
}

export function demoPronunciation(target) {
  return {
    heard: target,
    score: 80,
    feedback_en:
      'Demo mode: add a GEMINI_API_KEY on the server for real AI listening. Your browser score above is still based on speech recognition.',
    tips: [
      {
        syllable: [...target][0] || '',
        issue_en: 'Example tip',
        how_to_en: 'Open your mouth a little wider and keep the vowel short and clear.',
      },
    ],
  };
}

export function demoReport(student, stats) {
  return {
    summary_ko: `(데모) ${student.name} 학생은 레슨 ${stats.lessonsCompleted}개를 완료했으며 퀴즈 평균 ${stats.quizAvg ?? '-'}점, 발음 평균 ${stats.pronAvg ?? '-'}점입니다. GEMINI_API_KEY를 설정하면 실제 AI 분석 리포트가 생성됩니다.`,
    strengths_ko: ['꾸준한 접속', '퀴즈 참여'],
    needs_ko: ['받침 발음 연습', 'AI 대화 참여 확대'],
    next_steps_ko: ['다음 레슨 과제 부여', '발음 코치에서 받침 단어 10개 연습'],
    message_to_student_en: `Great work, ${student.name}! Keep practicing a little every day.`,
  };
}
