import iconLogo from '../assets/brand/한글온_icon_logo.png';
import nameLogo from '../assets/brand/한글온_Name_logo.png';

/** 한글온 (Hangeul On) app icon */
export function BrandIcon({ size = 40 }: { size?: number }) {
  return <img className="brand__icon" src={iconLogo} alt="" width={Math.round((size * 160) / 182)} height={size} />;
}

/** 한글온 · HANGEUL ON word mark */
export function BrandName({ height = 34 }: { height?: number }) {
  return <img className="brand__name" src={nameLogo} alt="한글온 Hangeul On" height={height} width={Math.round((height * 258) / 151)} />;
}
