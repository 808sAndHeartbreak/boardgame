const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const styles = ['app-style.css', 'round1-theme.css', 'round2-theme.css', 'round3-theme.css', 'edition-theme.css', 'interface.css'].map(file => read('src/' + file)).join('\n');
const offline = process.argv.includes('--offline');
const art = file => {
  const data = fs.readFileSync(path.join(root, 'public/assets', file));
  return offline ? 'data:image/webp;base64,' + data.toString('base64') : './assets/' + file + '?v=' + crypto.createHash('sha256').update(data).digest('hex').slice(0,12);
};
let html = read('src/app-shell.html')
  .replace('__STYLES__', () => styles)
  .replace('__CORE__', () => read('src/edition-motion.js') + '\n' + read('src/game-core.js'))
  .replace('__UI__', () => read('src/app-ui.js'))
  .replaceAll("url('__HANDOFF_ART__')", 'var(--editorial-art)')
  .replaceAll('__EDITORIAL_ART__', () => art('masquerade-print.webp'))
  .replaceAll('__ROLE_ART_IMAGE__', () => art('role-sigils.webp'));
new vm.Script(html.split('<script>')[1].split('</script>')[0]);
const destination = path.join(root, offline ? 'offline.html' : 'public/index.html');
fs.writeFileSync(destination, html);
if (!offline) fs.writeFileSync(destination + '.gz', zlib.gzipSync(html, {level:9}));
console.log(path.relative(root, destination) + ': ' + Buffer.byteLength(html) + ' bytes');
