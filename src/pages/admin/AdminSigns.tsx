import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { ErrorBox, Loading } from '../../components/ui';
import { useImageSrc } from '../../lib/images';
import type { Sign } from '../../types';
import { SIGN_CATEGORY_LABEL } from './AdminSignEditor';

function Thumb({ image }: { image: string }) {
  const src = useImageSrc(image);
  return <span className="sign-thumb">{src ? <img src={src} alt="" loading="lazy" /> : '📷'}</span>;
}

/** 관리자 › 간판 사진: 학생 화면 「한글 › 간판 읽기」에 나오는 간판 사진과 읽기·뜻·낱말 풀이. */
export default function AdminSigns() {
  const nav = useNavigate();
  const [signs, setSigns] = useState<Sign[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = () =>
    api<Sign[]>('/admin/signs')
      .then((s) => setSigns([...s].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))))
      .catch(setError);
  useEffect(() => {
    load();
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!signs) return <Loading />;

  const create = async () => {
    const g = await api<Sign>('/admin/signs', {
      body: { order: signs.length + 1, category: 'shop', image: '', text: '', roman: '', en: '', note_en: '', words: [], status: 'draft' },
    });
    nav(`/admin/signs/${g.id}`);
  };

  return (
    <div>
      <div className="page-head">
        <h1>간판 사진</h1>
        <button className="btn" onClick={create}>
          + 📷 새 간판 추가
        </button>
      </div>
      <div className="alert alert--info small">
        학생 화면 <b>한글 › 📷 간판 읽기</b>에 나옵니다. 사진은 올리기 전에 이 화면에서 규격(4:3·1:1·3:4·16:9)에 맞게 재단·축소되어 장당 최대 450KB로 저장됩니다.
        <ul>
          <li>직접 찍은 간판 사진을 쓰고, 사람 얼굴·자동차 번호판이 보이면 잘라 내세요.</li>
          <li>상표(로고)보다 일반 낱말(약국·출구·화장실 등)이 들어간 간판이 학습에 좋습니다.</li>
          <li>뜻·설명은 영어로 쓰면 「번역 관리」에서 네팔어·한국어 번역을 넣을 수 있습니다.</li>
        </ul>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>사진</th>
              <th>간판 글자</th>
              <th>뜻 (영어)</th>
              <th>분류</th>
              <th>순서</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {signs.map((g) => (
              <tr key={g.id}>
                <td>
                  <Link to={`/admin/signs/${g.id}`}>
                    <Thumb image={g.image} />
                  </Link>
                </td>
                <td>
                  <Link to={`/admin/signs/${g.id}`}>
                    <b lang="ko">{g.text || '(글자 없음)'}</b>
                  </Link>{' '}
                  <span className="muted small">{g.roman}</span>
                </td>
                <td>{g.en}</td>
                <td>{SIGN_CATEGORY_LABEL[g.category] || g.category}</td>
                <td>{g.order}</td>
                <td>
                  <span className={`badge ${g.status === 'draft' ? '' : 'badge--good'}`}>{g.status === 'draft' ? '초안' : '공개'}</span>
                </td>
                <td className="row-actions">
                  <Link className="btn btn--small" to={`/admin/signs/${g.id}`}>
                    편집
                  </Link>
                  <button
                    className="btn-icon"
                    title="삭제"
                    onClick={async () => {
                      if (!confirm(`「${g.text || g.id}」 간판을 삭제할까요? 올린 사진도 함께 지워집니다.`)) return;
                      await api(`/admin/signs/${g.id}`, { method: 'DELETE' });
                      load();
                    }}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
