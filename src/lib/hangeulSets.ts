// Letters used by the Hangeul Lab (student) and the teacher's recording list.

export const VOWELS: { c: string; r: string }[] = [
  ['ㅏ', 'a'], ['ㅑ', 'ya'], ['ㅓ', 'eo'], ['ㅕ', 'yeo'], ['ㅗ', 'o'], ['ㅛ', 'yo'], ['ㅜ', 'u'], ['ㅠ', 'yu'], ['ㅡ', 'eu'], ['ㅣ', 'i'],
  ['ㅐ', 'ae'], ['ㅒ', 'yae'], ['ㅔ', 'e'], ['ㅖ', 'ye'], ['ㅘ', 'wa'], ['ㅙ', 'wae'], ['ㅚ', 'oe'], ['ㅝ', 'wo'], ['ㅞ', 'we'], ['ㅟ', 'wi'], ['ㅢ', 'ui'],
].map(([c, r]) => ({ c, r }));

// name = the letter's Korean name (기역, 니은 …)
export const CONSONANTS: { c: string; r: string; name: string; group: 'basic' | 'aspirated' | 'tense' }[] = [
  ['ㄱ', 'g/k', '기역', 'basic'], ['ㄴ', 'n', '니은', 'basic'], ['ㄷ', 'd/t', '디귿', 'basic'], ['ㄹ', 'r/l', '리을', 'basic'], ['ㅁ', 'm', '미음', 'basic'],
  ['ㅂ', 'b/p', '비읍', 'basic'], ['ㅅ', 's', '시옷', 'basic'], ['ㅇ', '–/ng', '이응', 'basic'], ['ㅈ', 'j', '지읒', 'basic'], ['ㅎ', 'h', '히읗', 'basic'],
  ['ㅋ', 'k', '키읔', 'aspirated'], ['ㅌ', 't', '티읕', 'aspirated'], ['ㅍ', 'p', '피읖', 'aspirated'], ['ㅊ', 'ch', '치읓', 'aspirated'],
  ['ㄲ', 'kk', '쌍기역', 'tense'], ['ㄸ', 'tt', '쌍디귿', 'tense'], ['ㅃ', 'pp', '쌍비읍', 'tense'], ['ㅆ', 'ss', '쌍시옷', 'tense'], ['ㅉ', 'jj', '쌍지읒', 'tense'],
].map(([c, r, name, group]) => ({ c, r, name, group: group as 'basic' | 'aspirated' | 'tense' }));

/** Minimal-pair sets for comparing plain / aspirated / tense consonants */
export const PAIRS = ['가 카 까', '다 타 따', '바 파 빠', '자 차 짜', '사 싸'];
