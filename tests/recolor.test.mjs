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
