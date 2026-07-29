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
      if (cell.visual === 'consult') {
        return `
        <g>
          <rect x="${x + 34}" y="${y + 34}" width="${w - 68}" height="${h - 68}" rx="42" fill="#fef2f2" stroke="#dc2626" stroke-width="7"/>
          <path d="M ${x + w - 620} ${y + 34} L ${x + w - 34} ${y + 34} L ${x + w - 34} ${y + 620} Z" fill="#ef4444" opacity="0.16"/>
          <circle cx="${x + 415}" cy="${y + 348}" r="155" fill="#fecaca"/>
          <circle cx="${x + 415}" cy="${y + 306}" r="72" fill="#991b1b"/>
          <path d="M ${x + 266} ${y + 546} Q ${x + 415} ${y + 430} ${x + 564} ${y + 546} L ${x + 564} ${y + 620} L ${x + 266} ${y + 620} Z" fill="#991b1b"/>
          <rect x="${x + 640}" y="${y + 188}" width="480" height="270" rx="44" fill="#ffffff" stroke="#fca5a5" stroke-width="6"/>
          <path d="M ${x + 756} ${y + 458} L ${x + 704} ${y + 552} L ${x + 834} ${y + 468}" fill="#ffffff" stroke="#fca5a5" stroke-width="6"/>
          <rect x="${x + 722}" y="${y + 264}" width="300" height="28" rx="14" fill="#dc2626" opacity="0.82"/>
          <rect x="${x + 722}" y="${y + 334}" width="220" height="24" rx="12" fill="#fca5a5"/>
          <rect x="${x + 1185}" y="${y + 204}" width="1010" height="358" rx="46" fill="#ffffff" stroke="#fecaca" stroke-width="4"/>
          <text x="${x + 1268}" y="${y + 336}" font-family="${font}" font-size="104" font-weight="900" fill="#7f1d1d">${cell.title}</text>
          <text x="${x + 1272}" y="${y + 444}" font-family="${font}" font-size="48" font-weight="700" fill="#991b1b">AI導入・開発相談</text>
          <rect x="${x + 1272}" y="${y + 492}" width="342" height="58" rx="29" fill="#dc2626"/>
          <text x="${x + 1443}" y="${y + 533}" text-anchor="middle" font-family="${font}" font-size="32" font-weight="800" fill="#ffffff">担当者に相談する</text>
          <circle cx="${arrowX}" cy="${arrowY}" r="52" fill="#dc2626"/>
          <text x="${arrowX}" y="${arrowY + 16}" text-anchor="middle" font-family="${font}" font-size="58" font-weight="900" fill="#ffffff">›</text>
        </g>`;
      }
      if (cell.visual === 'faq') {
        return `
        <g>
          <rect x="${x + 34}" y="${y + 34}" width="${w - 68}" height="${h - 68}" rx="42" fill="#f8fafc" stroke="#475569" stroke-width="7"/>
          <path d="M ${x + w - 620} ${y + 34} L ${x + w - 34} ${y + 34} L ${x + w - 34} ${y + 620} Z" fill="#64748b" opacity="0.13"/>
          <rect x="${x + 235}" y="${y + 162}" width="650" height="500" rx="52" fill="#ffffff" stroke="#cbd5e1" stroke-width="6"/>
          <circle cx="${x + 342}" cy="${y + 286}" r="52" fill="#0f172a"/>
          <text x="${x + 342}" y="${y + 308}" text-anchor="middle" font-family="${font}" font-size="60" font-weight="900" fill="#ffffff">Q</text>
          <rect x="${x + 430}" y="${y + 244}" width="340" height="28" rx="14" fill="#475569"/>
          <rect x="${x + 430}" y="${y + 308}" width="270" height="24" rx="12" fill="#cbd5e1"/>
          <circle cx="${x + 342}" cy="${y + 454}" r="52" fill="#06b6d4"/>
          <text x="${x + 342}" y="${y + 476}" text-anchor="middle" font-family="${font}" font-size="60" font-weight="900" fill="#ffffff">A</text>
          <rect x="${x + 430}" y="${y + 414}" width="380" height="28" rx="14" fill="#06b6d4"/>
          <rect x="${x + 430}" y="${y + 478}" width="245" height="24" rx="12" fill="#bae6fd"/>
          <rect x="${x + 1010}" y="${y + 204}" width="1070" height="390" rx="46" fill="#ffffff" stroke="#e2e8f0" stroke-width="4"/>
          <text x="${x + 1100}" y="${y + 352}" font-family="${font}" font-size="118" font-weight="900" fill="#0f172a">${cell.title}</text>
          <text x="${x + 1104}" y="${y + 462}" font-family="${font}" font-size="48" font-weight="700" fill="#475569">よくある質問を確認</text>
          <rect x="${x + 1104}" y="${y + 506}" width="292" height="58" rx="29" fill="#475569"/>
          <text x="${x + 1250}" y="${y + 547}" text-anchor="middle" font-family="${font}" font-size="33" font-weight="800" fill="#ffffff">FAQを見る</text>
          <circle cx="${arrowX}" cy="${arrowY}" r="52" fill="#475569"/>
          <text x="${arrowX}" y="${arrowY + 16}" text-anchor="middle" font-family="${font}" font-size="58" font-weight="900" fill="#ffffff">›</text>
        </g>`;
      }
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
        title: '無料相談',
        visual: 'consult',
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
        title: 'FAQ',
        visual: 'faq',
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
