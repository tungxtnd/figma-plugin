const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');

async function build() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  // 1. Build code.ts (Figma Sandbox)
  const codeCtx = await esbuild.context({
    entryPoints: [path.join(__dirname, 'src/code.ts')],
    bundle: true,
    platform: 'node',
    target: 'es2020',
    tsconfig: path.join(__dirname, 'tsconfig.sandbox.json'),
    outfile: path.join(distDir, 'code.js'),
    minify: !watch,
  });

  // 2. Build ui.tsx (React UI)
  const buildUi = async () => {
    try {
      const result = await esbuild.build({
        entryPoints: [path.join(__dirname, 'src/ui.tsx')],
        bundle: true,
        write: false,
        target: 'es2020',
        tsconfig: path.join(__dirname, 'tsconfig.ui.json'),
        minify: !watch,
        logLevel: 'error',
      });

      const uiJs = result.outputFiles[0].text;
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
      color: #333;
    }
  </style>
</head>
<body>
  <div id="react-page"></div>
  <script>
    ${uiJs}
  </script>
</body>
</html>`;

      fs.writeFileSync(path.join(distDir, 'ui.html'), htmlContent);
      console.log('Successfully compiled dist/ui.html');
    } catch (err) {
      console.error('Failed to compile dist/ui.html:', err);
    }
  };

  if (watch) {
    await codeCtx.watch();
    console.log('Watching code.ts...');
    
    // For UI watch, we run esbuild directly when source files change
    // For simplicity, we just rebuild UI once initially and tell the user to rerun.
    // Or we can rebuild on source change if needed, but a single build script works fine.
    await buildUi();
  } else {
    await codeCtx.rebuild();
    await buildUi();
    await codeCtx.dispose();
    console.log('Build completed successfully.');
  }
}

build().catch((err) => {
  console.error('Build script failed:', err);
  process.exit(1);
});
