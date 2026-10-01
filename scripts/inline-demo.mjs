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
