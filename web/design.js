/** Pure domain model. No DOM, dependencies, fetch, or implicit randomness. */
export const LIMITS = Object.freeze({
  projectBytes: 20 * 1024 * 1024,
  assetBytes: 10 * 1024 * 1024,
  totalAssetBytes: 12 * 1024 * 1024,
  pixels: 16_000_000,
  dimension: 16384,
  assets: 8,
  variants: 60,
  palette: 8,
  backgrounds: 12,
});
export const MOTIFS = Object.freeze({
  bunny: 'Minik tavşan',
  star: 'Yıldız',
  cloud: 'Bulut',
  flower: 'Papatya',
  geometric: 'Geometrik',
  dog: 'Köpek',
  bug: 'Uğur böceği',
});
export const PRODUCTS = Object.freeze({
  tank: 'Atlet',
  cami: 'Askılı atlet',
  'brief-front': 'Külot · ön',
  'brief-back': 'Külot · arka',
  boxer: 'Boxer',
});
/** Kimin için: ürün listesini süzer ve föyde yazılır. */
export const AUDIENCES = Object.freeze({
  kadin: Object.freeze({ label: 'Kadın', products: Object.freeze(['cami', 'tank', 'brief-front', 'brief-back']) }),
  erkek: Object.freeze({ label: 'Erkek', products: Object.freeze(['tank', 'boxer']) }),
  cocuk: Object.freeze({ label: 'Çocuk', products: Object.freeze(['tank', 'cami', 'brief-front', 'brief-back', 'boxer']) }),
});
export const PACKS = Object.freeze({
  single: 'Tek ürün',
  set: 'Atlet + külot takım',
  '3': 'Üçlü paket',
  '5': 'Beşli paket',
});
export const PAPER = Object.freeze({
  A5: { width: 148, height: 210, capacity: 6 },
  A6: { width: 105, height: 148, capacity: 3 },
});
/** Hazır zemin önerileri; ekran rengi baskı/boya garantisi değildir. */
export const GROUND_NAMES = Object.freeze({
  '#F9C9D4': 'Şeker pembesi', '#BFE8D4': 'Mint yeşili', '#F1E9D8': 'Ekru',
  '#F4EEE2': 'Vanilya', '#E3EBE2': 'Adaçayı', '#F2DBD1': 'Pudra', '#DEE6EB': 'Buz mavisi', '#F3E5BA': 'Saman',
});
export const COLOR = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,47}$/;
const encoder = new TextEncoder();
export const byteLength = text => encoder.encode(text).length;
export const clone = value => JSON.parse(JSON.stringify(value));

export function defaultProject() {
  return {
    version: 1,
    name: 'Kır Bahçesi',
    designCode: 'KMS-026',
    company: 'Kumash Tekstil',
    audience: 'cocuk',
    size: '',
    fabric: '',
    palette: [
      { id: 'sage', name: 'Adaçayı', code: 'K-101', color: '#7B947B' },
      { id: 'clay', name: 'Kiremit', code: 'K-102', color: '#C78169' },
      { id: 'cream', name: 'Vanilya', code: 'K-103', color: '#F0DAAB' },
      { id: 'ink', name: 'Orman', code: 'K-104', color: '#31564B' },
    ],
    composition: {
      mode: 'motifs',
      motifs: ['bunny', 'star', 'flower'],
      rasterAssetId: null,
      seed: 24026,
      scale: 1,
      rotation: 0,
      density: 18,
      repeatWidthCm: 20,
      repeatHeightCm: 20,
    },
    assets: [],
    background: '#F4EEE2',
    trim: '#7B947B',
    product: 'tank',
    pack: 'single',
    selectedBackgrounds: ['#F4EEE2', '#E3EBE2', '#F2DBD1'],
    variants: [
      { id: 'demo-1', label: 'Vanilya', background: '#F4EEE2', trim: '#7B947B', product: 'tank', pack: 'set' },
      { id: 'demo-2', label: 'Adaçayı', background: '#E3EBE2', trim: '#7B947B', product: 'brief-front', pack: '3' },
      { id: 'demo-3', label: 'Pudra', background: '#F2DBD1', trim: '#7B947B', product: 'boxer', pack: 'single' },
    ],
    presentation: { paper: 'A5', orientation: 'landscape' },
  };
}

