// Builds the standalone game: concatenates src/*.js into src/index.template.html -> dist/index.html
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src');
const files = fs.readdirSync(src).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
const js = files.map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const tpl = fs.readFileSync(path.join(src, 'index.template.html'), 'utf8');
const out = tpl.replace('/*__GAME__*/', () => js.replace(/<\/script>/gi, '<\\/script>'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), out);
console.log(`dist/index.html written (${(out.length / 1024).toFixed(1)} KB) from ${files.join(', ')}`);
