// Original flat icons (36×36, same proportions as the emoji set) for Korean things that have no
// accurate emoji: 한복 is not a kimono, 한옥 is not a castle, 김밥 is not an onigiri, and so on.
import type { ReactElement } from 'react';

const S = (children: ReactElement) => (
  <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    {children}
  </svg>
);

export const KOREAN_ICONS: Record<string, ReactElement> = {
  // 한복: short jeogori jacket with a bow (goreum) over a full chima skirt
  hanbok: S(
    <g>
      <path d="M9 34 L13 15 H23 L27 34 Z" fill="#E8457C" />
      <path d="M12 34 L14.5 18 H21.5 L24 34 Z" fill="#F06A97" opacity=".6" />
      <path d="M10.5 9 Q18 6 25.5 9 L27 16 Q18 18.5 9 16 Z" fill="#FFD23F" />
      <path d="M15 8.2 L18 13 L21 8.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10.5 9 L6.5 15 L9.5 16.5 L12 12" fill="#FFD23F" />
      <path d="M25.5 9 L29.5 15 L26.5 16.5 L24 12" fill="#FFD23F" />
      <path d="M6.5 15 L9.5 16.5" stroke="#3B88C3" strokeWidth="1.6" />
      <path d="M29.5 15 L26.5 16.5" stroke="#3B88C3" strokeWidth="1.6" />
      <path d="M18 13.5 L14 21 M18 13.5 L20.5 22" stroke="#C1272D" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18" cy="13.5" r="1.4" fill="#C1272D" />
      <circle cx="18" cy="4.2" r="3.2" fill="#FFCC9A" />
      <path d="M14.8 3.8 Q18 -0.5 21.2 3.8 Q18 2.6 14.8 3.8 Z" fill="#292F33" />
    </g>,
  ),
  // 한옥: curved tiled roof with upturned eaves, wooden posts and paper doors
  hanok: S(
    <g>
      <path d="M2 14 Q6 15.5 8 12 H28 Q30 15.5 34 14 Q31 10 28 9 H8 Q5 10 2 14 Z" fill="#3F4A56" />
      <path d="M8 12 H28" stroke="#66757F" strokeWidth="1.2" />
      <path d="M10 9 Q18 4 26 9 Z" fill="#55626E" />
      <rect x="7" y="14" width="22" height="16" fill="#F4E3C3" />
      <rect x="7" y="14" width="2.2" height="16" fill="#8A5A3C" />
      <rect x="26.8" y="14" width="2.2" height="16" fill="#8A5A3C" />
      <rect x="16.9" y="14" width="2.2" height="16" fill="#8A5A3C" />
      <g stroke="#B88B5C" strokeWidth=".9">
        <path d="M10.5 17 H15.5 V27 H10.5 Z M13 17 V27 M10.5 22 H15.5" fill="none" />
        <path d="M20.5 17 H25.5 V27 H20.5 Z M23 17 V27 M20.5 22 H25.5" fill="none" />
      </g>
      <rect x="4" y="30" width="28" height="3" rx="1" fill="#A7A9AC" />
    </g>,
  ),
  // 한글: a letter tile showing 가
  hangeul: S(
    <g>
      <rect x="3" y="3" width="30" height="30" rx="6" fill="#3B88C3" />
      <rect x="5.5" y="5.5" width="25" height="25" rx="4" fill="#fff" />
      <path d="M9.5 11 H17 Q17 19 10 25" fill="none" stroke="#292F33" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22.5 9 V27 M22.5 17.5 H27" fill="none" stroke="#DD2E44" strokeWidth="3" strokeLinecap="round" />
    </g>,
  ),
  // 김치: napa cabbage with red pepper seasoning in a bowl
  kimchi: S(
    <g>
      <path d="M4 19 H32 Q31 31 18 32 Q5 31 4 19 Z" fill="#E1E8ED" />
      <path d="M4 19 H32" stroke="#AAB8C2" strokeWidth="1.2" />
      <path d="M7 19 Q8 9 15 8 Q13 14 14 19 Z" fill="#E8F5C8" />
      <path d="M12 19 Q13 6 21 5 Q18 12 19.5 19 Z" fill="#F3F9DC" />
      <path d="M18 19 Q21 8 29 9 Q25 13 26 19 Z" fill="#E8F5C8" />
      <path d="M7 19 Q8 9 15 8 Q13 14 14 19 M12 19 Q13 6 21 5 Q18 12 19.5 19 M18 19 Q21 8 29 9 Q25 13 26 19" fill="#E0331A" opacity=".55" />
      <path d="M9 12 Q11 10 13 11 M16 9 Q18 7 20 8 M22 12 Q24 10 26 11" stroke="#77B255" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g fill="#C1272D">
        <circle cx="10" cy="16" r=".8" /><circle cx="16" cy="14" r=".8" /><circle cx="23" cy="16" r=".8" /><circle cx="19" cy="11" r=".7" />
      </g>
    </g>,
  ),
  // 떡볶이: cylinder rice cakes and fish cake in red sauce, with a pick
  tteokbokki: S(
    <g>
      <ellipse cx="18" cy="21" rx="15" ry="9" fill="#E1E8ED" />
      <ellipse cx="18" cy="20" rx="13" ry="7" fill="#D62E1F" />
      <g fill="#FFF4E0" stroke="#F0B9A0" strokeWidth=".6">
        <rect x="8" y="16" width="9" height="3.2" rx="1.6" transform="rotate(-15 12.5 17.6)" />
        <rect x="16" y="18" width="9" height="3.2" rx="1.6" transform="rotate(10 20.5 19.6)" />
        <rect x="11" y="21" width="9" height="3.2" rx="1.6" transform="rotate(-5 15.5 22.6)" />
        <rect x="20" y="14.5" width="8" height="3" rx="1.5" transform="rotate(25 24 16)" />
      </g>
      <path d="M22 21.5 L28 20 L27 24 L21.5 24.5 Z" fill="#F5C26B" />
      <path d="M13 13 L5 4" stroke="#C69C6D" strokeWidth="1.6" strokeLinecap="round" />
      <g fill="#77B255"><circle cx="15" cy="19" r=".7" /><circle cx="24" cy="18" r=".7" /><circle cx="19" cy="23.5" r=".7" /></g>
    </g>,
  ),
  // 김밥: sliced seaweed rice rolls showing the colourful filling
  gimbap: S(
    <g>
      {[
        [11, 13],
        [25, 13],
        [18, 25],
      ].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r="8.5" fill="#1B3B2F" />
          <circle cx={x} cy={y} r="7" fill="#FAFAFA" />
          <rect x={x - 3.2} y={y - 3.2} width="2.6" height="2.6" fill="#FFCC4D" />
          <rect x={x + 0.6} y={y - 3.2} width="2.6" height="2.6" fill="#F4900C" />
          <rect x={x - 3.2} y={y + 0.6} width="2.6" height="2.6" fill="#77B255" />
          <rect x={x + 0.6} y={y + 0.6} width="2.6" height="2.6" fill="#DD2E44" />
        </g>
      ))}
    </g>,
  ),
  // 비빔밥: rice bowl topped with vegetables and a fried egg
  bibimbap: S(
    <g>
      <path d="M3 17 H33 Q32 31 18 32 Q4 31 3 17 Z" fill="#292F33" />
      <ellipse cx="18" cy="17" rx="15" ry="5.5" fill="#F5F8FA" />
      <path d="M6 17 Q9 13 13 15 L11 19 Z" fill="#77B255" />
      <path d="M13 13.5 Q17 12 19 14 L16 17 Z" fill="#F4900C" />
      <path d="M23 13.5 Q28 13 30 17 L25 18 Z" fill="#8A5A3C" />
      <path d="M8 19.5 Q12 18 15 20.5 L10 21.5 Z" fill="#DD2E44" />
      <path d="M21 20 Q26 19 28 20.5 L23 22 Z" fill="#FFE8B6" />
      <ellipse cx="19" cy="16.5" rx="4.5" ry="2.6" fill="#fff" />
      <circle cx="19" cy="16.3" r="1.6" fill="#FFAC33" />
    </g>,
  ),
  // 자두: a plum (round, dark red-purple, with a leaf) — not a peach
  plum: S(
    <g>
      <circle cx="17" cy="21" r="11" fill="#8B2A5B" />
      <path d="M17 11 Q14 20 17 32" stroke="#6B1E45" strokeWidth="1.2" fill="none" />
      <ellipse cx="12.5" cy="17" rx="2.5" ry="3.5" fill="#B5487F" />
      <path d="M17 11 Q17.5 7 19.5 5" stroke="#5C3D1E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M19 8 Q25 3 30 7 Q25 12 19 8 Z" fill="#77B255" />
    </g>,
  ),
  // 감: persimmon with its four-leaf calyx
  persimmon: S(
    <g>
      <path d="M18 9 Q31 9 31 20 Q31 31 18 31 Q5 31 5 20 Q5 9 18 9 Z" fill="#F4720C" />
      <ellipse cx="12" cy="16" rx="2.5" ry="3.5" fill="#FFA84D" />
      <path d="M18 11 L11 8 L15 13 L10 15 L16 14 L18 17 L20 14 L26 15 L21 13 L25 8 Z" fill="#5C913B" />
      <path d="M18 11 V6" stroke="#5C3D1E" strokeWidth="1.6" strokeLinecap="round" />
    </g>,
  ),
  // 타조: ostrich — long neck and legs, fluffy black body
  ostrich: S(
    <g>
      <path d="M11 19 Q11 12 19 12 Q28 12 29 18 Q27 24 18 24 Q11 24 11 19 Z" fill="#292F33" />
      <path d="M24 13 Q30 12 32 16 Q29 15 27 16 Z" fill="#F5F8FA" />
      <path d="M13 17 Q10 10 10 5" stroke="#E8BE9B" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <ellipse cx="10.5" cy="4.5" rx="2.6" ry="2.2" fill="#E8BE9B" />
      <path d="M8 4.5 L4.5 5.2 L8 6" fill="#F4900C" />
      <circle cx="10.2" cy="3.8" r=".7" fill="#292F33" />
      <path d="M16 23 L15 34 M21 23 L23 34" stroke="#E8BE9B" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 34 H16 M22 34 H25" stroke="#E8BE9B" strokeWidth="1.6" strokeLinecap="round" />
    </g>,
  ),
  // 필통: zip pencil case with pencils
  pencilcase: S(
    <g>
      <rect x="9" y="4" width="3" height="14" fill="#FFCC4D" transform="rotate(-12 10.5 11)" />
      <rect x="15" y="3" width="3" height="15" fill="#5DADEC" />
      <rect x="21" y="4" width="3" height="14" fill="#DD2E44" transform="rotate(12 22.5 11)" />
      <rect x="3" y="14" width="30" height="16" rx="6" fill="#744EAA" />
      <path d="M5 18 H31" stroke="#CCD6DD" strokeWidth="1.6" strokeDasharray="1.6 1" />
      <rect x="24" y="16.5" width="4" height="4" rx="1" fill="#CCD6DD" />
    </g>,
  ),
  // 원: a Korean won coin
  won: S(
    <g>
      <circle cx="18" cy="18" r="15" fill="#F4AB19" />
      <circle cx="18" cy="18" r="12" fill="#FFCC4D" />
      <path d="M10.5 11 L13.5 25 L18 14 L22.5 25 L25.5 11" fill="none" stroke="#C1694F" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M9 16.5 H27 M9 20 H27" stroke="#C1694F" strokeWidth="1.8" strokeLinecap="round" />
    </g>,
  ),
};

/**
 * Words whose emoji is inaccurate: these words (Korean, or the English text of an answer option)
 * are always drawn with the matching icon above.
 */
export const ICON_BY_WORD: Record<string, string> = {
  한복: 'hanbok',
  한옥: 'hanok',
  한글: 'hangeul',
  김치: 'kimchi',
  떡볶이: 'tteokbokki',
  김밥: 'gimbap',
  줄: 'gimbap',
  자두: 'plum',
  감: 'persimmon',
  타조: 'ostrich',
  필통: 'pencilcase',
  원: 'won',
  bibimbap: 'bibimbap',
  한식: 'bibimbap',
  비빔밥: 'bibimbap',
  бибимбап: 'bibimbap',
};
