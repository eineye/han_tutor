// Sign reading (한글 › 간판 읽기) sample signs.
// The pictures are ORIGINAL drawings made here as SVG (no photos of real shops, brands or people).
// Teachers replace or add real photos in Admin > 간판 사진 (cropped and shrunk in the browser first).

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A signboard drawing as an SVG data URL (1200×900, 4:3 like the teacher photo format).
 * @param {{text: string, bg: string, fg: string, wall?: string, sub?: string, icon?: string, shape?: 'board'|'round'|'plate'}} o
 */
function signSvg({ text, bg, fg, wall = '#e9e1d6', sub = '', icon = '', shape = 'board' }) {
  const size = Math.round((text.length <= 2 ? 250 : text.length <= 3 ? 210 : text.length <= 5 ? 160 : 120) * (icon ? 0.84 : 1));
  // where the icon, text and small line sit (inside the board for each shape)
  const pos = shape === 'plate' ? { icon: 300, text: 492, sub: 620 } : shape === 'round' ? { icon: 250, text: 450, sub: 600 } : { icon: 262, text: 462, sub: 618 };
  const board =
    shape === 'round'
      ? `<circle cx="600" cy="430" r="300" fill="${bg}" stroke="#00000022" stroke-width="16"/>`
      : shape === 'plate'
        ? `<rect x="170" y="230" width="860" height="420" rx="40" fill="${bg}" stroke="#ffffff" stroke-width="18"/><rect x="150" y="210" width="900" height="460" rx="52" fill="none" stroke="#00000030" stroke-width="10"/>`
        : `<rect x="90" y="180" width="1020" height="500" rx="28" fill="${bg}"/><rect x="90" y="180" width="1020" height="500" rx="28" fill="none" stroke="#00000033" stroke-width="14"/><rect x="250" y="680" width="20" height="160" fill="#8a7a6a"/><rect x="930" y="680" width="20" height="160" fill="#8a7a6a"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
<rect width="1200" height="900" fill="${wall}"/>
<rect y="760" width="1200" height="140" fill="#00000012"/>
${board}
${icon ? `<text x="600" y="${pos.icon}" font-size="100" text-anchor="middle" dominant-baseline="middle">${esc(icon)}</text>` : ''}
<text x="600" y="${icon ? pos.text : 430}" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-weight="900" font-size="${size}" fill="${fg}" text-anchor="middle" dominant-baseline="middle">${esc(text)}</text>
${sub ? `<text x="600" y="${icon ? pos.sub : 600}" font-family="Arial,sans-serif" font-weight="700" font-size="56" fill="${fg}" opacity="0.85" text-anchor="middle" dominant-baseline="middle">${esc(sub)}</text>` : ''}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const sign = (id, order, category, text, roman, en, note_en, words, look) => ({
  id,
  order,
  category,
  image: signSvg({ text, ...look }),
  text,
  roman,
  en,
  note_en,
  words,
  status: 'published',
});

export const SIGN_CATEGORIES = ['shop', 'food', 'transport', 'health', 'public', 'other'];

export const seedSigns = [
  sign('SG1', 1, 'health', '약국', 'yakguk', 'pharmacy', 'Look for a green cross or the big word 약 (medicine).', [{ ko: '약', roman: 'yak', en: 'medicine' }, { ko: '국', roman: 'guk', en: 'office / shop (in names)' }], { bg: '#1f9d55', fg: '#ffffff', icon: '➕', sub: 'PHARMACY' }),
  sign('SG2', 2, 'shop', '편의점', 'pyeonuijeom', 'convenience store', 'Open 24 hours on almost every corner. 의 here sounds like [이].', [{ ko: '편의', roman: 'pyeonui', en: 'convenience' }, { ko: '점', roman: 'jeom', en: 'store' }], { bg: '#2c5bd6', fg: '#ffffff', sub: '24' }),
  sign('SG3', 3, 'public', '출구', 'chulgu', 'exit', 'In the subway, every exit has a number: 1번 출구 = Exit 1.', [{ ko: '출', roman: 'chul', en: 'go out' }, { ko: '구', roman: 'gu', en: 'opening, mouth' }], { bg: '#ffd400', fg: '#1b1b1b', icon: '🚪', sub: 'EXIT', shape: 'plate' }),
  sign('SG4', 4, 'public', '화장실', 'hwajangsil', 'restroom', 'Very useful! Ask: 화장실이 어디에 있어요?', [{ ko: '화장', roman: 'hwajang', en: 'make-up' }, { ko: '실', roman: 'sil', en: 'room' }], { bg: '#4b5563', fg: '#ffffff', icon: '🚻', shape: 'plate' }),
  sign('SG5', 5, 'food', '카페', 'kape', 'café', 'A loanword from English “café”. Korea has cafés everywhere.', [{ ko: '카페', roman: 'kape', en: 'café' }], { bg: '#6f4e37', fg: '#fff3e0', icon: '☕' }),
  sign('SG6', 6, 'transport', '버스 정류장', 'beoseu jeongnyujang', 'bus stop', '정류장 sounds like [정뉴장]. The screen shows when the next bus comes.', [{ ko: '버스', roman: 'beoseu', en: 'bus' }, { ko: '정류장', roman: 'jeongnyujang', en: 'stop, station' }], { bg: '#0ea5e9', fg: '#ffffff', icon: '🚌', shape: 'plate' }),
  sign('SG7', 7, 'food', '분식', 'bunsik', 'snack restaurant', 'A cheap snack restaurant: 떡볶이, 김밥, 라면.', [{ ko: '분식', roman: 'bunsik', en: 'flour-based snacks' }], { bg: '#e0384a', fg: '#ffffff', sub: '떡볶이 · 김밥 · 라면' }),
  sign('SG8', 8, 'transport', '지하철', 'jihacheol', 'subway', 'Each subway line in Seoul has its own color and number.', [{ ko: '지하', roman: 'jiha', en: 'underground' }, { ko: '철', roman: 'cheol', en: 'iron (railway)' }], { bg: '#16a34a', fg: '#ffffff', icon: '🚇', shape: 'round' }),
];
