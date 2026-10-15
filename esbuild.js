const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const preview = process.argv.includes('--preview');

const distDir = path.join(__dirname, 'dist');
const stylesPath = path.join(__dirname, 'src/ui/styles.css');

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&display=swap" rel="stylesheet">`;

function htmlPage(js, extraHead = '') {
  const css = fs.readFileSync(stylesPath, 'utf8');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">${FONT_LINKS}
  <style>${css}</style>${extraHead}
</head>
<body>
  <div id="react-page"></div>
  <script>${js}</script>
</body>
</html>`;
}

/** Ghi file HTML mỗi lần build UI xong; lỗi thì báo, KHÔNG ghi đè bản cũ trong im lặng. */
function writeHtmlPlugin(outFile, extraHead) {
  return {
    name: 'write-html',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length > 0) {
          console.error(`Build ${path.basename(outFile)} lỗi — giữ nguyên bản cũ.`);
          return;
        }
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, htmlPage(result.outputFiles[0].text, extraHead));
        console.log(`Đã build ${path.relative(__dirname, outFile)}`);
      });
    },
  };
}

async function build() {
  fs.mkdirSync(distDir, { recursive: true });

  if (preview) {
    // Trang xem thử giao diện ngoài Figma (dev/preview.tsx) — không đóng gói vào plugin.
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'dev/preview.tsx')],
      bundle: true,
      write: false,
      target: 'es2020',
      tsconfig: path.join(__dirname, 'tsconfig.ui.json'),
      plugins: [writeHtmlPlugin(path.join(__dirname, 'dist-preview/preview.html'))],
      logLevel: 'error',
    });
    return;
  }

  const codeCtx = await esbuild.context({
    entryPoints: [path.join(__dirname, 'src/code.ts')],
    bundle: true,
    // Sandbox của Figma không phải Node — đóng gói như trình duyệt.
    platform: 'browser',
    target: 'es2017',
    tsconfig: path.join(__dirname, 'tsconfig.sandbox.json'),
    outfile: path.join(distDir, 'code.js'),
    minify: !watch,
    logLevel: 'error',
  });

  const uiCtx = await esbuild.context({
    entryPoints: [path.join(__dirname, 'src/ui.tsx')],
    bundle: true,
    write: false,
    target: 'es2020',
    tsconfig: path.join(__dirname, 'tsconfig.ui.json'),
    minify: !watch,
    logLevel: 'error',
    plugins: [writeHtmlPlugin(path.join(distDir, 'ui.html'))],
  });

  if (watch) {
    await Promise.all([codeCtx.watch(), uiCtx.watch()]);
    console.log('Đang theo dõi thay đổi của sandbox và UI…');
    return;
  }

  const [code, ui] = await Promise.all([codeCtx.rebuild(), uiCtx.rebuild()]);
  await Promise.all([codeCtx.dispose(), uiCtx.dispose()]);
  if (code.errors.length || ui.errors.length) {
    throw new Error('Build lỗi.');
  }
  console.log('Build xong.');
}

build().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
