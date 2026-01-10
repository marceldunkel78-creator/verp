const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'node_modules', 'react-scripts', 'config', 'webpackDevServer.config.js');

function applyPatch() {
  if (!fs.existsSync(target)) {
    console.log('[patch-react-scripts] react-scripts file not found, skipping.');
    return;
  }

  let content = fs.readFileSync(target, 'utf8');

  if (content.indexOf('setupMiddlewares(') !== -1) {
    console.log('[patch-react-scripts] setupMiddlewares already present, nothing to do.');
    return;
  }

  const before = /\n\s*onBeforeSetupMiddleware\([\s\S]*?\},\n\s*onAfterSetupMiddleware\([\s\S]*?\},\n/s;
  if (!before.test(content)) {
    console.log('[patch-react-scripts] expected deprecated hooks not found, skipping patch.');
    return;
  }

  const replacement = `\n    setupMiddlewares(middlewares, devServer) {\n      // Replace deprecated onBeforeSetupMiddleware/onAfterSetupMiddleware\n      // Keep \`evalSourceMapMiddleware\` before redirectServedPath\n      try {\n        devServer.app.use(evalSourceMapMiddleware(devServer));\n      } catch (e) {\n        // ignore if middleware cannot be applied\n      }\n\n      if (fs.existsSync(paths.proxySetup)) {\n        try {\n          require(paths.proxySetup)(devServer.app);\n        } catch (e) {\n          // ignore user middleware errors during setup\n        }\n      }\n\n      // After setup: redirect and noop service worker middleware\n      try {\n        devServer.app.use(redirectServedPath(paths.publicUrlOrPath));\n        devServer.app.use(noopServiceWorkerMiddleware(paths.publicUrlOrPath));\n      } catch (e) {\n        // ignore\n      }\n\n      return middlewares;\n    },\n`;

  const newContent = content.replace(before, replacement);
  fs.writeFileSync(target, newContent, 'utf8');
  console.log('[patch-react-scripts] applied patch to webpackDevServer.config.js');
}

try {
  applyPatch();
} catch (e) {
  console.error('[patch-react-scripts] error applying patch:', e);
  process.exit(1);
}
