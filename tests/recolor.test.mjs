import test from 'node:test';
import assert from 'node:assert/strict';
import { extractColors, recolor, guessBackground, toHex, toRgb } from '../web/recolor.js';

// 4×4: beyaz zemin, ortada 2×2 kırmızı blok.
function sample() {
  const data = new Uint8ClampedArray(64);
  for (let p = 0; p < 16; p++) {
    const x = p % 4, y = Math.floor(p / 4);
    const red = x >= 1 && x <= 2 && y >= 1 && y <= 2;
    data.set(red ? [220, 30, 40, 255] : [255, 255, 255, 255], p * 4);
  }
  return data;
}

test('baskın renkler paya göre sıralı bulunur', () => {
  const colors = extractColors(sample(), 8);
  assert.equal(colors.length, 2);
  assert.equal(toHex(colors[0].rgb), '#FFFFFF');
  assert.equal(toHex(colors[1].rgb), '#DC1E28');
  assert.equal(colors[0].share, 0.75);
});

test('köşe rengi zemin olarak tahmin edilir', () => {
  const data = sample();
  const centers = extractColors(data).map(c => c.rgb);
  assert.equal(guessBackground(data, 4, 4, centers), 0);
});

test('renk değişir, zemin şeffaf olur, dokunulmayan renk aynı kalır', () => {
  const data = sample();
  const centers = extractColors(data).map(c => c.rgb);
  const out = recolor(data, centers, [{ rgb: [255, 255, 255], transparent: true }, { rgb: toRgb('#1050A0'), transparent: false }]);
  assert.deepEqual([...out.slice(0, 4)], [0, 0, 0, 0]);
  assert.deepEqual([...out.slice(20, 24)], [16, 80, 160, 255]);
  const same = recolor(data, centers, centers.map(rgb => ({ rgb, transparent: false })));
  assert.deepEqual([...same], [...data]);
});

test('beden/kumaş: eski kayıt boş değerle açılır, yeni değer korunur, sınır uygulanır', async () => {
  const { defaultProject, validateProject, parseProject, serializeProject } = await import('../web/design.js');
  const old = defaultProject(); delete old.size; delete old.fabric;
  const upgraded = validateProject(old);
  assert.equal(upgraded.size, ''); assert.equal(upgraded.fabric, '');
  const next = { ...defaultProject(), size: '36 ay', fabric: 'Full likralı süprem' };
  assert.equal(parseProject(serializeProject(next)).fabric, 'Full likralı süprem');
  assert.throws(() => validateProject({ ...defaultProject(), size: 'x'.repeat(41) }));
});

test('figür: kenara bağlı zemin silinir, iç delik ve figür kalır, sınır kutusu döner', async () => {
  const { cutFigure } = await import('../web/figur.js');
  // 7×7 turkuaz zemin; ortada 3×3 sarı figür, figürün tam ortası zemin renginde (delik).
  const w = 7, data = new Uint8ClampedArray(w * w * 4);
  for (let p = 0; p < w * w; p++) {
    const x = p % w, y = Math.floor(p / w);
    const inside = x >= 2 && x <= 4 && y >= 2 && y <= 4;
    data.set(inside && !(x === 3 && y === 3) ? [240, 200, 40, 255] : [60, 210, 220, 255], p * 4);
  }
  const cut = cutFigure(data, w, w, 40);
  assert.deepEqual(cut.bounds, { x: 2, y: 2, width: 3, height: 3 });
  assert.equal(cut.data[3], 0);                       // köşe: silindi
  assert.equal(cut.data[(2 * w + 2) * 4 + 3], 255);   // figür: duruyor
  assert.equal(cut.data[(3 * w + 3) * 4 + 3], 255);   // kenara bağlı olmayan delik: duruyor
  assert.equal(cutFigure(new Uint8ClampedArray(w * w * 4).fill(255), w, w, 40), null);
});

test('föy renk kareleri: desen R1…, sayfadaki zeminler F1… (tekrarsız, adlı)', async () => {
  const { defaultProject, sheetColors, readableInk } = await import('../web/design.js');
  const project = defaultProject();
  project.variants.push({ ...project.variants[0], id: 'again' }, { ...project.variants[0], id: 'pink', background: '#f9c9d4' });
  const { design, grounds } = sheetColors(project);
  assert.deepEqual(design.map(c => c.label), ['R1', 'R2', 'R3', 'R4']);
  assert.deepEqual(grounds.map(g => `${g.label} ${g.name}`), ['F1 Vanilya', 'F2 Adaçayı', 'F3 Pudra', 'F4 Şeker pembesi']);
  assert.equal(readableInk('#17191C'), '#FFFFFF');
  assert.equal(readableInk('#F4EEE2'), '#22262A');
});

test('grup: eski kayıt çocuk olarak açılır; geçersiz grup reddedilir; föyde yazılır', async () => {
  const { defaultProject, validateProject, AUDIENCES, PRODUCTS } = await import('../web/design.js');
  const { printSheetsHTML } = await import('../web/render.js');
  const old = defaultProject(); delete old.audience;
  assert.equal(validateProject(old).audience, 'cocuk');
  assert.throws(() => validateProject({ ...defaultProject(), audience: 'bebek' }));
  for (const group of Object.values(AUDIENCES)) for (const product of group.products) assert.ok(PRODUCTS[product]);
  assert.ok(printSheetsHTML({ ...defaultProject(), audience: 'kadin' }).includes('<strong>Grup:</strong> Kadın'));
});

test('deseni al: zeminle çevrili figürler bulunur; kenara ve kumaş dışına değenler alınmaz', async () => {
  const { findFigures, guessGround } = await import('../web/desen.js');
  // 40×30 "fotoğraf": kahverengi masa, ortada turkuaz kumaş (x 6..33, y 4..25),
  // kumaşın içinde iki sarı figür (6×6), kumaş kenarında yarım kalmış bir figür.
  const w = 40, h = 30, data = new Uint8ClampedArray(w * h * 4);
  const put = (x0, y0, x1, y1, rgb) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data.set([...rgb, 255], (y * w + x) * 4); };
  put(0, 0, w - 1, h - 1, [120, 80, 50]);
  put(6, 4, 33, 25, [70, 215, 215]);
  put(10, 8, 15, 13, [240, 200, 40]);
  put(22, 14, 27, 19, [240, 200, 40]);
  put(30, 20, 35, 25, [240, 200, 40]); // kumaştan taşıyor: masaya değer
  const ground = guessGround(data, w, h, 48);
  assert.ok(Math.abs(ground[0] - 70) < 8 && Math.abs(ground[1] - 215) < 8, 'zemin turkuaz olmalı');
  const { figures, labels } = findFigures(data, w, h, ground, 48);
  assert.deepEqual(figures.map(f => [f.x, f.y, f.width, f.height]).sort(), [[10, 8, 6, 6], [22, 14, 6, 6]]);
  assert.equal(labels[8 * w + 10], figures.find(f => f.x === 10).id);
});
