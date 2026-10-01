// Prompts and response schemas for Gemini. Pure module (no Node APIs) so it can also run in the browser demo.

export const CHAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ko: { type: 'STRING', description: 'Your reply in Korean' },
    roman: { type: 'STRING', description: 'Revised Romanization of the reply' },
    en: { type: 'STRING', description: 'Natural English translation of the reply' },
    correction: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        original: { type: 'STRING' },
        corrected: { type: 'STRING' },
        explanation_en: { type: 'STRING' },
      },
    },
    hint_en: { type: 'STRING', description: 'Short hint on how the student could reply next' },
    suggestions_ko: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-3 short example replies the student could use' },
  },
  required: ['ko', 'roman', 'en'],
};

export function chatSystemPrompt({ scenario, level, studentName, nativeLang, vocab = [] }) {
  return `You are "Bori (보리)", a cheerful little tiger cub character who tutors Korean to middle and high school students living abroad.
Student: ${studentName || 'a student'} (native/school language: ${nativeLang || 'English'}), level: ${level || 'beginner'}.
Role-play scenario: ${scenario || 'Free conversation about everyday life'}.
${vocab.length ? `Try to reuse these target words naturally: ${vocab.join(', ')}.` : ''}
Rules:
- Stay in the role-play, but keep it friendly, encouraging and age-appropriate (13-18). Never discuss adult, violent, or unsafe topics; gently steer back.
- Reply in SHORT Korean: 1-2 sentences. Beginner = very simple 해요체 sentences with basic vocabulary. Intermediate = natural 해요체.
- Always end with a simple question or prompt so the student keeps talking.
- If the student's last Korean message has a mistake, fill "correction" (original, corrected, short English explanation). Otherwise set correction to null. If they wrote in English, gently show how to say it in Korean in "correction".
- Give 2-3 very short example replies in "suggestions_ko" matching the student's level.
- Explanations and translations must be in English.`;
}

export const PRON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    heard: { type: 'STRING', description: 'What you actually heard, written in Hangul' },
    score: { type: 'INTEGER', description: '0-100 overall pronunciation accuracy' },
    feedback_en: { type: 'STRING', description: 'Two or three friendly sentences of feedback in English' },
    tips: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          syllable: { type: 'STRING' },
          issue_en: { type: 'STRING' },
          how_to_en: { type: 'STRING' },
        },
      },
    },
  },
  required: ['heard', 'score', 'feedback_en', 'tips'],
};

export function pronunciationPrompt(target, roman) {
  return `You are a kind Korean pronunciation coach for teenage learners.
The student tried to say: "${target}"${roman ? ` (romanization: ${roman})` : ''}.
Listen to the audio and evaluate their pronunciation. Focus on: vowel quality (ㅓ vs ㅗ, ㅡ, ㅐ/ㅔ), plain/aspirated/tense consonants (ㄱ/ㅋ/ㄲ etc.), final consonants (받침), and Korean sound-change rules (연음, 비음화 ...).
Be encouraging. Give at most 3 tips, each tied to a specific syllable, with concrete mouth/tongue instructions in simple English.
If the audio is silent or not Korean, set score to 0 and explain kindly.`;
}

export const REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary_ko: { type: 'STRING', description: '교사용 요약 (한국어, 3-4문장)' },
    strengths_ko: { type: 'ARRAY', items: { type: 'STRING' } },
    needs_ko: { type: 'ARRAY', items: { type: 'STRING' } },
    next_steps_ko: { type: 'ARRAY', items: { type: 'STRING' } },
    message_to_student_en: { type: 'STRING', description: 'Short encouraging message to the student in English' },
  },
  required: ['summary_ko', 'strengths_ko', 'needs_ko', 'next_steps_ko', 'message_to_student_en'],
};