function fail(message) { throw new Error(message); }
function record(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${path}: nesne bekleniyor.`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) fail(`${path}: eksik veya bilinmeyen alan.`);
}
function text(value, max, path, empty = false) {
  if (typeof value !== 'string' || value.length > max ||
      (!empty && !value.trim()) || /[\u0000-\u0008\u000B-\u001F\u007F]/.test(value))
    fail(`${path}: geçersiz metin (en fazla ${max} karakter).`);
}
function number(value, min, max, path, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) fail(`${path}: ${min}–${max} arasında ${integer ? 'tam ' : ''}sayı gerekli.`);
}
function enumeration(value, options, path) {
  if (!options.includes(value)) fail(`${path}: geçersiz seçenek.`);
}
function color(value, path) {
  if (typeof value !== 'string' || !COLOR.test(value)) fail(`${path}: #RRGGBB biçiminde renk gerekli.`);
}
function array(value, min, max, path) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(`${path}: ${min}–${max} öğe gerekli.`);
}
function unique(values, path) {
  if (new Set(values).size !== values.length) fail(`${path}: yinelenen öğe.`);
}
function id(value, path) {
  if (typeof value !== 'string' || !ID.test(value)) fail(`${path}: geçersiz kimlik.`);
}

/** Validates payload syntax, magic bytes, and budgets; browser MUST also decode. */
export function inspectImageData(dataUrl, mime) {
  if (typeof dataUrl !== 'string' || !['image/png', 'image/jpeg'].includes(mime)) fail('Yalnız PNG veya JPEG görsel kullanılabilir.');
  const prefix = `data:${mime};base64,`;
  if (!dataUrl.startsWith(prefix)) fail('Görsel yalnız kendi PNG/JPEG verisini içermeli.');
  const payload = dataUrl.slice(prefix.length);
  if (payload.length > Math.ceil(LIMITS.assetBytes / 3) * 4) fail('Her görsel en fazla 10 MB olabilir.');
  if (!payload.length || payload.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(payload))
    fail('Geçersiz base64 görsel.');
  const bytes = payload.length / 4 * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
  if (bytes > LIMITS.assetBytes) fail('Her görsel en fazla 10 MB olabilir.');
  // atob is available both in modern browsers and supported Node versions.
  const head = atob(payload.slice(0, 32));
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (mime === 'image/png' && !png.every((n, i) => head.charCodeAt(i) === n)) fail('PNG dosya imzası geçersiz.');
  if (mime === 'image/jpeg' && !(head.charCodeAt(0) === 255 && head.charCodeAt(1) === 216 && head.charCodeAt(2) === 255))
    fail('JPEG dosya imzası geçersiz.');
  return bytes;
}

/** Read header dimensions before allocation; decode still verifies real image data. */
export function imageHeaderDimensions(bytes, mime) {
  if (!(bytes instanceof Uint8Array)) fail('Görsel baytları okunamadı.');
  if (mime === 'image/png') {
    if (bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n) ||
        String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') fail('PNG başlığı bozuk.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return validateDimensions(view.getUint32(16), view.getUint32(20));
  }
  if (mime !== 'image/jpeg' || bytes[0] !== 255 || bytes[1] !== 216) fail('JPEG başlığı bozuk.');
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 255) fail('JPEG işaretçisi bozuk.');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xD9 || marker === 0xDA) break;
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) fail('JPEG bölümü bozuk.');
    if ([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF].includes(marker)) {
      if (length < 8) fail('JPEG ölçüleri bozuk.');
      return validateDimensions((bytes[offset + 5] << 8) | bytes[offset + 6], (bytes[offset + 3] << 8) | bytes[offset + 4]);
    }
    offset += length;
  }
  fail('JPEG ölçüleri okunamadı.');
}
export function validateDimensions(width, height) {
  number(width, 1, LIMITS.dimension, 'Görsel genişliği', true);
  number(height, 1, LIMITS.dimension, 'Görsel yüksekliği', true);
  if (width * height > LIMITS.pixels) fail('Görsel en fazla 16 megapiksel olabilir.');
  return { width, height };
}

