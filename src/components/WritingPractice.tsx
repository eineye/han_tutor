import { useEffect, useRef, useState } from 'react';
import { speak } from '../lib/speech';
import { useI18n } from '../i18n';

interface Item {
  text: string;
  roman?: string;
  en?: string;
}

const BOX = 180; // px per character box

/**
 * Tracing practice (쓰기): a faint guide letter in each box, the student traces it
 * with a finger, pen or mouse. Mirrors the textbook's "다음을 써 보세요" pages.
 */
export default function WritingPractice({ items, tip, onDone }: { items: Item[]; tip?: string; onDone?: () => void }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [traced, setTraced] = useState<Record<number, boolean>>({});
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(0);
  const item = items[idx];
  const chars = [...(item?.text || '')];
  const width = Math.max(1, chars.length) * BOX;

  // Redraw the guide whenever the item or the guide toggle changes
  useEffect(() => {
    const c = canvas.current;
    if (!c || !item) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = BOX * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintGuide(ctx, chars, showGuide);
    inked.current = 0;
    // Repaint once the Korean web font has loaded so the guide uses it
    let live = true;
    document.fonts?.ready.then(() => {
      if (live && inked.current === 0) paintGuide(ctx, chars, showGuide);
    });
    return () => {
      live = false;
    };
  }, [idx, showGuide, width]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return <p className="muted">{t('writing.none')}</p>;

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * BOX };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ff7a59';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    inked.current++;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (inked.current > 8 && !traced[idx]) setTraced((prev) => ({ ...prev, [idx]: true }));
  };

  const clear = () => {
    const ctx = canvas.current!.getContext('2d')!;
    paintGuide(ctx, chars, showGuide);
    inked.current = 0;
  };

  const doneCount = Object.keys(traced).length;

  return (
    <div className="writing">
      {tip && <p className="focus">✍️ {tip}</p>}
      <div className="writing__head">
        <div>
          <span className="ko-big" lang="ko">
            {item.text}
          </span>{' '}
          {item.roman && <span className="roman">{item.roman}</span>} {item.en && <span className="muted">· {item.en}</span>}
        </div>
        <button className="btn-icon" onClick={() => speak(item.text, { rate: 0.7 })} aria-label={t('common.listen')}>
          🔊
        </button>
      </div>
      <div className="writing__pad">
        <canvas
          ref={canvas}
          style={{ width: '100%', maxWidth: width, aspectRatio: `${chars.length || 1} / 1` }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label={`${t('sec.writing')}: ${item.text}`}
        />
      </div>
      <div className="row writing__controls">
        <button className="btn-icon" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label={t('common.prev')}>
          ◀
        </button>
        <span className="small">
          {idx + 1} / {items.length}
        </span>
        <button className="btn-icon" disabled={idx === items.length - 1} onClick={() => setIdx(idx + 1)} aria-label={t('common.next')}>
          ▶
        </button>
        <button className="btn btn--ghost btn--small" onClick={clear}>
          ↺ {t('writing.clear')}
        </button>
        <label className="toggle">
          <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} />
          <span className="toggle__track" />
          <span>{t('writing.guide')}</span>
        </label>
        <span className="spacer" />
        <span className="small muted">
          {t('writing.traced', { n: doneCount, total: items.length })}
        </span>
        {onDone && doneCount >= Math.min(items.length, 3) && (
          <button className="btn btn--small" onClick={onDone}>
            {t('common.done')} ✓
          </button>
        )}
      </div>
      <div className="writing__chips">
        {items.map((it, i) => (
          <button key={i} className={`chip ${i === idx ? 'chip--solid' : ''}`} onClick={() => setIdx(i)} lang="ko">
            {traced[i] ? '✓ ' : ''}
            {it.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function paintGuide(ctx: CanvasRenderingContext2D, chars: string[], showGuide: boolean) {
  const css = getComputedStyle(document.documentElement);
  const line = css.getPropertyValue('--line').trim() || '#e5d8cb';
  const muted = css.getPropertyValue('--muted').trim() || '#999';
  const w = chars.length * BOX;
  ctx.clearRect(0, 0, w, BOX);
  // box grid like a writing notebook (원고지)
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  for (let i = 0; i < chars.length; i++) ctx.strokeRect(i * BOX + 1, 1, BOX - 2, BOX - 2);
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1;
  for (let i = 0; i < chars.length; i++) {
    ctx.beginPath();
    ctx.moveTo(i * BOX + BOX / 2, 6);
    ctx.lineTo(i * BOX + BOX / 2, BOX - 6);
    ctx.moveTo(i * BOX + 6, BOX / 2);
    ctx.lineTo(i * BOX + BOX - 6, BOX / 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (!showGuide) return;
  ctx.fillStyle = muted;
  ctx.globalAlpha = 0.28;
  ctx.font = `700 ${BOX * 0.72}px 'Noto Sans KR', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((ch, i) => ch.trim() && ctx.fillText(ch, i * BOX + BOX / 2, BOX / 2 + BOX * 0.04));
  ctx.globalAlpha = 1;
}
