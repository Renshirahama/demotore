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
      const compact = w <= 1300;
      const arrowX = x + w - 142;
      const arrowY = y + h - 116;
      return `
        <g>
          <rect x="${x + 34}" y="${y + 34}" width="${w - 68}" height="${h - 68}" rx="42" fill="${cell.fill}" stroke="${cell.stroke}" stroke-width="7"/>
          <path d="M ${x + w - 470} ${y + 34} L ${x + w - 34} ${y + 34} L ${x + w - 34} ${y + 470} Z" fill="${cell.accent}" opacity="0.18"/>
          <rect x="${x + 74}" y="${y + 78}" width="${compact ? 164 : 220}" height="14" rx="7" fill="${cell.stroke}"/>
          <circle cx="${x + w - 120}" cy="${y + 116}" r="28" fill="${cell.stroke}" opacity="0.18"/>
          <circle cx="${x + w - 184}" cy="${y + 142}" r="18" fill="${cell.stroke}" opacity="0.14"/>
          <text x="${cx}" y="${cy + 38}" text-anchor="middle" font-family="${font}" font-size="${cell.titleSize ?? (compact ? 82 : 98)}" font-weight="900" fill="${cell.color}">${cell.title}</text>
          <circle cx="${arrowX}" cy="${arrowY}" r="52" fill="${cell.arrowBg}"/>
          <text x="${arrowX}" y="${arrowY + 16}" text-anchor="middle" font-family="${font}" font-size="58" font-weight="900" fill="${cell.arrowColor}">›</text>
        </g>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="52%" stop-color="#eef6ff"/>
      <stop offset="100%" stop-color="#f7fee7"/>
    </linearGradient>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#cbd5e1" stroke-width="2" opacity="0.18"/>
    </pattern>
  </defs>
  <rect width="2500" height="1686" fill="url(#bg)"/>
  <rect width="2500" height="1686" fill="url(#grid)"/>
  <line x1="0" y1="843" x2="2500" y2="843" stroke="#cbd5e1" stroke-width="3"/>
  <line x1="1250" y1="0" x2="1250" y2="843" stroke="#cbd5e1" stroke-width="3"/>
  ${cellMarkup}
</svg>`;
}

const menus = [
  {
    name: 'money-before',
    title: '相談前メニュー',
    subtitle: 'まずは3問診断からスタート',
    cells: [
      {
        rect: [0, 0, 2500, 843],
        title: '相談タイプ診断',
        fill: '#ecfeff',
        stroke: '#06b6d4',
        accent: '#0891b2',
        arrowBg: '#06b6d4',
        arrowColor: '#ffffff',
        color: '#083344',
        subColor: '#0e7490',
      },
      {
        rect: [0, 843, 2500, 843],
        title: 'サービスを見る',
        fill: '#ffffff',
        stroke: '#64748b',
        accent: '#334155',
        arrowBg: '#0f172a',
        arrowColor: '#ffffff',
        color: '#0f172a',
        subColor: '#334155',
      },
    ],
  },
  {
    name: 'money-learning',
    title: '案内中メニュー',
    subtitle: '事例・資料・相談内容を確認',
    cells: [
      {
        rect: [0, 0, 1250, 843],
        title: '導入事例',
        fill: '#dbeafe',
        stroke: '#2563eb',
        accent: '#1d4ed8',
        arrowBg: '#2563eb',
        arrowColor: '#ffffff',
        color: '#1e3a8a',
        subColor: '#1d4ed8',
      },
      {
        rect: [1250, 0, 1250, 843],
        title: '資料請求',
        titleSize: 82,
        fill: '#fef3c7',
        stroke: '#d97706',
        accent: '#f59e0b',
        arrowBg: '#d97706',
        arrowColor: '#ffffff',
        color: '#78350f',
        subColor: '#92400e',
      },
      {
        rect: [0, 843, 2500, 843],
        title: '相談内容を見る',
        fill: '#ffffff',
        stroke: '#059669',
        accent: '#10b981',
        arrowBg: '#059669',
        arrowColor: '#ffffff',
        color: '#14532d',
        subColor: '#166534',
      },
    ],
  },
  {
    name: 'money-counseling',
    title: '問い合わせメニュー',
    subtitle: '担当者への相談へ進む',
    cells: [
      {
        rect: [0, 0, 2500, 843],
        title: '開発相談をする',
        fill: '#fee2e2',
        stroke: '#dc2626',
        accent: '#ef4444',
        arrowBg: '#dc2626',
        arrowColor: '#ffffff',
        color: '#7f1d1d',
        subColor: '#991b1b',
      },
      {
        rect: [0, 843, 2500, 843],
        title: 'FAQを見る',
        fill: '#ffffff',
        stroke: '#64748b',
        accent: '#475569',
        arrowBg: '#475569',
        arrowColor: '#ffffff',
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
