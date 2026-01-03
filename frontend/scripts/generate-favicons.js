#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const faviconsModule = require('favicons');
const favicons = typeof faviconsModule === 'function' ? faviconsModule : (faviconsModule && faviconsModule.default) ? faviconsModule.default : faviconsModule;

const publicDir = path.join(__dirname, '..', 'public');
const source = path.join(publicDir, 'VERP.svg');
const outputDir = path.join(publicDir, 'icons');

const configuration = {
  path: '/icons/',
  appName: 'VERP',
  appShortName: 'VERP',
  appDescription: 'VERP - Visitron ERP',
  developerName: 'Visitron',
  developerURL: null,
  dir: 'auto',
  lang: 'de-DE',
  background: '#ffffff',
  theme_color: '#ffffff',
  display: 'standalone',
  orientation: 'any',
  scope: '/',
  start_url: '/',
  preferRelatedApplications: false,
  icons: {
    android: true,
    appleIcon: true,
    appleStartup: false,
    coast: false,
    favicons: true,
    firefox: false,
    windows: true,
    yandex: false
  }
};

if (!fs.existsSync(source)) {
  console.error('Source SVG not found:', source);
  console.error('Please place your VERP.svg into', publicDir);
  process.exit(2);
}

(async () => {
  try {
    const response = await favicons(source, configuration);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    response.images.forEach(image => {
      fs.writeFileSync(path.join(outputDir, image.name), image.contents);
    });

    response.files.forEach(file => {
      fs.writeFileSync(path.join(outputDir, file.name), file.contents);
    });

    // Write an HTML snippet for easy copy/paste
    const htmlFile = path.join(publicDir, 'favicon-html.html');
    fs.writeFileSync(htmlFile, response.html.join('\n'));

    console.log('Favicons written to', outputDir);
    console.log('HTML head snippet written to', htmlFile);
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }
})();
