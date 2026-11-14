import { compositionLayout, wrappedPlacements, paginateVariants, sheetColors, readableInk, PRODUCTS, AUDIENCES } from './design.js';

let serial = 0;
const uid = () => `kms-${++serial}`;
let assetRenderSources = new Map();
/** Runtime-only object URLs made by the app; never part of project JSON. */
export function setAssetRenderSources(sources) {
  if (!(sources instanceof Map) || [...sources.values()].some(url => typeof url !== 'string' || !url.startsWith('blob:')))
    throw new Error('Görsel önizleme kaynağı geçersiz.');
  assetRenderSources = new Map(sources);
}
const assetSource = asset => assetRenderSources.get(asset.id) || asset.dataUrl;
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const n = value => Number(value.toFixed(3));

// All paths below are original, procedurally authored for this application.
const MOTIF_ART = {
  bunny: `<ellipse cx="-7" cy="-18" rx="5" ry="13" transform="rotate(-15 -7 -18)" fill="currentColor"/>
    <ellipse cx="7" cy="-19" rx="5" ry="14" transform="rotate(12 7 -19)" fill="currentColor"/>
    <ellipse cy="6" rx="18" ry="16" fill="currentColor"/>
    <ellipse cx="-7" cy="-18" rx="1.8" ry="8" fill="#fff" opacity=".5"/>
    <ellipse cx="7" cy="-19" rx="1.8" ry="9" fill="#fff" opacity=".5"/>
    <circle cx="-6" cy="3" r="1.7" fill="#293F36"/><circle cx="6" cy="3" r="1.7" fill="#293F36"/>
    <path d="M-2 9 L0 11 L2 9 M0 11 Q-3 15 -5 12 M0 11 Q3 15 5 12" fill="none" stroke="#293F36" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="-11" cy="10" r="3" fill="#fff" opacity=".45"/><circle cx="11" cy="10" r="3" fill="#fff" opacity=".45"/>`,
  star: `<path d="M0-21 L6-7 L21-5 L10 5 L13 20 L0 12 L-13 20 L-10 5 L-21-5 L-6-7Z" fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="3"/>
    <path d="M-3-7 L-1-12" stroke="#fff" stroke-linecap="round" stroke-width="2" opacity=".6"/>`,
  cloud: `<path d="M-17 13 C-33 13 -31-6 -17-7 C-17-24 7-24 12-10 C29-14 35 10 19 13Z" fill="currentColor"/>
    <path d="M-14 17 L-17 23 M0 18 L-3 24 M14 17 L11 23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  flower: `<g fill="currentColor"><ellipse cy="-13" rx="7" ry="12"/>
    <ellipse cy="-13" rx="7" ry="12" transform="rotate(60)"/><ellipse cy="-13" rx="7" ry="12" transform="rotate(120)"/>
    <ellipse cy="-13" rx="7" ry="12" transform="rotate(180)"/><ellipse cy="-13" rx="7" ry="12" transform="rotate(240)"/>
    <ellipse cy="-13" rx="7" ry="12" transform="rotate(300)"/></g><circle r="7" fill="#F5E4B8"/><circle r="2" fill="#8C7448" opacity=".55"/>`,
  geometric: `<path d="M0-23 L20 0 L0 23 L-20 0Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>
    <circle r="4" fill="currentColor"/><circle cx="29" cy="20" r="3" fill="currentColor"/><circle cx="-28" cy="-19" r="2.5" fill="currentColor"/>`,
  dog: `<ellipse cx="-17" cy="-3" rx="7" ry="14" transform="rotate(18 -17 -3)" fill="currentColor"/>
    <ellipse cx="17" cy="-3" rx="7" ry="14" transform="rotate(-18 17 -3)" fill="currentColor"/>
    <ellipse cx="-17" cy="-3" rx="7" ry="14" transform="rotate(18 -17 -3)" fill="#293F36" opacity=".28"/>
    <ellipse cx="17" cy="-3" rx="7" ry="14" transform="rotate(-18 17 -3)" fill="#293F36" opacity=".28"/>
    <ellipse cy="2" rx="16" ry="18" fill="currentColor"/>
    <ellipse cy="10" rx="9" ry="7.5" fill="#fff" opacity=".55"/>
    <circle cx="-6" cy="-3" r="1.8" fill="#293F36"/><circle cx="6" cy="-3" r="1.8" fill="#293F36"/>
    <ellipse cy="6.5" rx="3.2" ry="2.3" fill="#293F36"/>
    <path d="M0 8.8 V12 M0 12 Q-3 15 -5 12.5 M0 12 Q3 15 5 12.5" fill="none" stroke="#293F36" stroke-width="1.2" stroke-linecap="round"/>`,
  bug: `<path d="M-3-19 Q-6-26 -11-25 M3-19 Q6-26 11-25" fill="none" stroke="#293F36" stroke-width="1.5" stroke-linecap="round"/>
    <circle cy="-13" r="7.5" fill="#293F36"/>
    <ellipse cy="4" rx="15.5" ry="17" fill="currentColor"/>
    <path d="M0-12 V21" stroke="#293F36" stroke-width="1.6"/>
    <circle cx="-7" cy="-2" r="3" fill="#293F36"/><circle cx="7" cy="-2" r="3" fill="#293F36"/>
    <circle cx="-8.5" cy="9" r="2.6" fill="#293F36"/><circle cx="8.5" cy="9" r="2.6" fill="#293F36"/>
    <circle cx="-4" cy="16" r="1.8" fill="#293F36"/><circle cx="4" cy="16" r="1.8" fill="#293F36"/>
    <circle cx="-3" cy="-15" r="1.3" fill="#fff" opacity=".8"/><circle cx="3" cy="-15" r="1.3" fill="#fff" opacity=".8"/>`,
};

export function motifIcon(motif, color = '#7B947B') {
  return `<svg viewBox="-37 -37 74 74" aria-hidden="true" style="color:${escapeHTML(color)}">${MOTIF_ART[motif] || ''}</svg>`;
}

function patternDefinitions(project, background, prefix, tileScale) {
  const layout = compositionLayout(project);
  const c = project.composition;
  let content = '';
  let definitions = '';
  if (c.mode === 'raster') {
    const asset = project.assets.find(a => a.id === c.rasterAssetId);
    if (asset) content = `<image href="${escapeHTML(assetSource(asset))}" width="${n(layout.width)}" height="${n(layout.height)}" preserveAspectRatio="none"/>`;
  } else {
    const motifs = new Set(layout.placements.map(p => p.motif));
    const motifIds = new Map();
    for (const motif of motifs) {
      const symbolId = `${prefix}-motif-${motifIds.size}`;
      motifIds.set(motif, symbolId);
      const asset = motif.startsWith('asset:') ? project.assets.find(a => a.id === motif.slice(6)) : null;
      definitions += `<g id="${symbolId}">${asset
        ? `<image href="${escapeHTML(assetSource(asset))}" x="-30" y="-30" width="60" height="60" preserveAspectRatio="xMidYMid meet"/>`
        : MOTIF_ART[motif] || ''}</g>`;
    }
    // Keep only wrapped copies that intersect the tile. References reuse paths.
    content = wrappedPlacements(layout).filter(p => {
      const radius = 46 * p.scale;
      return p.x + radius >= 0 && p.x - radius <= layout.width &&
        p.y + radius >= 0 && p.y - radius <= layout.height;
    }).map(p => `<use href="#${motifIds.get(p.motif)}" color="${escapeHTML(project.palette[p.colorIndex % project.palette.length].color)}"
      transform="translate(${n(p.x)} ${n(p.y)}) rotate(${n(p.rotation)}) scale(${n(p.scale)})"/>`).join('');
  }
  const transform = c.mode === 'raster' ? ` patternTransform="rotate(${c.rotation}) scale(${c.scale})"` : '';
  return `<defs>${definitions}<pattern id="${prefix}-pattern" patternUnits="userSpaceOnUse"
    width="${n(layout.width * tileScale)}" height="${n(layout.height * tileScale)}"
    viewBox="0 0 ${n(layout.width)} ${n(layout.height)}" preserveAspectRatio="none"${transform}>
    <rect width="${n(layout.width)}" height="${n(layout.height)}" fill="${escapeHTML(background)}"/>${content}
    </pattern></defs>`;
}

// band: biye renginde dolu lastik bel; ribs: bandın orta çizgisi (fitil dokusu için).
const SHAPES = {
  tank: {
    body: 'M48 28 L76 18 Q78 59 100 59 Q122 59 124 18 L152 28 L151 56 Q150 82 174 93 L165 229 Q100 243 35 229 L26 93 Q50 82 49 56Z',
    trim: 'M76 18 Q78 59 100 59 Q122 59 124 18 M48 28 L49 56 Q50 82 26 93 M152 28 L151 56 Q150 82 174 93',
    seam: 'M39 221 Q100 234 161 221 M39 217 Q100 230 161 217',
  },
  cami: {
    body: 'M61 18 L68 18 L70 62 Q100 78 130 62 L132 18 L139 18 L141 60 Q150 80 166 84 L160 229 Q100 242 40 229 L34 84 Q50 80 59 60Z',
    trim: 'M64.5 14 L64.5 61 M135.5 14 L135.5 61 M70 62 Q100 78 130 62 M141 60 Q150 80 166 84 M59 60 Q50 80 34 84',
    seam: 'M43 221 Q100 233 157 221 M43 217 Q100 229 157 217',
  },
  'brief-front': {
    body: 'M23 76 Q100 88 177 76 L162 129 Q135 141 120 187 L80 187 Q65 141 38 129Z',
    trim: 'M38 129 Q65 141 80 187 L120 187 Q135 141 162 129',
    band: 'M15 76 Q100 88 185 76 L185 85 Q100 97 15 85Z',
    ribs: 'M15 80.5 Q100 92.5 185 80.5', ribWidth: 9,
    seam: 'M79 173 Q100 178 121 173 M20 87.5 Q100 99.5 180 87.5',
  },
  'brief-back': {
    body: 'M23 76 Q100 85 177 76 L165 139 Q147 156 128 186 Q100 194 72 186 Q53 156 35 139Z',
    trim: 'M35 139 Q53 156 72 186 Q100 194 128 186 Q147 156 165 139',
    band: 'M15 76 Q100 85 185 76 L185 85 Q100 94 15 85Z',
    ribs: 'M15 80.5 Q100 89.5 185 80.5', ribWidth: 9,
    seam: 'M100 97 L100 177 M20 87.5 Q100 96.5 180 87.5',
  },
  boxer: {
    body: 'M37 49 Q100 59 163 49 L174 210 Q140 217 108 210 L100 151 L92 210 Q60 217 26 210Z',
    trim: '',
    band: 'M28 49 Q100 59 172 49 L172 62 Q100 72 28 62Z',
    ribs: 'M28 55.5 Q100 65.5 172 55.5', ribWidth: 13,
    seam: 'M81 68 L81 125 Q100 147 119 125 L119 68 M100 68 L100 136 M32 64.5 Q100 74.5 168 64.5'
      + ' M27 203 Q60 210 92 203 M108 203 Q140 210 173 203 M27 199.5 Q60 206.5 92 199.5 M108 199.5 Q140 206.5 173 199.5',
  },
};

export function productLabel(variant) {
  if (variant.pack === 'set') return `${variant.product === 'cami' ? 'Askılı atlet' : 'Atlet'} + ${variant.product === 'boxer' ? 'boxer' : 'külot'} takım`;
  return `${PRODUCTS[variant.product]}${variant.pack === 'single' ? '' : ` · ${variant.pack}’li paket`}`;
}
function garmentItems(variant) {
  if (variant.pack === 'set') return [variant.product === 'cami' ? 'cami' : 'tank',
    variant.product === 'boxer' ? 'boxer' : variant.product === 'brief-back' ? 'brief-back' : 'brief-front'];
  return Array.from({ length: variant.pack === 'single' ? 1 : Number(variant.pack) }, () => variant.product);
}
// Kalıpların 200×250 kutusundaki dolu alanı: takım üst üste dizilirken boşluk kalmasın.
const EXTENT = { tank: [18, 243], cami: [18, 237], 'brief-front': [76, 187], 'brief-back': [76, 194], boxer: [49, 217] };
/** stack=true: föy düzeni; takım üstte atlet, altta alt parça olacak şekilde dizilir. */
export function garmentSVG(project, variant, className = '', stack = false) {
  const prefix = uid();
  const items = garmentItems(variant);
  const count = items.length;
  const types = [...new Set(items)];
  const defs = types.map(type => {
    const s = SHAPES[type];
    const clipId = `${prefix}-clip-${type}`;
    return `<clipPath id="${clipId}"><path d="${s.body}"/></clipPath>
      <g id="${prefix}-garment-${type}">
        <g clip-path="url(#${clipId})">
          <rect width="200" height="250" fill="url(#${prefix}-pattern)"/>
          <path d="${s.trim}" stroke="${escapeHTML(variant.trim)}" stroke-width="12" fill="none"/>
          ${s.band ? `<path d="${s.band}" fill="${escapeHTML(variant.trim)}"/>
          <path d="${s.ribs}" stroke="#000" opacity=".17" stroke-width="${s.ribWidth}" stroke-dasharray=".8 2.4" fill="none"/>` : ''}
          <path d="${s.seam}" stroke="#263F35" opacity=".3" stroke-width="1.4" stroke-dasharray="3 2" fill="none"/>
        </g><path d="${s.body}" fill="none" stroke="#34483D" stroke-width="1.1" opacity=".45"/>
      </g>`;
  }).join('');
  let width = 360, height = 300, garments;
  if (stack && variant.pack === 'set') {
    const [top, bottom] = items;
    const offset = EXTENT[top][1] + 10 - EXTENT[bottom][0];
    width = 200; height = offset + EXTENT[bottom][1] - EXTENT[top][0] + 6;
    garments = `<g transform="translate(0 ${3 - EXTENT[top][0]})"><use href="#${prefix}-garment-${top}"/>
      <use href="#${prefix}-garment-${bottom}" transform="translate(0 ${offset})"/></g>`;
  } else {
    const columns = count === 1 ? 1 : count <= 3 ? count : 3;
    const rows = Math.ceil(count / columns);
    const cellW = 360 / columns;
    const cellH = 300 / rows;
    const scale = Math.min(cellW / 205, cellH / 250);
    garments = items.map((type, i) => {
      const row = Math.floor(i / columns);
      const inRow = Math.min(columns, count - row * columns);
      const offset = (360 - inRow * cellW) / 2;
      const x = offset + (i % columns) * cellW + (cellW - 200 * scale) / 2;
      const y = row * cellH + (cellH - 250 * scale) / 2;
      return `<use href="#${prefix}-garment-${type}" transform="translate(${n(x)} ${n(y)}) scale(${n(scale)})"/>`;
    }).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${n(height)}" class="${escapeHTML(className)}"
    role="img" aria-label="${escapeHTML(productLabel(variant))}" data-composition-seed="${project.composition.seed}">
    ${patternDefinitions(project, variant.background, prefix, 0.35)}<defs>${defs}</defs>${garments}</svg>`;
}

