// Folds the demo build (dist-demo/) into one self-contained HTML page for publishing as a web Artifact.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('dist-demo');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = html.match(/<script[^>]+src="\/?([^"]+\.js)"/)?.[1];
const css = html.match(/<link[^>]+href="\/?([^"]+\.css)"/)?.[1];
if (!js || !css) throw new Error('Could not find built JS/CSS in dist-demo/index.html');

const script = fs.readFileSync(path.join(dir, js), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = fs.readFileSync(path.join(dir, css), 'utf8').replace(/<\/style/gi, '<\\/style');

const out = `<title>Han Tutor</title>
<meta name="theme-color" content="#ff7a59">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap">
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
fs.writeFileSync(path.join(dir, 'han-tutor-demo.html'), out);
console.log(`dist-demo/han-tutor-demo.html  ${(out.length / 1024).toFixed(0)} KB`);

// If the app has not rendered after a few seconds (old browser, blocked script, startup error),
// show a readable message instead of a blank page.
const BOOT_GUARD = `(function(){var errs=[];window.addEventListener('error',function(e){errs.push(e.message||'error')});
setTimeout(function(){var r=document.getElementById('root');if(!r||r.firstChild)return;
var d=document.createElement('div');d.style.cssText='font-family:sans-serif;padding:24px;max-width:560px;margin:40px auto;line-height:1.6;color:#2b2118;background:#fff8f1';
var h=document.createElement('h2');h.textContent='앱을 시작하지 못했습니다 · The app could not start';d.appendChild(h);
var p=document.createElement('p');p.textContent='최신 Chrome, Edge 또는 Safari(iOS 15 이상)에서 열어 주세요. 카카오톡·인스타그램 같은 앱 안에서 열었다면 메뉴의 “다른 브라우저로 열기”를 눌러 주세요. Please open this page in an up-to-date Chrome, Edge or Safari.';d.appendChild(p);
var e=document.createElement('pre');e.style.cssText='white-space:pre-wrap;color:#a3202f;font-size:13px';e.textContent=(errs.join('\\n')||'(no error message)')+'\\n'+navigator.userAgent;d.appendChild(e);
r.appendChild(d)},6000)})();`;

// Full document for static hosting (GitHub Pages): dist-demo/site/index.html
const site = path.join(dir, 'site');
fs.mkdirSync(site, { recursive: true });
fs.writeFileSync(
  path.join(site, 'index.html'),
  `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${out.slice(0, out.indexOf('<div id="root">'))}</head>
<body>
<div id="root"></div>
<noscript>Han Tutor needs JavaScript. JavaScript를 켜 주세요.</noscript>
<script>${BOOT_GUARD}</script>
<script type="module">${script}</script>
</body>
</html>
`,
);
console.log('dist-demo/site/index.html');
