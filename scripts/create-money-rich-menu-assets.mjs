import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'assets', 'rich-menus');
mkdirSync(outDir, { recursive: true });

const font = 'Hiragino Sans, AppleGothic, sans-serif';

function svg(title, subtitle, cells) {
  const cellMarkup = cells
    .map((cell) => {
      const [x, y, w, h] = cell.rect;
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `
        <g>
          <rect x="${x + 36}" y="${y + 36}" width="${w - 72}" height="${h - 72}" rx="36" fill="${cell.fill}" stroke="${cell.stroke}" stroke-width="8"/>
          <text x="${cx}" y="${cy - 18}" text-anchor="middle" font-family="${font}" font-size="${cell.titleSize ?? 82}" font-weight="800" fill="${cell.color}">${cell.title}</text>
          <text x="${cx}" y="${cy + 78}" text-anchor="middle" font-family="${font}" font-size="${cell.subtitleSize ?? 42}" font-weight="600" fill="${cell.subColor}">${cell.subtitle}</text>
        </g>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="48%" stop-color="#eefdf7"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="2500" height="1686" fill="url(#bg)"/>
  <text x="92" y="92" font-family="${font}" font-size="34" font-weight="700" fill="#0f172a">マネトレ大学</text>
  <text x="2408" y="92" text-anchor="end" font-family="${font}" font-size="34" font-weight="700" fill="#475569">${title}</text>
  <line x1="0" y1="843" x2="2500" y2="843" stroke="#d1d5db" stroke-width="4"/>
  <line x1="1250" y1="0" x2="1250" y2="843" stroke="#d1d5db" stroke-width="4"/>
  ${cellMarkup}
</svg>`;
}

const menus = [
  {
    name: 'money-before',
    title: '診断前メニュー',
    subtitle: 'まずは3問診断からスタート',
    cells: [
      {
        rect: [0, 0, 2500, 843],
        title: '初回診断を受ける',
        subtitle: '3問であなたの学習タイプを判定',
        fill: '#dcfce7',
        stroke: '#22c55e',
        color: '#14532d',
        subColor: '#166534',
      },
      {
        rect: [0, 843, 2500, 843],
        title: '講座について',
        subtitle: '学べる内容と進め方を見る',
        fill: '#ffffff',
        stroke: '#94a3b8',
        color: '#0f172a',
        subColor: '#475569',
      },
    ],
  },
  {
    name: 'money-learning',
    title: '受講中メニュー',
    subtitle: '今日の講義とワークを進める',
    cells: [
      {
        rect: [0, 0, 1250, 843],
        title: '今日の講義',
        subtitle: 'ステップ講義を確認',
        fill: '#dbeafe',
        stroke: '#3b82f6',
        color: '#1e3a8a',
        subColor: '#1d4ed8',
      },
      {
        rect: [1250, 0, 1250, 843],
        title: 'ワークをする',
        subtitle: '収支と資産を整理',
        titleSize: 74,
        fill: '#fef3c7',
        stroke: '#f59e0b',
        color: '#78350f',
        subColor: '#92400e',
      },
      {
        rect: [0, 843, 2500, 843],
        title: '個別相談について',
        subtitle: '無料カウンセリングの案内を見る',
        fill: '#ffffff',
        stroke: '#22c55e',
        color: '#14532d',
        subColor: '#166534',
      },
    ],
  },
  {
    name: 'money-counseling',
    title: '相談案内メニュー',
    subtitle: '不安を解消して次の一歩へ',
    cells: [
      {
        rect: [0, 0, 2500, 843],
        title: '無料相談に申し込む',
        subtitle: '体験授業・カウンセリングへ進む',
        fill: '#fee2e2',
        stroke: '#ef4444',
        color: '#7f1d1d',
        subColor: '#991b1b',
      },
      {
        rect: [0, 843, 2500, 843],
        title: 'FAQを見る',
        subtitle: 'よくある不安と質問を確認',
        fill: '#ffffff',
        stroke: '#94a3b8',
        color: '#0f172a',
        subColor: '#475569',
      },
    ],
  },
];

for (const menu of menus) {
  const svgPath = join(outDir, `${menu.name}.svg`);
  const qlPng = `${svgPath}.png`;
  const pngPath = join(outDir, `${menu.name}.png`);
  writeFileSync(svgPath, svg(menu.title, menu.subtitle, menu.cells));
  execFileSync('qlmanage', ['-t', '-s', '2500', '-o', outDir, svgPath], { stdio: 'ignore' });
  execFileSync('cp', [qlPng, pngPath]);
  execFileSync('sips', ['-c', '1686', '2500', pngPath], { stdio: 'ignore' });
  console.log(pngPath);
}
