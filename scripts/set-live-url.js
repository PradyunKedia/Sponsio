const fs = require('node:fs');
const path = require('node:path');

const value = process.argv[2];
if (!value) {
  throw new Error('Usage: npm run set-live-url -- https://your-public-app.example');
}
const url = new URL(value);
if (url.protocol !== 'https:') throw new Error('The public URL must use HTTPS');
const liveUrl = url.toString().replace(/\/$/, '');
const root = path.join(__dirname, '..');

const readmePath = path.join(root, 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');
const section = [
  '<!-- SPONSIO_LIVE_START -->',
  `- Live app: <${liveUrl}>`,
  '<!-- SPONSIO_LIVE_END -->',
].join('\n');
fs.writeFileSync(
  readmePath,
  readme.replace(
    /<!-- SPONSIO_LIVE_START -->[\s\S]*?<!-- SPONSIO_LIVE_END -->/,
    section,
  ),
);

for (const relative of [
  'PITCH.md',
  'docs/SOCIAL_PACK.md',
  'docs/VIDEO_RUNBOOK.md',
  'docs/AD_STORYBOARD.md',
]) {
  const file = path.join(root, relative);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('[LIVE_URL]', liveUrl));
}

console.log(`Updated public Sponsio URL to ${liveUrl}`);
