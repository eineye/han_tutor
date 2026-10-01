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
<script type="module">${script}</script>
</body>
</html>
`,
);
console.log('dist-demo/site/index.html');