/** Grup/beden/kumaş alanları sonradan eklendi; eski sürüm 1 kayıtları varsayılanla açılır. */
function withSpecDefaults(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) return project;
  return { audience: 'cocuk', size: '', fabric: '', ...project };
}
export function validateProject(project) {
  project = withSpecDefaults(project);
  record(project, ['version', 'name', 'designCode', 'company', 'audience', 'size', 'fabric', 'palette', 'composition', 'assets',
    'background', 'trim', 'product', 'pack', 'selectedBackgrounds', 'variants', 'presentation'], 'Proje');
  if (project.version !== 1) fail('Desteklenmeyen proje sürümü. Sürüm 1 gerekli.');
  text(project.name, 80, 'Proje adı');
  text(project.designCode, 40, 'Desen kodu');
  text(project.company, 80, 'Firma adı');
  enumeration(project.audience, Object.keys(AUDIENCES), 'Grup');
  text(project.size, 40, 'Beden', true);
  text(project.fabric, 80, 'Kumaş', true);
  array(project.palette, 1, LIMITS.palette, 'Palet');
  project.palette.forEach(p => {
    record(p, ['id', 'name', 'code', 'color'], 'Palet rengi');
    id(p.id, 'Renk kimliği');
    text(p.name, 32, 'Renk adı');
    text(p.code, 32, 'Kullanıcı renk kodu', true);
    color(p.color, 'Palet rengi');
  });
  unique(project.palette.map(p => p.id), 'Renk kimlikleri');
  array(project.assets, 0, LIMITS.assets, 'Görseller');
  let totalBytes = 0;
  project.assets.forEach(asset => {
    record(asset, ['id', 'name', 'mime', 'width', 'height', 'dataUrl'], 'Görsel');
    id(asset.id, 'Görsel kimliği');
    text(asset.name, 120, 'Görsel adı');
    validateDimensions(asset.width, asset.height);
    totalBytes += inspectImageData(asset.dataUrl, asset.mime);
  });
  if (totalBytes > LIMITS.totalAssetBytes) fail('Projede toplam görsel boyutu 12 MB sınırını aşıyor; JSON yedeği yeniden açılabilir olmalı.');
  unique(project.assets.map(asset => asset.id), 'Görsel kimlikleri');
  const c = project.composition;
  record(c, ['mode', 'motifs', 'rasterAssetId', 'seed', 'scale', 'rotation', 'density', 'repeatWidthCm', 'repeatHeightCm'], 'Kompozisyon');
  enumeration(c.mode, ['motifs', 'raster'], 'Desen modu');
  array(c.motifs, 0, 13, 'Motifler');
  const allowed = [...Object.keys(MOTIFS), ...project.assets.filter(a => a.mime === 'image/png').map(a => `asset:${a.id}`)];
  c.motifs.forEach(motif => enumeration(motif, allowed, 'Motif'));
  unique(c.motifs, 'Motifler');
  if (c.rasterAssetId !== null && !project.assets.some(a => a.id === c.rasterAssetId)) fail('Raster görsel bulunamadı.');
  if (c.mode === 'raster' && c.rasterAssetId === null) fail('Raster modu için bir görsel seçin.');
  number(c.seed, 0, 0xFFFFFFFF, 'Seed', true);
  number(c.scale, 0.35, 2, 'Ölçek');
  number(c.rotation, -180, 180, 'Dönüş');
  number(c.density, 4, 40, 'Sıklık', true);
  number(c.repeatWidthCm, 5, 50, 'Tekrar eni');
  number(c.repeatHeightCm, 5, 50, 'Tekrar boyu');
  color(project.background, 'Zemin');
  color(project.trim, 'Biye');
  enumeration(project.product, Object.keys(PRODUCTS), 'Ürün');
  enumeration(project.pack, Object.keys(PACKS), 'Paket');
  array(project.selectedBackgrounds, 0, LIMITS.backgrounds, 'Toplu zeminler');
  project.selectedBackgrounds.forEach(bg => color(bg, 'Toplu zemin'));
  unique(project.selectedBackgrounds.map(bg => bg.toUpperCase()), 'Toplu zeminler');
  array(project.variants, 0, LIMITS.variants, 'Varyantlar');
  project.variants.forEach(v => {
    record(v, ['id', 'label', 'background', 'trim', 'product', 'pack'], 'Varyant');
    id(v.id, 'Varyant kimliği');
    text(v.label, 48, 'Varyant adı');
    color(v.background, 'Varyant zemini');
    color(v.trim, 'Varyant biyesi');
    enumeration(v.product, Object.keys(PRODUCTS), 'Varyant ürünü');
    enumeration(v.pack, Object.keys(PACKS), 'Varyant paketi');
  });
  unique(project.variants.map(v => v.id), 'Varyant kimlikleri');
  record(project.presentation, ['paper', 'orientation'], 'Sunum');
  enumeration(project.presentation.paper, Object.keys(PAPER), 'Kâğıt');
  enumeration(project.presentation.orientation, ['landscape', 'portrait'], 'Yön');
  if (byteLength(JSON.stringify(project)) > LIMITS.projectBytes) fail('Proje JSON dosyası en fazla 20 MB olabilir.');
  return clone(project);
}

