import { compositionLayout, wrappedPlacements, paginateVariants, printPalette, PRODUCTS } from './design.js';

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

const SHAPES = {
  tank: {
    body: 'M48 28 L76 18 Q78 59 100 59 Q122 59 124 18 L152 28 L151 56 Q150 82 174 93 L165 229 Q100 243 35 229 L26 93 Q50 82 49 56Z',
    trim: 'M76 18 Q78 59 100 59 Q122 59 124 18 M48 28 L49 56 Q50 82 26 93 M152 28 L151 56 Q150 82 174 93',
    seam: 'M39 221 Q100 234 161 221',
  },
  'brief-front': {
    body: 'M23 76 Q100 88 177 76 L162 129 Q135 141 120 187 L80 187 Q65 141 38 129Z',
    trim: 'M23 76 Q100 88 177 76 M38 129 Q65 141 80 187 L120 187 Q135 141 162 129',
    seam: 'M79 173 Q100 178 121 173',
  },
  'brief-back': {
    body: 'M23 76 Q100 85 177 76 L165 139 Q147 156 128 186 Q100 194 72 186 Q53 156 35 139Z',
    trim: 'M23 76 Q100 85 177 76 M35 139 Q53 156 72 186 Q100 194 128 186 Q147 156 165 139',
    seam: 'M100 91 L100 177',
  },
  boxer: {
    body: 'M37 49 Q100 59 163 49 L174 210 Q140 217 108 210 L100 151 L92 210 Q60 217 26 210Z',
    trim: 'M37 49 Q100 59 163 49 M26 210 Q60 217 92 210 M108 210 Q140 217 174 210',
    seam: 'M81 65 L81 125 Q100 147 119 125 L119 65 M100 65 L100 136',
  },
};

export function productLabel(variant) {
  if (variant.pack === 'set') return variant.product === 'boxer' ? 'Atlet + boxer takım' : 'Atlet + külot takım';
  return `${PRODUCTS[variant.product]}${variant.pack === 'single' ? '' : ` · ${variant.pack}’li paket`}`;
}
function garmentItems(variant) {
  if (variant.pack === 'set') return ['tank', variant.product === 'boxer' ? 'boxer' : variant.product === 'brief-back' ? 'brief-back' : 'brief-front'];
  return Array.from({ length: variant.pack === 'single' ? 1 : Number(variant.pack) }, () => variant.product);
}
export function garmentSVG(project, variant, className = '') {
  const prefix = uid();
  const items = garmentItems(variant);
  const count = items.length;
  const columns = count === 1 ? 1 : count <= 3 ? count : 3;
  const rows = Math.ceil(count / columns);
  const cellW = 360 / columns;
  const cellH = 300 / rows;
  const scale = Math.min(cellW / 205, cellH / 250);
  const types = [...new Set(items)];
  const defs = types.map(type => {
    const s = SHAPES[type];
    const clipId = `${prefix}-clip-${type}`;
    return `<clipPath id="${clipId}"><path d="${s.body}"/></clipPath>
      <g id="${prefix}-garment-${type}">
        <g clip-path="url(#${clipId})">
          <rect width="200" height="250" fill="url(#${prefix}-pattern)"/>
          <path d="${s.trim}" stroke="${escapeHTML(variant.trim)}" stroke-width="12" fill="none"/>
          <path d="${s.seam}" stroke="#263F35" opacity=".3" stroke-width="1.4" stroke-dasharray="3 2" fill="none"/>
        </g><path d="${s.body}" fill="none" stroke="#34483D" stroke-width="1.1" opacity=".45"/>
      </g>`;
  }).join('');
  const garments = items.map((type, i) => {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, count - row * columns);
    const offset = (360 - inRow * cellW) / 2;
    const x = offset + (i % columns) * cellW + (cellW - 200 * scale) / 2;
    const y = row * cellH + (cellH - 250 * scale) / 2;
    return `<use href="#${prefix}-garment-${type}" transform="translate(${n(x)} ${n(y)}) scale(${n(scale)})"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" class="${escapeHTML(className)}"
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

export function printSheetsHTML(project) {
  const pages = paginateVariants(project.variants, project.presentation.paper);
  const { paper, orientation } = project.presentation;
  return pages.map((variants, pageIndex) => {
    const offset = pageIndex * (paper === 'A5' ? 6 : 3);
    const palette = printPalette(project, variants);
    return `<article class="print-sheet paper-${paper.toLowerCase()} ${orientation}" data-testid="print-sheet" data-page="${pageIndex + 1}">
      <header class="sheet-header">
        <div><strong>${escapeHTML(project.company)}</strong><span>${escapeHTML(project.name)}</span></div>
        <div class="sheet-code"><strong>${escapeHTML(project.designCode)}</strong><span>TEKSTİL TASARIM FÖYÜ</span></div>
      </header>
      <div class="sheet-body">
        <aside class="sheet-source">
          <h3>01 / KAYNAK DESEN</h3>
          <div class="sheet-swatch">${swatchSVG(project)}</div>
          <p class="repeat-caption"><strong>Tekrar: ${project.composition.repeatWidthCm} × ${project.composition.repeatHeightCm} cm</strong><br>
          Ölçekli önizleme · gerçek boy değildir.</p>
          ${project.size.trim() || project.fabric.trim() ? `<p class="repeat-caption sheet-spec" data-testid="sheet-spec">${
            project.size.trim() ? `<strong>Beden:</strong> ${escapeHTML(project.size.trim())}` : ''}${
            project.size.trim() && project.fabric.trim() ? '<br>' : ''}${
            project.fabric.trim() ? `<strong>Kumaş:</strong> ${escapeHTML(project.fabric.trim())}` : ''}</p>` : ''}
          <h3>RENK KARTELASI</h3>
          <div class="sheet-palette">${palette.map(p => `<div class="sheet-color" title="${escapeHTML(`${p.name} · ${p.code || p.color} · ${p.color}`)}">
            <i style="background:${escapeHTML(p.color)}"></i><div><b>${escapeHTML(p.name)}</b><span>${escapeHTML(p.code || p.color)}</span></div>
          </div>`).join('')}</div>
          <p class="sheet-color-note">Kodlar kullanıcı tanımlıdır. Resmî TPX / Pantone eşleşmesi veya baskı renk garantisi değildir.</p>
        </aside>
        <section class="sheet-variants" aria-label="Numaralı ürün varyantları">
          ${variants.map((v, i) => `<div class="sheet-variant" data-variant-id="${escapeHTML(v.id)}">
            <div class="sheet-variant-head"><b>${String(offset + i + 1).padStart(2, '0')}</b><span>${escapeHTML(v.label)}</span></div>
            ${garmentSVG(project, v)}
            <div class="sheet-variant-meta"><strong>${escapeHTML(productLabel(v))}</strong>
              <span>Z ${escapeHTML(v.background)} · B ${escapeHTML(v.trim)}</span></div>
          </div>`).join('')}
        </section>
      </div>
      <footer class="sheet-footer"><span>KumashAi · ${escapeHTML(project.designCode)} · Ortak kompozisyon ${project.composition.seed}</span>
        <span>${paper} ${orientation === 'landscape' ? 'yatay' : 'dikey'} · ${pageIndex + 1} / ${pages.length}</span></footer>
    </article>`;
  }).join('');
}
