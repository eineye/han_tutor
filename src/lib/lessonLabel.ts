/** Textbook-style label for a lesson id: L00 → 예비편, L07 → 7과. */
export function lessonLabel(id: string): string {
  if (id === 'L00') return '예비편';
  const lesson = /^L(\d{2})$/.exec(id);
  if (lesson) return `${Number(lesson[1])}과`;
  // Review lessons (R1–R5) already say 연습 활용 in their title
  return '';
}