export function swatchSVG(project, background = project.background, className = '') {
  const prefix = uid();
  const layout = compositionLayout(project);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${n(layout.height)}"
    class="${escapeHTML(className)}" role="img" aria-label="Ortak tekrar deseni"
    data-composition-seed="${project.composition.seed}" preserveAspectRatio="xMidYMid meet">
    ${patternDefinitions(project, background, prefix, 1)}
    <rect width="${layout.width}" height="${n(layout.height)}" fill="url(#${prefix}-pattern)"/></svg>`;
}

// Desen kutusunun sığacağı en büyük alan (mm): [en, boy].
const SWATCH_BOX = { 'A5-landscape': [66, 56], 'A5-portrait': [44, 58], 'A6-landscape': [42, 33], 'A6-portrait': [28, 36] };
const cm = value => String(value).replace('.', ',');
function chipRow(title, colors) {
  return `<div class="sheet-chips"><b>${title}</b><div>${colors.map(c => `<span class="sheet-chip"
    style="background:${escapeHTML(c.color)};color:${readableInk(c.color)}" title="${escapeHTML(`${c.label} · ${c.name} · ${c.color}`)}">
    <b>${c.label}</b><i>${escapeHTML(c.name)}</i>${c.code ? `<i>${escapeHTML(c.code)}</i>` : ''}</span>`).join('')}</div></div>`;
}

export function printSheetsHTML(project) {
  const pages = paginateVariants(project.variants, project.presentation.paper);
  const { paper, orientation } = project.presentation;
  const c = project.composition;
  const [maxW, maxH] = SWATCH_BOX[`${paper}-${orientation}`];
  const ratio = c.repeatWidthCm / c.repeatHeightCm;
  const swatchW = Math.min(maxW, maxH * ratio), swatchH = swatchW / ratio;
  const size = project.size.trim(), fabric = project.fabric.trim();
  return pages.map((variants, pageIndex) => {
    const offset = pageIndex * (paper === 'A5' ? 6 : 3);
    const colors = sheetColors(project, variants);
    return `<article class="print-sheet paper-${paper.toLowerCase()} ${orientation}" data-testid="print-sheet" data-page="${pageIndex + 1}">
      <header class="sheet-header">
        <strong class="sheet-title">DESEN ${escapeHTML(project.designCode)}</strong>
        <div class="sheet-brand"><span>${escapeHTML(project.name)}</span><strong>${escapeHTML(project.company)}</strong></div>
      </header>
      <div class="sheet-body">
        <aside class="sheet-source">
          <div class="sheet-original">ORİJİNAL BOY</div>
          <div class="sheet-swatch-row">
            <div class="sheet-swatch" style="width:${n(swatchW)}mm;height:${n(swatchH)}mm">${swatchSVG(project)}</div>
            <span class="sheet-dim-h">${cm(c.repeatHeightCm)} cm</span>
          </div>
          <div class="sheet-dim-w" style="width:${n(swatchW)}mm">${cm(c.repeatWidthCm)} cm</div>
          <p class="sheet-scale-note">Ölçekli önizleme · gerçek boy değildir.</p>
          ${chipRow('DESEN RENKLERİ', colors.design)}
          ${chipRow('ZEMİN RENKLERİ', colors.grounds)}
          <p class="sheet-spec" data-testid="sheet-spec"><strong>Grup:</strong> ${AUDIENCES[project.audience].label}${
            size ? `<br><strong>Beden:</strong> ${escapeHTML(size)}` : ''}${
            fabric ? `<br><strong>Kumaş:</strong> ${escapeHTML(fabric)}` : ''}</p>
        </aside>
        <section class="sheet-variants" aria-label="Numaralı ürün varyantları">
          ${variants.map((v, i) => `<div class="sheet-variant" data-variant-id="${escapeHTML(v.id)}">
            <b class="sheet-variant-title">VARYANT ${offset + i + 1}</b>
            ${garmentSVG(project, v, '', true)}
            <span class="sheet-variant-name">${escapeHTML(v.label)} · ${escapeHTML(productLabel(v))}</span>
          </div>`).join('')}
        </section>
      </div>
      <footer class="sheet-footer"><span aria-hidden="true">${escapeHTML(`${project.company} `.repeat(30))}</span>
        <b>${escapeHTML(project.designCode)} · ${pageIndex + 1} / ${pages.length}</b></footer>
    </article>`;
  }).join('');
}