export function parseProject(json) {
  if (typeof json !== 'string' || byteLength(json) > LIMITS.projectBytes) fail('Proje JSON dosyası en fazla 20 MB olabilir.');
  let parsed;
  try { parsed = JSON.parse(json); } catch { fail('Geçersiz JSON; mevcut proje değiştirilmedi.'); }
  return validateProject(parsed);
}
export function serializeProject(project) {
  const json = JSON.stringify(validateProject(project), null, 2);
  if (byteLength(json) > LIMITS.projectBytes) fail('JSON yedeği 20 MB sınırını aşıyor.');
  return json;
}
export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = value;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
export function compositionLayout(project) {
  const c = project.composition;
  const width = 240;
  const height = width * c.repeatHeightCm / c.repeatWidthCm;
  const result = { width, height, placements: [] };
  if (c.mode !== 'motifs' || c.motifs.length === 0) return result;
  const random = seededRandom(c.seed);
  const columns = Math.ceil(Math.sqrt(c.density * width / height));
  const rows = Math.ceil(c.density / columns);
  for (let i = 0; i < c.density; i++) {
    result.placements.push({
      motif: c.motifs[Math.floor(random() * c.motifs.length)],
      x: ((i % columns + random() * 0.65 + 0.05) / columns) * width,
      y: ((Math.floor(i / columns) + random() * 0.65 + 0.05) / rows) * height,
      rotation: c.rotation + (random() - 0.5) * 48,
      scale: c.scale * (0.72 + random() * 0.3) * Math.min(1, height / width),
      colorIndex: Math.floor(random() * 65536),
    });
  }
  return result;
}
export function wrappedPlacements(layout) {
  return layout.placements.flatMap(p =>
    [-layout.width, 0, layout.width].flatMap(dx =>
      [-layout.height, 0, layout.height].map(dy => ({ ...p, x: p.x + dx, y: p.y + dy }))));
}
export function variantFromDraft(project, id, label = 'Yeni renk') {
  return { id, label, background: project.background, trim: project.trim, product: project.product, pack: project.pack };
}
export function batchVariants(project, ids) {
  if (ids.length !== project.selectedBackgrounds.length) fail('Her zemin için bir kimlik gerekli.');
  if (project.variants.length + ids.length > LIMITS.variants) fail('En fazla 60 varyant oluşturulabilir.');
  return project.selectedBackgrounds.map((background, i) => ({
    ...variantFromDraft(project, ids[i], `Renk ${project.variants.length + i + 1}`), background,
  }));
}
export function paginateVariants(variants, paper = 'A5') {
  if (!PAPER[paper]) fail('Kâğıt boyutu geçersiz.');
  const pages = [];
  for (let i = 0; i < variants.length; i += PAPER[paper].capacity) pages.push(variants.slice(i, i + PAPER[paper].capacity));
  return pages;
}
export function paperDimensions(paper, orientation) {
  const p = PAPER[paper];
  if (!p || !['landscape', 'portrait'].includes(orientation)) fail('Kâğıt ayarı geçersiz.');
  return orientation === 'landscape' ? { width: p.height, height: p.width } : { width: p.width, height: p.height };
}
export function printPalette(project, variants = project.variants) {
  const result = [];
  const seen = new Set();
  const add = (color, name, code = '') => {
    const key = color.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ color, name, code });
  };
  // User codes are independent metadata: never drop a second code just because
  // two catalog entries happen to share the same approximate screen HEX.
  project.palette.forEach(p => {
    result.push({ color: p.color, name: p.name, code: p.code });
    seen.add(p.color.toUpperCase());
  });
  add(project.background, 'Kaynak zemini');
  variants.forEach((v, i) => {
    add(v.background, `Zemin ${i + 1}`);
    add(v.trim, `Biye ${i + 1}`);
  });
  return result;
}

/** Föydeki renk kareleri: R1… desen renkleri, F1… o sayfadaki ürünlerin zeminleri. */
export function sheetColors(project, variants = project.variants) {
  const design = project.palette.map((p, i) => ({ label: `R${i + 1}`, name: p.name, code: p.code, color: p.color }));
  const grounds = [];
  for (const v of variants) {
    const color = v.background.toUpperCase();
    if (!grounds.some(g => g.color === color))
      grounds.push({ label: `F${grounds.length + 1}`, name: GROUND_NAMES[color] || color, code: '', color });
  }
  return { design, grounds };
}
/** Koyu renk üstünde beyaz, açık renk üstünde koyu yazı. */
export function readableInk(color) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#22262A' : '#FFFFFF';
}
