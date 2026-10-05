// Corrections for vocabulary pictures that did not match the word. Applied when the stored emoji
// is still the old one (so lessons saved before the fix are corrected too, and a teacher's own
// choice is never overridden). Key: "word|old emoji" → better emoji.
export const EMOJI_FIXES = {
  '우리|🫶': '🧑‍🤝‍🧑',
  '웨이터|🧑‍🍳': '🤵',
  '밤|🌙': '🌃',
  '매점|🍙': '🏪',
  '의자|💺': '🪑',
  '따다|🍎': '🍒',
  '기자|📰': '🎙️',
  '학생|🎒': '🧑‍🎓',
  '중학생|🧑‍🎓': '🧒',
};

export const fixEmoji = (word, emoji) => EMOJI_FIXES[`${word}|${emoji}`] || emoji;
