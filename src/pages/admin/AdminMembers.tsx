import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, IS_DEMO } from '../../api';
import { ErrorBox, Loading, Modal, fmtDate, fmtDateTime } from '../../components/ui';
import type { Access, Student, Unit, Video } from '../../types';

// 관리자 › 회원·구독 관리: 맛보기(무료) / 정회원(인증 코드·직접 승인), 가입비·구독료 기록, 맛보기 범위.
// 앱 안에는 가격·결제 안내를 넣지 않습니다(Google Play 정책). 결제는 수업/학교에서 받고, 여기서 기록·승인합니다.

type Method = 'cash' | 'transfer' | 'other';
interface Payment {
  id: string;
  studentId: string | null;
  studentName: string;
  months: number;
  amount: number;
  currency: string;
  method: Method;
  paid: boolean;
  note: string;
  code: string | null;
  by: 'code' | 'admin';
  at: string;
}
interface Code {
  code: string;
  months: number;
  amount: number;
  currency: string;
  method: Method;
  paid: boolean;
  note: string;
  createdAt: string;
  usedBy: string | null;
  usedByName?: string;
  usedAt: string | null;
  revoked: boolean;
}
type Row = Student & { access: Access; payments: number; lastPayment: Payment | null; unpaid: number };
type Free = Access['free'];

const METHOD: Record<Method, string> = { cash: '현금', transfer: '계좌이체', other: '기타' };
const MONTHS = [1, 3, 6, 12];

function csv(name: string, header: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number, cur: string) => `${(n || 0).toLocaleString()} ${cur}`;

