// Drama Studio seed scenes.
// These are ORIGINAL short K-drama-style scenes written for this app (no copyrighted scripts).
// Each scene can play in three ways:
//   source.type = 'none'    → "Audio drama" mode: lines are voiced by TTS with character cards
//   source.type = 'youtube' → an embedded YouTube clip (official/licensed channel), lines timed with start/end
//   source.type = 'file'    → a video file URL you are licensed to use (e.g. your own school-made video)
// Teachers can attach a clip and set line timings in Admin > 드라마 영상.

const line = (speaker, ko, roman, en, start = null, end = null) => ({ speaker, ko, roman, en, start, end });

export const seedVideos = [
  {
    id: 'V1',
    order: 1,
    title: { ko: '전학생', en: 'The New Transfer Student' },
    genre: 'School romance-comedy',
    level: 'beginner',
    relatedLessons: ['L1', 'L2'],
    thumbnail: '🏫',
    description_en: 'Episode 1. A new student walks into class 2-3 on a rainy Monday morning... and sits next to the class troublemaker.',
    source: { type: 'none', url: '', youtubeId: '' },
    cast: [
      { name: '선생님', role: 'Homeroom teacher', color: '#6c8cff', voice: { pitch: 0.9, rate: 0.95 } },
      { name: '하늘', role: 'Transfer student', color: '#ff7aa8', voice: { pitch: 1.25, rate: 1 } },
      { name: '태오', role: 'Class troublemaker', color: '#33b38a', voice: { pitch: 0.8, rate: 1.05 } },
    ],
    lines: [
      line('선생님', '여러분, 조용히 하세요. 오늘 전학생이 왔어요.', 'Yeoreobun, joyonghi haseyo. Oneul jeonhaksaengi wasseoyo.', 'Everyone, quiet please. A transfer student came today.'),
      line('하늘', '안녕하세요. 저는 한하늘이에요. 만나서 반가워요.', 'Annyeonghaseyo. Jeoneun Han Haneurieyo. Mannaseo bangawoyo.', 'Hello. I’m Han Haneul. Nice to meet you.'),
      line('선생님', '하늘 씨, 저기 태오 옆에 앉으세요.', 'Haneul ssi, jeogi Taeo yeope anjeuseyo.', 'Haneul, please sit over there next to Taeo.'),
      line('태오', '뭐? 내 옆에?', 'Mwo? Nae yeope?', 'What? Next to me?'),
      line('하늘', '안녕! 아니, 안녕하세요?', 'Annyeong! Ani, annyeonghaseyo?', 'Hi! I mean... hello?'),
      line('태오', '...안녕. 이름이 뭐라고?', '...Annyeong. Ireumi mworago?', '...Hi. What did you say your name was?'),
      line('하늘', '하늘이에요. 한, 하, 늘!', 'Haneurieyo. Han, Ha, Neul!', 'It’s Haneul. Han, Ha, Neul!'),
      line('태오', '하늘? 이름 예쁘네.', 'Haneul? Ireum yeppeune.', 'Haneul? Pretty name.'),
    ],
    expressions: [
      { ko: '조용히 하세요', en: 'Please be quiet', note_en: 'Teachers say this a lot!' },
      { ko: '만나서 반가워요', en: 'Nice to meet you', note_en: 'Longer, very common form of 반가워요.' },
      { ko: '앉으세요', en: 'Please sit down', note_en: '-(으)세요 = polite request.' },
      { ko: '뭐?', en: 'What?!', note_en: 'Casual surprise. Use only with friends!' },
      { ko: '하늘', en: 'sky', note_en: 'A popular Korean name meaning “sky”.' },
    ],
    quiz: [
      { type: 'mc', prompt: 'Who is the new student?', options: ['태오', '하늘', '선생님'], answer: 1 },
      { type: 'mc', prompt: 'Where does Haneul sit?', options: ['Next to the teacher', 'Next to Taeo', 'By the window'], answer: 1 },
      { type: 'listen', prompt: 'Listen and choose.', say: '만나서 반가워요', options: ['만나서 반가워요', '안녕히 계세요', '조용히 하세요'], answer: 0 },
      { type: 'mc', prompt: 'What does 하늘 mean?', options: ['sea', 'sky', 'star', 'flower'], answer: 1 },
    ],
    status: 'published',
  },
  {
    id: 'V2',
    order: 2,
    title: { ko: '편의점에서', en: 'Midnight at the Convenience Store' },
    genre: 'Slice of life',
    level: 'beginner',
    relatedLessons: ['L3', 'L8'],
    thumbnail: '🏪',
    description_en: 'Episode 2. Taeo works a late shift at a convenience store. Guess who walks in looking for snacks?',
    source: { type: 'none', url: '', youtubeId: '' },
    cast: [
      { name: '태오', role: 'Part-timer', color: '#33b38a', voice: { pitch: 0.8, rate: 1.05 } },
      { name: '하늘', role: 'Customer', color: '#ff7aa8', voice: { pitch: 1.25, rate: 1 } },
    ],
    lines: [
      line('태오', '어서 오세요.', 'Eoseo oseyo.', 'Welcome.'),
      line('하늘', '어? 태오 씨! 여기서 일해요?', 'Eo? Taeo ssi! Yeogiseo ilhaeyo?', 'Huh? Taeo! You work here?'),
      line('태오', '응... 아니, 네. 뭐 찾아요?', 'Eung... ani, ne. Mwo chajayo?', 'Yeah... I mean, yes. What are you looking for?'),
      line('하늘', '삼각김밥이 어디에 있어요?', 'Samgakgimbabi eodie isseoyo?', 'Where are the triangle gimbap?'),
      line('태오', '저기 라면 옆에 있어요.', 'Jeogi ramyeon yeope isseoyo.', 'Over there, next to the ramyeon.'),
      line('하늘', '이거하고 바나나 우유 주세요. 얼마예요?', 'Igeohago banana uyu juseyo. Eolmayeyo?', 'This and a banana milk, please. How much?'),
      line('태오', '삼천오백 원이에요.', 'Samcheon-obaek wonieyo.', 'It’s 3,500 won.'),
      line('하늘', '여기요. 일 화이팅!', 'Yeogiyo. Il hwaiting!', 'Here. Good luck with work!'),
    ],
    expressions: [
      { ko: '어서 오세요', en: 'Welcome (to a store)', note_en: 'You will hear this in every Korean shop.' },
      { ko: '여기서 일해요?', en: 'Do you work here?', note_en: '여기서 = here (place of action).' },
      { ko: '삼각김밥', en: 'triangle gimbap', note_en: 'The #1 convenience store snack.' },
      { ko: '바나나 우유', en: 'banana milk', note_en: 'A famous Korean drink since 1974.' },
      { ko: '화이팅!', en: 'You can do it!', note_en: 'Konglish cheer from “fighting”.' },
    ],
    quiz: [
      { type: 'mc', prompt: 'Where is the triangle gimbap?', options: ['Next to the ramyeon', 'Under the desk', 'In front of the door'], answer: 0 },
      { type: 'mc', prompt: 'How much does Haneul pay?', options: ['3,000 won', '3,500 won', '5,300 won'], answer: 1 },
      { type: 'listen', prompt: 'Listen and choose.', say: '어서 오세요', options: ['어서 오세요', '여기 있어요', '얼마예요'], answer: 0 },
      { type: 'order', prompt: 'Put the words in order.', en: 'Where is the triangle gimbap?', words: ['삼각김밥이', '어디에', '있어요?'] },
    ],
    status: 'published',
  },
  {
    id: 'V3',
    order: 3,
    title: { ko: '떡볶이 데이트?', en: 'A Tteokbokki “Date”?' },
    genre: 'Romance-comedy',
    level: 'beginner',
    relatedLessons: ['L7', 'L8'],
    thumbnail: '🍢',
    description_en: 'Episode 3. Taeo asks Haneul what she’s doing this weekend... is it a date?',
    source: { type: 'none', url: '', youtubeId: '' },
    cast: [
      { name: '태오', role: 'Classmate', color: '#33b38a', voice: { pitch: 0.8, rate: 1.05 } },
      { name: '하늘', role: 'Transfer student', color: '#ff7aa8', voice: { pitch: 1.25, rate: 1 } },
    ],
    lines: [
      line('태오', '하늘 씨, 주말에 뭐 해요?', 'Haneul ssi, jumare mwo haeyo?', 'Haneul, what are you doing this weekend?'),
      line('하늘', '음... 집에서 드라마 봐요. 왜요?', 'Eum... jibeseo deurama bwayo. Waeyo?', 'Um... I’m watching dramas at home. Why?'),
      line('태오', '그럼... 같이 떡볶이 먹어요!', 'Geureom... gachi tteokbokki meogeoyo!', 'Then... let’s eat tteokbokki together!'),
      line('하늘', '떡볶이요? 좋아요! 몇 시에 만나요?', 'Tteokbokkiyo? Joayo! Myeot sie mannayo?', 'Tteokbokki? Sounds good! What time shall we meet?'),
      line('태오', '토요일 두 시, 학교 앞에서 만나요.', 'Toyoil du si, hakgyo apeseo mannayo.', 'Saturday at two, in front of the school.'),
      line('하늘', '좋아요. 그런데... 이거 데이트예요?', 'Joayo. Geureonde... igeo deiteuyeyo?', 'OK. But... is this a date?'),
      line('태오', '뭐? 아, 아니요! 그냥 떡볶이예요!', 'Mwo? A, aniyo! Geunyang tteokbokkiyeyo!', 'What? N-no! It’s just tteokbokki!'),
    ],
    expressions: [
      { ko: '같이 ~아요/어요!', en: 'Let’s ... together!', note_en: 'The polite ending can also mean “let’s”.' },
      { ko: '몇 시에 만나요?', en: 'What time shall we meet?', note_en: '' },
      { ko: '학교 앞에서', en: 'in front of the school', note_en: '에서 = at (place of action).' },
      { ko: '그냥', en: 'just', note_en: 'Very common filler word.' },
    ],
    quiz: [
      { type: 'mc', prompt: 'What will they eat?', options: ['라면', '김밥', '떡볶이'], answer: 2 },
      { type: 'mc', prompt: 'When will they meet?', options: ['Saturday 2:00', 'Sunday 2:00', 'Saturday 12:00'], answer: 0 },
      { type: 'listen', prompt: 'Listen and choose.', say: '같이 떡볶이 먹어요', options: ['같이 떡볶이 먹어요', '같이 영화 봐요', '같이 공부해요'], answer: 0 },
      { type: 'order', prompt: 'Put the words in order.', en: 'Let’s meet in front of the school.', words: ['학교', '앞에서', '만나요'] },
    ],
    status: 'published',
  },
];
