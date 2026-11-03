import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import ImageCropper, { type CropResult } from '../../components/ImageCropper';
import { ErrorBox, Loading, Modal } from '../../components/ui';
import { romanize } from '../../lib/hangul';
import { useImageSrc } from '../../lib/images';
import type { Sign, SignCategory } from '../../types';
import { RowsEditor } from './editors';

export const SIGN_CATEGORY_LABEL: Record<SignCategory, string> = { shop: '가게', food: '음식', transport: '교통', health: '병원·약국', public: '공공장소', other: '기타' };
/** Photos straight from a phone camera are fine (the editor shrinks them); this only stops very large files */
const MAX_INPUT_MB = 25;

export default function AdminSignEditor() {
  const { id = '' } = useParams();
  const [g, setG] = useState<Sign | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const src = useImageSrc(g?.image || '');

  useEffect(() => {
    api<Sign[]>('/admin/signs')
      .then((list) => {
        const found = list.find((x) => x.id === id);
        if (!found) throw new Error('간판을 찾을 수 없습니다');
        setG({ ...found, words: found.words || [] });
      })
      .catch(setError);
  }, [id]);

  if (error) return <ErrorBox error={error} />;
  if (!g) return <Loading />;

  const up = (patch: Partial<Sign>) => {
    setG({ ...g, ...patch });
    setDirty(true);
  };
  const save = async () => {
    if (!g.text.trim()) return setMsg('간판 글자를 입력하세요.');
    if (!g.image) return setMsg('사진을 올려 주세요.');
    try {
      setG(await api(`/admin/signs/${g.id}`, { method: 'PUT', body: g }));
      setDirty(false);
      setMsg('저장되었습니다 ✓ 새로 쓴 영어 문장은 「번역 관리」에서 번역을 넣어 주세요.');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const choose = (f: File) => {
    if (!f.type.startsWith('image/')) return setMsg('사진 파일(JPG·PNG·WebP)을 골라 주세요.');
    if (f.size > MAX_INPUT_MB * 1048576) return setMsg(`사진이 너무 큽니다 (최대 ${MAX_INPUT_MB}MB).`);
    setMsg('');
    setFile(f);
  };
  const cropped = async (r: CropResult) => {
    setFile(null);
    setUploading(true);
    try {
      const res = await api<{ ref: string }>('/admin/images', { body: { data: r.dataUrl } });
      up({ image: res.ref });
      setMsg(`사진을 올렸습니다 (${r.width}×${r.height}px, ${Math.round(r.bytes / 1024)}KB). 「저장」을 눌러 반영하세요.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="editor">
      <Link to="/admin/signs" className="muted small">
        ← 간판 사진
      </Link>
      <div className="page-head sticky-head">
        <h1>
          {g.id} · {g.text || '새 간판'} {dirty && <small className="badge">수정됨</small>}
        </h1>
        <div className="row">
          <span className="muted">{msg}</span>
          <select value={g.status || 'published'} onChange={(e) => up({ status: e.target.value as Sign['status'] })}>
            <option value="published">공개</option>
            <option value="draft">초안</option>
          </select>
          <button className="btn" onClick={save} disabled={!dirty}>
            💾 저장
          </button>
        </div>
      </div>

      <div className="card form sign-editor">
        <div className="sign-editor__photo">
          <div className="sign-img sign-img--big">{src ? <img src={src} alt="" /> : <span className="sign-img__wait">📷</span>}</div>
          <div
            className="vfile__drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) choose(f);
            }}
          >
            <b>📷 사진 {g.image ? '바꾸기' : '올리기'}</b>
            <span className="muted small">JPG·PNG·WebP 사진을 끌어다 놓거나 버튼으로 고르세요. 다음 화면에서 규격에 맞게 재단·회전·밝기 조절 후 작게 줄여서 올립니다.</span>
            <button type="button" className="btn" onClick={() => input.current?.click()} disabled={uploading}>
              {uploading ? '올리는 중…' : '📁 사진 고르기'}
            </button>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) choose(f);
              }}
            />
          </div>
        </div>

        <div className="grid2">
          <label>
            간판 글자 (한국어, 학생이 읽을 글자)
            <input value={g.text} lang="ko" onChange={(e) => up({ text: e.target.value })} placeholder="예: 약국" />
          </label>
          <label>
            로마자 읽기
            <span className="row">
              <input value={g.roman} onChange={(e) => up({ roman: e.target.value })} placeholder={romanize(g.text || '')} />
              <button type="button" className="btn btn--ghost btn--small" onClick={() => up({ roman: romanize(g.text) })}>
                자동
              </button>
            </span>
          </label>
        </div>
        <div className="grid3">
          <label>
            뜻 (영어)
            <input value={g.en} onChange={(e) => up({ en: e.target.value })} placeholder="pharmacy" />
          </label>
          <label>
            분류
            <select value={g.category} onChange={(e) => up({ category: e.target.value as SignCategory })}>
              {(Object.keys(SIGN_CATEGORY_LABEL) as SignCategory[]).map((c) => (
                <option key={c} value={c}>
                  {SIGN_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            순서
            <input type="number" value={g.order} onChange={(e) => up({ order: Number(e.target.value) })} />
          </label>
        </div>
        <label>
          설명·문화 메모 (영어, 선택)
          <textarea rows={2} value={g.note_en || ''} onChange={(e) => up({ note_en: e.target.value })} placeholder="Look for a green cross..." />
        </label>
        <RowsEditor
          title="낱말 풀이 (두 낱말 이상일 때 학생 화면에 표시)"
          rows={g.words}
          onChange={(words) => up({ words })}
          fields={[
            { key: 'ko', label: '낱말 (한국어)' },
            { key: 'roman', label: '로마자 (비우면 자동)' },
            { key: 'en', label: '뜻 (영어)' },
          ]}
          newRow={() => ({ ko: '', roman: '', en: '' })}
        />
      </div>

      <Modal open={!!file} onClose={() => setFile(null)} title="사진 편집·재단" wide>
        {file && <ImageCropper file={file} onDone={cropped} onCancel={() => setFile(null)} />}
      </Modal>
    </div>
  );
}
