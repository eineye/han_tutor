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

// Translations / hints of the script above for the other student UI languages
const SCRIPT_I18N = {
  Mongolian: [
    { en: 'Сайн байна уу! Би Бори байна. Чиний нэр хэн бэ?', hint_en: 'Ингэж хариул: 저는 ___이에요/예요.', suggestions_ko: ['저는 테무진이에요.', '제 이름은 사랑이에요.'] },
    { en: 'Танилцсандаа таатай байна! Чи аль улсын хүн бэ?', hint_en: 'Ингэж хэлээд үз: 저는 ___ 사람이에요.', suggestions_ko: ['저는 몽골 사람이에요.', '저는 한국 사람이에요.'] },
    { en: 'Хөөх, гоё юм! Чи хэддүгээр ангид сурдаг вэ?', hint_en: 'Ингэж хэлээд үз: ___학년이에요. (жишээ нь 9학년)', suggestions_ko: ['9학년이에요.', '고등학교 1학년이에요.'] },
    { en: 'Сайн байна! Чи солонгос драманд дуртай юу?', hint_en: '네, 좋아해요 / 아니요, 안 좋아해요 гэж хариул.', suggestions_ko: ['네, 좋아해요!', '아니요, K-pop을 좋아해요.'] },
    { en: 'Би ч бас! Өнөөдөр чи үнэхээр сайн хичээллээ. Дахиад ярилцъя!', hint_en: 'Салах ёс: 안녕히 계세요!', suggestions_ko: ['고마워요!', '안녕히 계세요!'] },
  ],
  Korean: [
    { en: '안녕하세요! 저는 보리예요. 이름이 뭐예요?', hint_en: '‘저는 ___이에요/예요.’로 대답해 보세요.', suggestions_ko: ['저는 민수예요.', '제 이름은 에마예요.'] },
    { en: '만나서 반가워요! 어느 나라 사람이에요?', hint_en: '‘저는 ___ 사람이에요.’로 말해 보세요.', suggestions_ko: ['저는 몽골 사람이에요.', '저는 한국 사람이에요.'] },
    { en: '와, 멋있어요! 몇 학년이에요?', hint_en: '‘___학년이에요.’로 말해 보세요. (예: 9학년)', suggestions_ko: ['9학년이에요.', '고등학교 1학년이에요.'] },
    { en: '좋아요! 한국 드라마 좋아해요?', hint_en: '‘네, 좋아해요 / 아니요, 안 좋아해요’로 대답해요.', suggestions_ko: ['네, 좋아해요!', '아니요, K-pop을 좋아해요.'] },
    { en: '저도요! 오늘 정말 잘했어요. 또 이야기해요!', hint_en: '‘안녕히 계세요!’로 인사해요.', suggestions_ko: ['고마워요!', '안녕히 계세요!'] },
  ],
};

const EXPLAIN = {
  English: { useKorean: 'Try answering in Korean! Here is one way to say it.', ieyo: 'After a consonant (받침) use 이에요; after a vowel use 예요.' },
  Mongolian: { useKorean: 'Солонгосоор хариулаад үзээрэй! Ингэж хэлж болно.', ieyo: 'Гийгүүлэгчээр (받침) төгссөн бол 이에요, эгшгээр төгссөн бол 예요 хэрэглэнэ.' },
  Korean: { useKorean: '한국어로 대답해 보세요! 이렇게 말할 수 있어요.', ieyo: '받침이 있으면 ‘이에요’, 받침이 없으면 ‘예요’를 써요.' },
};

export function demoChatReply(messages = [], lang = 'English') {
  const userTurns = messages.filter((m) => m.role === 'user').length;
  const step = Math.min(userTurns, SCRIPT.length - 1);
  const base = { ...SCRIPT[step], ...(SCRIPT_I18N[lang]?.[step] || {}) };
  // Corrections answer the question Bori asked just before (the previous step)
  const prevStep = Math.max(0, step - 1);
  const prevSuggestions = (SCRIPT_I18N[lang]?.[prevStep] || SCRIPT[prevStep]).suggestions_ko;
  const ex = EXPLAIN[lang] || EXPLAIN.English;
  const last = [...messages].reverse().find((m) => m.role === 'user')?.text || '';
  let correction = null;
  if (last && !/[가-힣]/.test(last)) {
    correction = {
      original: last,
      corrected: prevSuggestions[0],
      explanation_en: ex.useKorean,
    };
  } else {
    // Common beginner mistake: 이예요 → 이에요 (after consonant) / 예요 (after vowel)
    const m = last.match(/([가-힣])이예요/);
    if (m) {
      const hasFinal = (m[1].charCodeAt(0) - 0xac00) % 28 !== 0;
      correction = {
        original: last,
        corrected: last.replace(`${m[1]}이예요`, hasFinal ? `${m[1]}이에요` : `${m[1]}예요`),
        explanation_en: ex.ieyo,
      };
    }
  }
  return { ...base, correction };
}

const DEMO_PRON = {
  English: ['Demo mode: add a Gemini API key for real AI listening. Your browser score above is still based on speech recognition.', 'Example tip', 'Open your mouth a little wider and keep the vowel short and clear.'],
  Mongolian: ['Туршилтын горим: жинхэнэ AI сонсголд Gemini түлхүүр хэрэгтэй. Дээрх оноо хөтчийн яриа таних үйлчилгээгээр гарсан.', 'Жишээ зөвлөгөө', 'Амаа арай илүү ангайж, эгшгийг богино, тод хэлээрэй.'],
  Korean: ['데모 모드: 실제 AI 듣기는 Gemini 키가 있어야 해요. 위의 점수는 브라우저 음성 인식으로 매긴 점수예요.', '예시 팁', '입을 조금 더 벌리고 모음을 짧고 또렷하게 발음해 보세요.'],
};

export function demoPronunciation(target, lang = 'English') {
  const [fb, issue, how] = DEMO_PRON[lang] || DEMO_PRON.English;
  return {
    heard: target,
    score: 80,
    feedback_en: fb,
    tips: [{ syllable: [...target][0] || '', issue_en: issue, how_to_en: how }],
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