export default function AdminMembers() {
  const [tab, setTab] = useState<'members' | 'codes' | 'payments' | 'free'>('members');
  const [data, setData] = useState<{ students: Row[]; free: Free; currency: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = () => api('/admin/members').then(setData).catch(setError);
  useEffect(() => {
    load();
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const n = { all: data.students.length, member: data.students.filter((s) => s.access.member).length };
  return (
    <div className="members-admin">
      <div className="page-head">
        <h1>회원·구독 관리</h1>
        <span className="muted small">
          전체 {n.all}명 · 정회원 {n.member}명 · 맛보기 {n.all - n.member}명
        </span>
      </div>
      <p className="muted small">
        누구나 가입해서 <b>맛보기</b>를 이용합니다. 가입비(기본 3개월)를 받으면 <b>인증 코드</b>를 주거나 학생을 직접 <b>정회원으로 승인</b>하세요. 앱 화면에는 가격·결제 방법이 나오지 않고 「선생님께 받은 인증 코드를 입력하세요」라고만 안내됩니다(Google Play 정책).
        {IS_DEMO && ' ※ 데모(GitHub Pages)에서는 이 브라우저 안에서만 코드가 동작합니다. 실제 학생에게 쓰려면 수업 서버가 필요합니다.'}
      </p>
      <div className="tabs" role="tablist">
        {(
          [
            ['members', '👥 회원 목록'],
            ['codes', '🔑 인증 코드'],
            ['payments', '💳 결제 기록'],
            ['free', '🌱 맛보기 범위'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "is-active" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'members' && <Members rows={data.students} currency={data.currency} reload={load} />}
      {tab === 'codes' && <Codes currency={data.currency} />}
      {tab === 'payments' && <Payments onChange={load} />}
      {tab === 'free' && <FreeScope free={data.free} currency={data.currency} onSaved={load} />}
    </div>
  );
}

/* ---------------- 회원 목록 ---------------- */

type Filter = 'all' | 'member' | 'free' | 'soon' | 'expired' | 'unpaid';
const FILTERS: [Filter, string][] = [
  ['all', '전체'],
  ['member', '정회원'],
  ['free', '맛보기'],
  ['soon', '만료 임박(14일)'],
  ['expired', '기간 만료'],
  ['unpaid', '미납 있음'],
];

function status(r: Row) {
  if (r.access.member) return r.access.daysLeft <= 14 ? { cls: 'warn', text: `정회원 · D-${r.access.daysLeft}` } : { cls: 'ok', text: '정회원' };
  if (r.access.expired) return { cls: 'bad', text: '기간 만료' };
  return { cls: '', text: '맛보기' };
}

function Members({ rows, currency, reload }: { rows: Row[]; currency: string; reload: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [grant, setGrant] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row | null>(null);

  const list = useMemo(
    () =>
      rows
        .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.classCode?.toLowerCase().includes(q.toLowerCase()))
        .filter((r) =>
          filter === 'all'
            ? true
            : filter === 'member'
              ? r.access.member
              : filter === 'free'
                ? !r.access.member
                : filter === 'soon'
                  ? r.access.member && r.access.daysLeft <= 14
                  : filter === 'expired'
                    ? r.access.expired
                    : r.unpaid > 0,
        )
        .sort((a, b) => Number(b.access.member) - Number(a.access.member) || (a.access.expiresAt || '').localeCompare(b.access.expiresAt || '') || a.name.localeCompare(b.name)),
    [rows, filter, q],
  );

  const end = async (r: Row) => {
    if (!confirm(`${r.name} 학생의 정회원을 지금 해제할까요? (결제 기록은 남습니다)`)) return;
    await api(`/admin/members/${r.id}/end`, { body: {} });
    reload();
  };

  const exportCsv = () =>
    csv(
      `members-${today()}.csv`,
      ['이름', '반', '가입일', '최근 접속', '등급', '정회원 시작', '만료일', '남은 일수', '결제 횟수', '미납', '최근 결제일', '최근 금액'],
      list.map((r) => [
        r.name,
        r.classCode,
        fmtDate(r.createdAt),
        fmtDate(r.lastActive),
        status(r).text,
        r.membership ? fmtDate(r.membership.since) : '',
        r.access.expiresAt ? fmtDate(r.access.expiresAt) : '',
        r.access.member ? r.access.daysLeft : '',
        r.payments,
        r.unpaid,
        r.lastPayment ? fmtDate(r.lastPayment.at) : '',
        r.lastPayment ? money(r.lastPayment.amount, r.lastPayment.currency) : '',
      ]),
    );

  return (
    <div>
      <div className="row members-admin__bar">
        <div className="chips">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={`chip ${filter === k ? 'chip--solid' : ''}`} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <input placeholder="이름·반 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn--ghost btn--small" onClick={exportCsv}>
          ⬇ CSV
        </button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>이름</th>
              <th>반</th>
              <th>가입일</th>
              <th>등급</th>
              <th>만료일</th>
              <th>결제</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const st = status(r);
              return (
                <tr key={r.id}>
                  <td>
                    <Link to={`/admin/students/${r.id}`}>{r.name}</Link>
                    <div className="muted small">최근 접속 {fmtDate(r.lastActive)}</div>
                  </td>
                  <td>{r.classCode}</td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td>
                    <span className={`status-pill ${st.cls ? `status-pill--${st.cls}` : ''}`}>{st.text}</span>
                  </td>
                  <td>{r.access.expiresAt ? fmtDate(r.access.expiresAt) : '–'}</td>
                  <td>
                    <button className="link-btn" onClick={() => setHistory(r)}>
                      {r.payments}건{r.unpaid > 0 && <b className="text-bad"> · 미납 {r.unpaid}</b>}
                    </button>
                    {r.lastPayment && <div className="muted small">{fmtDate(r.lastPayment.at)} · {money(r.lastPayment.amount, r.lastPayment.currency)}</div>}
                  </td>
                  <td className="row">
                    <button className="btn btn--small" onClick={() => setGrant(r)}>
                      {r.access.member ? '＋ 연장' : '✓ 정회원 승인'}
                    </button>
                    {r.access.member && (
                      <button className="btn btn--ghost btn--small" onClick={() => end(r)}>
                        해제
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr>
                <td colSpan={7} className="muted">
                  해당하는 학생이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {grant && <GrantModal row={grant} currency={currency} onClose={() => setGrant(null)} onDone={() => (setGrant(null), reload())} />}
      {history && <HistoryModal row={history} onClose={() => (setHistory(null), reload())} />}
    </div>
  );
}

/** Payment fields shared by "approve" and "make codes". */
function PayFields({ v, set, currency }: { v: PayForm; set: (v: PayForm) => void; currency: string }) {
  return (
    <div className="form-grid">
      <label>
        이용 기간
        <select value={v.months} onChange={(e) => set({ ...v, months: Number(e.target.value) })}>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}개월{m === 3 ? ' (기본)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        금액 ({currency})
        <input type="number" min={0} value={v.amount} onChange={(e) => set({ ...v, amount: Number(e.target.value) })} />
      </label>
      <label>
        결제 방법
        <select value={v.method} onChange={(e) => set({ ...v, method: e.target.value as Method })}>
          {(Object.keys(METHOD) as Method[]).map((m) => (
            <option key={m} value={m}>
              {METHOD[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={v.paid} onChange={(e) => set({ ...v, paid: e.target.checked })} /> 입금 확인됨
      </label>
      <label className="form-grid__wide">
        메모
        <input value={v.note} maxLength={200} onChange={(e) => set({ ...v, note: e.target.value })} placeholder="예: 3월 반 등록, 영수증 번호" />
      </label>
    </div>
  );
}
interface PayForm {
  months: number;
  amount: number;
  method: Method;
  paid: boolean;
  note: string;
}
const emptyPay = (): PayForm => ({ months: 3, amount: 0, method: 'cash', paid: true, note: '' });

function GrantModal({ row, currency, onClose, onDone }: { row: Row; currency: string; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState(emptyPay);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true);
    try {
      await api(`/admin/members/${row.id}/grant`, { body: { ...v, currency } });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const from = row.access.member && row.access.expiresAt ? new Date(row.access.expiresAt) : new Date();
  const until = new Date(from);
  until.setMonth(until.getMonth() + v.months);
  return (
    <Modal open onClose={onClose} title={`${row.name} — ${row.access.member ? '정회원 연장' : '정회원 승인'}`}>
      <PayFields v={v} set={setV} currency={currency} />
      <p className="small">
        {row.access.member ? `지금 만료일(${fmtDate(row.access.expiresAt)})에서 이어서` : '오늘부터'} <b>{v.months}개월</b> → <b>{until.toLocaleDateString()}</b>까지
      </p>
      {err && <div className="alert alert--error small">{err}</div>}
      <div className="row">
        <button className="btn" onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </button>
        <button className="btn btn--ghost" onClick={onClose}>
          취소
        </button>
      </div>
    </Modal>
  );
}

function HistoryModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const [list, setList] = useState<Payment[] | null>(null);
  useEffect(() => {
    api<Payment[]>(`/admin/members/${row.id}/payments`).then(setList);
  }, [row.id]);
  const togglePaid = async (p: Payment) => {
    const u = await api<Payment>(`/admin/payments/${p.id}`, { method: 'PUT', body: { paid: !p.paid } });
    setList((l) => l!.map((x) => (x.id === p.id ? u : x)));
  };
  return (
    <Modal open onClose={onClose} title={`${row.name} — 결제 기록`} wide>
      {!list ? (
        <Loading />
      ) : !list.length ? (
        <p className="muted">결제 기록이 없습니다.</p>
      ) : (
        <PaymentTable list={list} onToggle={togglePaid} />
      )}
    </Modal>
  );
}

function PaymentTable({ list, onToggle, showName }: { list: Payment[]; onToggle: (p: Payment) => void; showName?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>날짜</th>
            {showName && <th>학생</th>}
            <th>기간</th>
            <th>금액</th>
            <th>방법</th>
            <th>경로</th>
            <th>입금</th>
            <th>메모</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td>{fmtDate(p.at)}</td>
              {showName && <td>{p.studentName}</td>}
              <td>{p.months}개월</td>
              <td>{money(p.amount, p.currency)}</td>
              <td>{METHOD[p.method] || p.method}</td>
              <td>{p.by === 'code' ? `코드 ${p.code}` : '직접 승인'}</td>
              <td>
                <label className="check">
                  <input type="checkbox" checked={p.paid} onChange={() => onToggle(p)} /> {p.paid ? '완료' : <b className="text-bad">미납</b>}
                </label>
              </td>
              <td className="small">{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- 인증 코드 ---------------- */

function Codes({ currency }: { currency: string }) {
  const [list, setList] = useState<Code[] | null>(null);
  const [v, setV] = useState(emptyPay);
  const [count, setCount] = useState(1);
  const [made, setMade] = useState<Code[]>([]);
  const [show, setShow] = useState<'unused' | 'used' | 'revoked' | 'all'>('unused');
  const [err, setErr] = useState('');
  const load = () => api<Code[]>('/admin/codes').then(setList);
  useEffect(() => {
    load();
  }, []);

  const make = async () => {
    setErr('');
    try {
      const r = await api<Code[]>('/admin/codes', { body: { ...v, currency, count } });
      setMade(r);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const revoke = async (c: Code, revoked: boolean) => {
    try {
      await api(`/admin/codes/${c.code}`, { method: 'PUT', body: { revoked } });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});

  const shown = (list || []).filter((c) => (show === 'all' ? true : show === 'used' ? c.usedBy : show === 'revoked' ? c.revoked : !c.usedBy && !c.revoked));
  const exportCsv = () =>
    csv(
      `codes-${today()}.csv`,
      ['코드', '기간(개월)', '금액', '통화', '방법', '입금 확인', '메모', '만든 날', '상태', '사용 학생', '사용일'],
      shown.map((c) => [c.code, c.months, c.amount, c.currency, METHOD[c.method], c.paid ? 'Y' : 'N', c.note, fmtDate(c.createdAt), c.usedBy ? '사용됨' : c.revoked ? '취소' : '미사용', c.usedByName || '', c.usedAt ? fmtDate(c.usedAt) : '']),
    );

  return (
    <div>
      <section className="card">
        <h3>새 인증 코드 만들기</h3>
        <p className="muted small">학생에게 코드를 전하면(종이, 메시지 등) 학생이 앱의 「나의 학습 › 인증 코드」에 입력해 정회원이 됩니다. 이미 정회원이면 남은 기간에 이어서 연장됩니다. 코드는 한 번만 쓸 수 있습니다.</p>
        <PayFields v={v} set={setV} currency={currency} />
        <div className="row">
          <label>
            개수{' '}
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} style={{ width: 80 }} />
          </label>
          <button className="btn" onClick={make}>
            🔑 코드 만들기
          </button>
        </div>
        {err && <div className="alert alert--error small">{err}</div>}
        {made.length > 0 && (
          <div className="alert alert--success">
            <b>새 코드 {made.length}개</b> ({made[0].months}개월)
            <div className="code-list">
              {made.map((c) => (
                <code key={c.code}>{c.code}</code>
              ))}
            </div>
            <button className="btn btn--small btn--ghost" onClick={() => copy(made.map((c) => c.code).join('\n'))}>
              📋 모두 복사
            </button>
          </div>
        )}
      </section>

      <div className="row members-admin__bar">
        <div className="chips">
          {(
            [
              ['unused', '미사용'],
              ['used', '사용됨'],
              ['revoked', '취소됨'],
              ['all', '전체'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={`chip ${show === k ? 'chip--solid' : ''}`} onClick={() => setShow(k)}>
              {label} {list ? `(${(list || []).filter((c) => (k === 'all' ? true : k === 'used' ? c.usedBy : k === 'revoked' ? c.revoked : !c.usedBy && !c.revoked)).length})` : ''}
            </button>
          ))}
        </div>
        <button className="btn btn--ghost btn--small" onClick={exportCsv}>
          ⬇ CSV
        </button>
      </div>
      {!list ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>코드</th>
                <th>기간</th>
                <th>금액·방법</th>
                <th>만든 날</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.code} className={c.revoked ? 'is-locked' : ''}>
                  <td>
                    <code>{c.code}</code>
                    {c.note && <div className="muted small">{c.note}</div>}
                  </td>
                  <td>{c.months}개월</td>
                  <td>
                    {money(c.amount, c.currency)} · {METHOD[c.method]}
                    {!c.paid && <b className="text-bad"> · 미납</b>}
                  </td>
                  <td>{fmtDate(c.createdAt)}</td>
                  <td>{c.usedBy ? `✅ ${c.usedByName || ''} (${fmtDateTime(c.usedAt)})` : c.revoked ? '취소됨' : '미사용'}</td>
                  <td className="row">
                    {!c.usedBy && !c.revoked && (
                      <>
                        <button className="btn btn--ghost btn--small" onClick={() => copy(c.code)}>
                          📋
                        </button>
                        <button className="btn btn--ghost btn--small" onClick={() => revoke(c, true)}>
                          취소
                        </button>
                      </>
                    )}
                    {c.revoked && (
                      <button className="btn btn--ghost btn--small" onClick={() => revoke(c, false)}>
                        되살리기
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={6} className="muted">
                    코드가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- 결제 기록 ---------------- */

function Payments({ onChange }: { onChange: () => void }) {
  const [list, setList] = useState<Payment[] | null>(null);
  const [month, setMonth] = useState(''); // YYYY-MM
  useEffect(() => {
    api<Payment[]>('/admin/payments').then(setList);
  }, []);
  if (!list) return <Loading />;
  const months = [...new Set(list.map((p) => p.at.slice(0, 7)))].sort().reverse();
  const shown = list.filter((p) => !month || p.at.startsWith(month));
  const totals = shown.reduce<Record<string, { paid: number; unpaid: number }>>((t, p) => {
    const k = p.currency || '';
    t[k] ||= { paid: 0, unpaid: 0 };
    t[k][p.paid ? 'paid' : 'unpaid'] += p.amount || 0;
    return t;
  }, {});
  const toggle = async (p: Payment) => {
    const u = await api<Payment>(`/admin/payments/${p.id}`, { method: 'PUT', body: { paid: !p.paid } });
    setList((l) => l!.map((x) => (x.id === p.id ? u : x)));
    onChange();
  };
  return (
    <div>
      <div className="row members-admin__bar">
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">전체 기간</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="small">
          {Object.entries(totals).map(([cur, t]) => (
            <span key={cur}>
              입금 <b>{money(t.paid, cur)}</b>
              {t.unpaid > 0 && <b className="text-bad"> · 미납 {money(t.unpaid, cur)}</b>}{' '}
            </span>
          ))}
        </span>
        <button
          className="btn btn--ghost btn--small"
          onClick={() =>
            csv(
              `payments-${month || 'all'}.csv`,
              ['날짜', '학생', '기간(개월)', '금액', '통화', '방법', '경로', '코드', '입금 확인', '메모'],
              shown.map((p) => [fmtDate(p.at), p.studentName, p.months, p.amount, p.currency, METHOD[p.method], p.by === 'code' ? '인증 코드' : '직접 승인', p.code, p.paid ? 'Y' : 'N', p.note]),
            )
          }
        >
          ⬇ CSV
        </button>
      </div>
      {shown.length ? <PaymentTable list={shown} onToggle={toggle} showName /> : <p className="muted">결제 기록이 없습니다.</p>}
    </div>
  );
}

/* ---------------- 맛보기 범위 ---------------- */

function FreeScope({ free, currency, onSaved }: { free: Free; currency: string; onSaved: () => void }) {
  const [v, setV] = useState(free);
  const [cur, setCur] = useState(currency);
  const [units, setUnits] = useState<Unit[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api<Unit[]>('/admin/units').then((u) => setUnits(u.sort((a, b) => a.order - b.order)));
    api<Video[]>('/admin/videos').then((l) => setVideos(l.sort((a, b) => a.order - b.order)));
  }, []);
  const toggle = (key: 'units' | 'videos', id: string) => setV({ ...v, [key]: v[key].includes(id) ? v[key].filter((x) => x !== id) : [...v[key], id] });
  const save = async (body: object) => {
    await api('/admin/free-access', { method: 'PUT', body });
    setMsg('저장했습니다. 학생 화면에 바로 반영됩니다.');
    onSaved();
  };
  const num = (k: 'signs' | 'topikQuestions' | 'aiPerDay', label: string, hint: string) => (
    <label>
      {label}
      <input type="number" min={0} value={v[k]} onChange={(e) => setV({ ...v, [k]: Math.max(0, Number(e.target.value) || 0) })} />
      <small className="muted">{hint}</small>
    </label>
  );
  return (
    <div className="card">
      <h3>맛보기(무료 회원)에서 열어 둘 부분</h3>
      <p className="muted small">한글 연구소(모음·자음·글자 만들기), 복습, 오늘의 학습, 발음 연습(기기 음성 인식)은 맛보기에서도 항상 열려 있습니다. AI 발음 코치는 정회원 전용입니다.</p>
      <h4>레슨 단원</h4>
      <div className="chips">
        {units.map((u) => (
          <label key={u.id} className={`chip ${v.units.includes(u.id) ? 'chip--solid' : ''}`}>
            <input type="checkbox" hidden checked={v.units.includes(u.id)} onChange={() => toggle('units', u.id)} />
            {v.units.includes(u.id) ? '✓ ' : ''}
            {u.emoji} {u.title.ko}
          </label>
        ))}
      </div>
      <h4>드라마·영상·노래</h4>
      <div className="chips">
        {videos.map((x) => (
          <label key={x.id} className={`chip ${v.videos.includes(x.id) ? 'chip--solid' : ''}`}>
            <input type="checkbox" hidden checked={v.videos.includes(x.id)} onChange={() => toggle('videos', x.id)} />
            {v.videos.includes(x.id) ? '✓ ' : ''}
            {x.kind === 'song' ? '🎵' : x.kind === 'video' ? '📺' : '🎬'} {x.title.ko}
          </label>
        ))}
      </div>
      <div className="form-grid">
        {num('signs', '간판 사진 (앞에서부터 N장)', '나머지는 🔒로 표시')}
        {num('topikQuestions', 'TOPIK (각 회차 앞 N문항)', '연습 모드만, 0 = 잠금')}
        {num('aiPerDay', 'AI 대화 (하루 N번)', '0 = 잠금')}
        <label>
          통화 (결제 기록)
          <input value={cur} maxLength={8} onChange={(e) => setCur(e.target.value.toUpperCase())} placeholder="NPR" />
          <small className="muted">예: NPR, KRW, USD</small>
        </label>
      </div>
      <div className="row">
        <button className="btn" onClick={() => save({ ...v, currency: cur })}>
          저장
        </button>
        <button className="btn btn--ghost" onClick={() => confirm('추천 기본값(예비편+1단원, 드라마 1·노래 1, 간판 3장, TOPIK 10문항, AI 하루 3번)으로 되돌릴까요?') && save({ currency: cur }).then(() => location.reload())}>
          추천 기본값으로
        </button>
      </div>
      {msg && <div className="alert alert--success small">{msg}</div>}
    </div>
  );
}
