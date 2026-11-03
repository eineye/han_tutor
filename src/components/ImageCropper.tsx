import { useEffect, useRef, useState } from 'react';

// Photo editor for sign pictures (teacher): pick a fixed size, move / zoom / rotate the photo inside the frame,
// and get a small JPEG. Everything happens in the browser, so the server only ever receives small files.

export interface CropPreset {
  id: string;
  label: string;
  w: number;
  h: number;
}
export const CROP_PRESETS: CropPreset[] = [
  { id: '4:3', label: '가로 4:3 (1200×900, 기본)', w: 1200, h: 900 },
  { id: '1:1', label: '정사각형 1:1 (1000×1000)', w: 1000, h: 1000 },
  { id: '3:4', label: '세로 3:4 (900×1200)', w: 900, h: 1200 },
  { id: '16:9', label: '와이드 16:9 (1280×720)', w: 1280, h: 720 },
];
/** Keep every upload under this (the server refuses more than 600KB). */
export const MAX_OUTPUT_BYTES = 450 * 1024;

export interface CropResult {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

const bytesOf = (dataUrl: string) => Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

/** JPEG at the highest quality that fits MAX_OUTPUT_BYTES. */
export function encodeJpeg(canvas: HTMLCanvasElement): CropResult {
  let q = 0.86;
  let url = canvas.toDataURL('image/jpeg', q);
  while (bytesOf(url) > MAX_OUTPUT_BYTES && q > 0.42) {
    q -= 0.08;
    url = canvas.toDataURL('image/jpeg', q);
  }
  return { dataUrl: url, width: canvas.width, height: canvas.height, bytes: bytesOf(url) };
}

export default function ImageCropper({ file, onDone, onCancel }: { file: File; onDone: (r: CropResult) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState(CROP_PRESETS[0]);
  const [rot, setRot] = useState(0); // 0, 90, 180, 270
  const [zoom, setZoom] = useState(1); // 1 = the photo just covers the frame
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset of the photo centre from the frame centre, in output pixels
  const [bright, setBright] = useState(100);
  const view = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setError('사진을 열 수 없습니다. JPG·PNG·WebP 사진을 골라 주세요.');
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // photo size after rotation, and the scale at which it covers the output frame
  const turned = rot % 180 !== 0;
  const iw = img ? (turned ? img.naturalHeight : img.naturalWidth) : 1;
  const ih = img ? (turned ? img.naturalWidth : img.naturalHeight) : 1;
  const cover = Math.max(preset.w / iw, preset.h / ih);
  const scale = cover * zoom;
  // keep the frame filled: limit how far the photo can move
  const maxX = Math.max(0, (iw * scale - preset.w) / 2);
  const maxY = Math.max(0, (ih * scale - preset.h) / 2);
  const clamp = (p: { x: number; y: number }) => ({ x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) });
  const at = clamp(pos);

  /** Draws the cropped photo onto a canvas of width w (the frame's aspect). */
  const draw = (c: HTMLCanvasElement, w: number) => {
    if (!img) return;
    const k = w / preset.w;
    c.width = Math.round(w);
    c.height = Math.round(preset.h * k);
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.save();
    g.filter = bright !== 100 ? `brightness(${bright}%)` : 'none';
    g.translate(c.width / 2 + at.x * k, c.height / 2 + at.y * k);
    g.rotate((rot * Math.PI) / 180);
    const s = scale * k;
    g.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    g.restore();
  };

  useEffect(() => {
    if (view.current) draw(view.current, Math.min(560, view.current.parentElement?.clientWidth || 560));
  });

  const start = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: at.x, py: at.y };
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !view.current) return;
    const k = preset.w / view.current.getBoundingClientRect().width; // screen px → output px
    setPos(clamp({ x: drag.current.px + (e.clientX - drag.current.x) * k, y: drag.current.py + (e.clientY - drag.current.y) * k }));
  };

  const finish = () => {
    const c = document.createElement('canvas');
    draw(c, preset.w);
    onDone(encodeJpeg(c));
  };

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!img) return <p className="muted">사진을 여는 중…</p>;

  return (
    <div className="cropper">
      <div className="cropper__view">
        <canvas ref={view} onPointerDown={start} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)} aria-label="사진 위치 (끌어서 옮기기)" />
      </div>
      <p className="muted small">
        원본 {img.naturalWidth}×{img.naturalHeight}px · 사진을 끌어서 위치를 맞추고, 확대·회전한 뒤 「이대로 사용」을 누르세요. 결과는 {preset.w}×{preset.h}px JPEG(최대 {Math.round(MAX_OUTPUT_BYTES / 1024)}KB)로 줄여서 올립니다.
      </p>
      <div className="cropper__controls">
        <label>
          규격
          <select
            value={preset.id}
            onChange={(e) => {
              setPreset(CROP_PRESETS.find((p) => p.id === e.target.value)!);
              setPos({ x: 0, y: 0 });
            }}
          >
            {CROP_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          확대 {Math.round(zoom * 100)}%
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        <label>
          밝기 {bright}%
          <input type="range" min={70} max={140} step={5} value={bright} onChange={(e) => setBright(Number(e.target.value))} />
        </label>
        <div className="row">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => (setRot((r) => (r + 270) % 360), setPos({ x: 0, y: 0 }))}>
            ⟲ 왼쪽 회전
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => (setRot((r) => (r + 90) % 360), setPos({ x: 0, y: 0 }))}>
            ⟳ 오른쪽 회전
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => (setZoom(1), setPos({ x: 0, y: 0 }), setBright(100))}>
            ↺ 처음대로
          </button>
        </div>
      </div>
      <div className="row cropper__actions">
        <button type="button" className="btn" onClick={finish}>
          ✓ 이대로 사용
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}
