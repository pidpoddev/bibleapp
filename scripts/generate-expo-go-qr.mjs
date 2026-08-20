#!/usr/bin/env node
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const QRCode = require('../node_modules/qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('../node_modules/qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

const expoUrls = [
  {
    label: 'Local network',
    url: 'exp://192.168.70.70:8081',
    svgPath: resolve('assets/expo-go-local-qr.svg'),
  },
];
const qrMarkdownPath = resolve('EXPO_GO_QR.md');

function createQrSvg(expoUrl) {
  const qrcode = new QRCode(-1, QRErrorCorrectLevel.M);
  qrcode.addData(expoUrl);
  qrcode.make();

  const moduleCount = qrcode.getModuleCount();
  const quietZone = 4;
  const moduleSize = 10;
  const size = (moduleCount + quietZone * 2) * moduleSize;
  const rects = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qrcode.isDark(row, column)) {
        rects.push(
          `<rect x="${(column + quietZone) * moduleSize}" y="${(row + quietZone) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Expo Go QR code for ${expoUrl}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g fill="#000000">
    ${rects.join('\n    ')}
  </g>
</svg>
`;
}

for (const expo of expoUrls) {
  mkdirSync(dirname(expo.svgPath), { recursive: true });
  writeFileSync(expo.svgPath, createQrSvg(expo.url));
}

const markdown = `# Expo Go QR Codes

Scan with Expo Go.

## Local Network

![Local Expo Go QR code](assets/expo-go-local-qr.svg)

Expo Go URL: \`exp://192.168.70.70:8081\`
`;

writeFileSync(qrMarkdownPath, markdown);

for (const expo of expoUrls) {
  console.log(`Wrote ${expo.svgPath}`);
}
console.log(`Wrote ${qrMarkdownPath}`);
