import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, clone, defaultProject, validateProject, parseProject, serializeProject,
  compositionLayout, wrappedPlacements, seededRandom, inspectImageData,
  imageHeaderDimensions, validateDimensions, variantFromDraft, batchVariants,
  paginateVariants, paperDimensions, printPalette, byteLength,
} from '../web/design.js';
import { garmentSVG, swatchSVG, printSheetsHTML, productLabel, escapeHTML, setAssetRenderSources } from '../web/render.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const pngAsset = () => ({ id: 'img-test', name: 'Özgün.png', mime: 'image/png', width: 1, height: 1, dataUrl: PNG });
const withAsset = () => {
  const p = defaultProject();
  p.assets.push(pngAsset());
  p.composition.motifs.push('asset:img-test');
  p.composition.rasterAssetId = 'img-test';
  return p;
};
const fakePNG = bytes => {
  const buffer = Buffer.alloc(bytes);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  return `data:image/png;base64,${buffer.toString('base64')}`;
};

test('default project is valid version 1 with meaningful motifs and variants', () => {
  const p = defaultProject();
  assert.deepEqual(validateProject(p), p);
  assert.equal(p.version, 1);
  assert.equal(p.variants.length, 3);
  assert.ok(p.composition.motifs.includes('bunny'));
});
test('validation returns an independent object and never mutates the source', () => {
  const p = defaultProject();
  const next = validateProject(p);
  next.variants[0].trim = '#000000';
  assert.notEqual(next.variants[0].trim, p.variants[0].trim);
});
test('composition is deterministic across repeated renders and serialization', () => {
  const p = defaultProject();
  assert.deepEqual(compositionLayout(p), compositionLayout(p));
  assert.deepEqual(compositionLayout(p), compositionLayout(parseProject(serializeProject(p))));
  const r1 = seededRandom(15), r2 = seededRandom(15);
  assert.deepEqual(Array.from({ length: 50 }, r1), Array.from({ length: 50 }, r2));
});
test('background, trim, labels, products, variants, and palette never change placement', () => {
  const p = defaultProject();
  const layout = compositionLayout(p);
  p.background = '#123456'; p.trim = '#fedcba'; p.product = 'boxer'; p.pack = '5';
  p.palette[0].color = '#000000'; p.palette.push({ id: 'extra', color: '#FFFFFF', name: 'Beyaz', code: 'K-0' });
  p.designCode = 'OTHER';
  p.variants = [variantFromDraft(p, 'x')];
  assert.deepEqual(compositionLayout(p), layout);
});
test('seed is explicit and different seeds change composition', () => {
  const p = defaultProject();
  const before = compositionLayout(p);
  p.composition.seed++;
  assert.notDeepEqual(compositionLayout(p), before);
});
test('layout remains finite at extreme supported ratios, scales and densities', () => {
  for (const width of [5, 50]) for (const height of [5, 50]) {
    const p = defaultProject();
    Object.assign(p.composition, { repeatWidthCm: width, repeatHeightCm: height, scale: 2, rotation: -180, density: 40 });
    validateProject(p);
    const layout = compositionLayout(p);
    assert.equal(layout.placements.length, 40);
    for (const placement of layout.placements) {
      assert.ok(placement.x >= 0 && placement.x < layout.width);
      assert.ok(placement.y >= 0 && placement.y < layout.height);
      for (const value of ['x', 'y', 'rotation', 'scale']) assert.ok(Number.isFinite(placement[value]));
    }
  }
});
test('all tile edges get equivalent wrapped translations without randomness', () => {
  const layout = compositionLayout(defaultProject());
  const wrapped = wrappedPlacements(layout);
  assert.equal(wrapped.length, layout.placements.length * 9);
  const p = layout.placements[0];
  for (const dx of [-layout.width, 0, layout.width]) for (const dy of [-layout.height, 0, layout.height]) {
    assert.ok(wrapped.some(w => w.motif === p.motif && w.x === p.x + dx && w.y === p.y + dy && w.rotation === p.rotation));
  }
});
test('empty motifs are a valid blank design with no placements', () => {
  const p = defaultProject(); p.composition.motifs = [];
  validateProject(p);
  assert.deepEqual(compositionLayout(p).placements, []);
});
test('variants contain references to shared composition, not stale snapshots', () => {
  const p = defaultProject();
  const variant = variantFromDraft(p, 'new', 'Deneme');
  assert.deepEqual(Object.keys(variant), ['id', 'label', 'background', 'trim', 'product', 'pack']);
  const before = garmentSVG(p, variant);
  p.composition.seed++;
  const after = garmentSVG(p, variant);
  assert.ok(before.includes('data-composition-seed="24026"'));
  assert.ok(after.includes('data-composition-seed="24027"'));
  assert.equal(variant.background, p.background);
});
test('batch generation covers every selected background with one trim, product and pack', () => {
  const p = defaultProject(); p.trim = '#ABCDEF'; p.product = 'boxer'; p.pack = 'set';
  const result = batchVariants(p, ['a', 'b', 'c']);
  assert.deepEqual(result.map(v => v.background), p.selectedBackgrounds);
  assert.ok(result.every(v => v.trim === '#ABCDEF' && v.product === 'boxer' && v.pack === 'set'));
  assert.throws(() => batchVariants(p, ['x']));
  assert.equal(p.variants.length, 3);
});
test('maximum variants enforced before batch append', () => {
  const p = defaultProject();
  p.variants = Array.from({ length: 59 }, (_, i) => variantFromDraft(p, `v-${i}`));
  assert.throws(() => batchVariants(p, ['a', 'b', 'c']), /60/);
  p.variants.push(variantFromDraft(p, 'last')); validateProject(p);
  p.variants.push(variantFromDraft(p, 'extra'));
  assert.throws(() => validateProject(p));
});
test('pagination has no empty page, fits A5 six/A6 three and covers all items once', () => {
  for (const size of [0, 1, 3, 6, 7, 12, 60]) {
    const variants = Array.from({ length: size }, (_, i) => ({ id: i }));
    for (const [paper, capacity] of [['A5', 6], ['A6', 3]]) {
      const pages = paginateVariants(variants, paper);
      assert.equal(pages.length, Math.ceil(size / capacity));
      assert.ok(pages.every(page => page.length > 0 && page.length <= capacity));
      assert.deepEqual(pages.flat(), variants);
    }
  }
  assert.throws(() => paginateVariants([], 'A4'));
});
test('physical page sizes are exact and orientation-aware', () => {
  assert.deepEqual(paperDimensions('A5', 'landscape'), { width: 210, height: 148 });
  assert.deepEqual(paperDimensions('A5', 'portrait'), { width: 148, height: 210 });
  assert.deepEqual(paperDimensions('A6', 'landscape'), { width: 148, height: 105 });
  assert.deepEqual(paperDimensions('A6', 'portrait'), { width: 105, height: 148 });
  assert.throws(() => paperDimensions('A3', 'landscape'));
});
test('print palette includes source, every actual background/trim and current palette codes', () => {
  const p = defaultProject();
  p.variants[0].background = '#012345';
  p.variants[1].trim = '#6789AB';
  p.palette[0].code = 'CUSTOM-26';
  const palette = printPalette(p);
  for (const c of [...p.palette.map(p => p.color), p.background, ...p.variants.flatMap(v => [v.background, v.trim])])
    assert.ok(palette.some(p => p.color.toUpperCase() === c.toUpperCase()));
  assert.ok(palette.some(p => p.code === 'CUSTOM-26'));
  assert.equal(new Set(palette.map(p => p.color.toUpperCase())).size, palette.length);
});
test('all global print SVG ids are unique and clip/fill references resolve within document', () => {
  const p = defaultProject();
  p.variants = Array.from({ length: 12 }, (_, i) => ({ ...variantFromDraft(p, `v-${i}`), pack: '5' }));
  const html = printSheetsHTML(p) + garmentSVG(p, p.variants[0]) + swatchSVG(p);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g))
    assert.ok(ids.includes(match[1] || match[2]), `missing ${match[1] || match[2]}`);
});
test('different user codes sharing an approximate HEX both remain in print palette', () => {
  const p = defaultProject();
  p.palette[1].color = p.palette[0].color;
  p.palette[1].code = 'OTHER-CODE';
  const palette = printPalette(p);
  assert.ok(palette.some(entry => entry.code === 'K-101'));
  assert.ok(palette.some(entry => entry.code === 'OTHER-CODE'));
});
test('boxer sets actually render and label tank plus boxer', () => {
  const p = defaultProject(), v = variantFromDraft(p, 'set');
  v.product = 'boxer'; v.pack = 'set';
  assert.equal(productLabel(v), 'Atlet + boxer takım');
  const svg = garmentSVG(p, v);
  assert.ok(svg.includes('-garment-tank'));
  assert.ok(svg.includes('-garment-boxer'));
  assert.ok(!svg.includes('-garment-brief-front'));
});
test('pack silhouettes are shared via use and fit a fixed viewBox', () => {
  const p = defaultProject();
  for (const pack of ['single', 'set', '3', '5']) {
    const v = { ...variantFromDraft(p, 'x'), pack };
    const svg = garmentSVG(p, v);
    assert.ok(svg.includes('viewBox="0 0 360 300"'));
    assert.equal([...svg.matchAll(/<use href="#kms-\d+-garment-/g)].length, { single: 1, set: 2, 3: 3, 5: 5 }[pack]);
  }
});
test('print uses scaled-source wording and includes numbering with no extra sheets', () => {
  const p = defaultProject();
  p.variants = Array.from({ length: 7 }, (_, i) => variantFromDraft(p, `v-${i}`));
  const html = printSheetsHTML(p);
  assert.equal([...html.matchAll(/data-testid="print-sheet"/g)].length, 2);
  assert.ok(html.includes('Ölçekli önizleme · gerçek boy değildir.'));
  assert.ok(html.includes('<b>07</b>'));
  p.variants = [];
  assert.equal(printSheetsHTML(p), '');
});
test('user strings are escaped everywhere in renderer', () => {
  const p = defaultProject();
  p.company = '<script>alert(1)</script>';
  p.name = '<img src=x onerror=alert(1)>';
  p.designCode = '"><svg onload=alert(1)>';
  p.variants[0].label = '<b>hello</b>';
  p.palette[0].code = '<iframe>';
  validateProject(p);
  const html = printSheetsHTML(p);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<iframe>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(escapeHTML(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});
test('PNG embedded asset round-trips exactly, including compositions and variants', () => {
  const p = withAsset();
  const json = serializeProject(p);
  assert.deepEqual(parseProject(json), p);
  assert.equal(parseProject(json).assets[0].dataUrl, PNG);
  assert.ok(garmentSVG(p, p.variants[0]).includes(PNG));
});
test('PNG and JPEG are the only permitted own image schemes', () => {
  for (const bad of [
    'https://example.com/file.png', 'file:///tmp/x.png', 'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,AAAA',
    'data:image/png;charset=utf-8;base64,AAAA', 'data:image/png;base64,AA A',
    'data:image/png;base64,AAAA" onload="alert(1)',
  ]) assert.throws(() => inspectImageData(bad, 'image/png'));
  assert.throws(() => inspectImageData(PNG, 'image/jpeg'));
  assert.throws(() => inspectImageData(PNG, 'image/gif'));
  assert.throws(() => inspectImageData('data:image/png;base64,', 'image/png'));
  assert.throws(() => inspectImageData('data:image/png;base64,AAAA', 'image/png'));
  assert.ok(inspectImageData(PNG, 'image/png') > 0);
  assert.equal(inspectImageData('data:image/jpeg;base64,/9j/2Q==', 'image/jpeg'), 4);
});
test('image byte boundaries accept 10MB and reject >10MB', () => {
  assert.equal(inspectImageData(fakePNG(LIMITS.assetBytes), 'image/png'), LIMITS.assetBytes);
  assert.throws(() => inspectImageData(fakePNG(LIMITS.assetBytes + 1), 'image/png'), /10 MB/);
});
test('project assets use 12MB combined budget so exported JSON can be reimported', () => {
  const p = defaultProject();
  p.assets = [
    { ...pngAsset(), id: 'one', dataUrl: fakePNG(6 * 1024 * 1024) },
    { ...pngAsset(), id: 'two', dataUrl: fakePNG(6 * 1024 * 1024) },
  ];
  const json = serializeProject(p);
  assert.ok(byteLength(json) < LIMITS.projectBytes);
  assert.equal(parseProject(json).assets.length, 2);
  p.assets[1].dataUrl = fakePNG(6 * 1024 * 1024 + 1);
  assert.throws(() => validateProject(p), /12 MB/);
});
test('file header dimensions validate before browser decode allocations', () => {
  const bytes = Uint8Array.from(Buffer.from(PNG.split(',')[1], 'base64'));
  assert.deepEqual(imageHeaderDimensions(bytes, 'image/png'), { width: 1, height: 1 });
  const large = Uint8Array.from(bytes);
  new DataView(large.buffer).setUint32(16, 5000);
  new DataView(large.buffer).setUint32(20, 5000);
  assert.throws(() => imageHeaderDimensions(large, 'image/png'), /16 megapiksel/);
  assert.throws(() => imageHeaderDimensions(new Uint8Array(3), 'image/png'));
  const jpeg = new Uint8Array([255,216,255,192,0,11,8,0,30,0,20,1,1,17,0,255,217]);
  assert.deepEqual(imageHeaderDimensions(jpeg, 'image/jpeg'), { width: 20, height: 30 });
  assert.throws(() => imageHeaderDimensions(new Uint8Array([255,216,255,192,0,30]), 'image/jpeg'));
  assert.throws(() => imageHeaderDimensions(new Uint8Array([255,216,255,217]), 'image/jpeg'));
});
test('pixel and edge dimension limits include finite integer enforcement', () => {
  assert.deepEqual(validateDimensions(4000, 4000), { width: 4000, height: 4000 });
  for (const [w, h] of [[4001,4000], [16385,1], [0,10], [NaN,2], [Infinity,1], [1.5,1], ['1',1]])
    assert.throws(() => validateDimensions(w, h));
});
test('malformed JSON and >20MB input fail before project replacement', () => {
  const p = defaultProject();
  const before = clone(p);
  assert.throws(() => parseProject('{"version":'));
  assert.throws(() => parseProject(' '.repeat(LIMITS.projectBytes + 1)), /20 MB/);
  assert.deepEqual(p, before);
});
test('version, missing/unknown keys and non-plain structures are rejected', () => {
  for (const change of [
    p => { p.version = 2; },
    p => { delete p.company; },
    p => { p.unsafe = true; },
    p => { p.palette = null; },
    p => { p.composition = []; },
    p => { p.presentation = { paper: 'A5' }; },
    p => { p.variants[0].composition = clone(p.composition); },
  ]) {
    const p = defaultProject(); change(p); assert.throws(() => validateProject(p));
  }
  assert.throws(() => validateProject(Object.create(defaultProject())));
  assert.throws(() => parseProject('{"__proto__":{"polluted":true}}'));
  assert.equal({}.polluted, undefined);
});
test('all composition numbers reject NaN, infinity, strings and out-of-bounds values', () => {
  const bad = {
    seed: [-1, 4294967296, 1.5, '3', NaN, Infinity],
    scale: [0, 2.1, '.5', NaN, -Infinity],
    rotation: [-181, 181, '10', Infinity],
    density: [3, 41, 5.5, '7', NaN],
    repeatWidthCm: [4, 51, '20', NaN],
    repeatHeightCm: [4, 51, '20', Infinity],
  };
  for (const [field, values] of Object.entries(bad)) for (const value of values) {
    const p = defaultProject(); p.composition[field] = value;
    assert.throws(() => validateProject(p), undefined, `${field}:${value}`);
  }
});
test('allowed enums are enforced, including product/pack on every variant', () => {
  const mutations = [
    p => { p.product = 'external'; }, p => { p.pack = '7'; },
    p => { p.composition.mode = 'ai'; }, p => { p.composition.motifs = ['unknown']; },
    p => { p.presentation.paper = 'A4'; }, p => { p.presentation.orientation = 'diagonal'; },
    p => { p.variants[0].product = 'other'; }, p => { p.variants[0].pack = 'undefined'; },
    p => { p.composition.mode = 'raster'; p.composition.rasterAssetId = null; },
    p => { p.composition.rasterAssetId = 'missing'; },
  ];
  for (const mutate of mutations) { const p = defaultProject(); mutate(p); assert.throws(() => validateProject(p)); }
});
test('CSS and SVG injection through colors rejected in every color-bearing field', () => {
  for (const bad of ['red', '#123', '#abcdzz', '#12345678', 'url(https://evil)', '#000000" onload="x']) {
    for (const change of [
      p => { p.background = bad; }, p => { p.trim = bad; },
      p => { p.palette[0].color = bad; }, p => { p.variants[0].background = bad; },
      p => { p.variants[0].trim = bad; }, p => { p.selectedBackgrounds[0] = bad; },
    ]) { const p = defaultProject(); change(p); assert.throws(() => validateProject(p)); }
  }
});
test('all array and text limits and uniqueness constraints are enforced', () => {
  const mutations = [
    p => { p.name = ''; }, p => { p.name = 'x'.repeat(81); },
    p => { p.designCode = 'x'.repeat(41); }, p => { p.company = 'x'.repeat(81); },
    p => { p.palette[0].name = 'x'.repeat(33); }, p => { p.palette[0].code = 'x'.repeat(33); },
    p => { p.variants[0].label = 'x'.repeat(49); }, p => { p.name = '\0unsafe'; },
    p => { p.palette = []; }, p => { p.palette = Array(9).fill(p.palette[0]); },
    p => { p.palette[1].id = p.palette[0].id; }, p => { p.variants[1].id = p.variants[0].id; },
    p => { p.variants[0].id = '../bad'; }, p => { p.composition.motifs = ['bunny', 'bunny']; },
    p => { p.selectedBackgrounds = ['#aabbcc', '#AABBCC']; },
    p => { p.selectedBackgrounds = Array(13).fill('#FFFFFF'); },
    p => { p.assets = Array(9).fill(pngAsset()); },
  ];
  for (const mutate of mutations) { const p = defaultProject(); mutate(p); assert.throws(() => validateProject(p)); }
});
test('asset metadata invalidity, unknown asset references and JPEG motif misuse fail', () => {
  for (const mutate of [
    p => { p.assets[0].width = 0; },
    p => { p.assets[0].name = ''; },
    p => { p.assets[0].height = 1.5; },
    p => { p.assets[0].mime = 'image/svg+xml'; },
    p => { p.assets[0].dataUrl = 'https://external.invalid/img.png'; },
    p => { p.composition.motifs = ['asset:missing']; },
    p => { p.assets.push(clone(p.assets[0])); },
  ]) { const p = withAsset(); mutate(p); assert.throws(() => validateProject(p)); }
  const p = withAsset();
  p.assets[0].mime = 'image/jpeg'; p.assets[0].dataUrl = 'data:image/jpeg;base64,/9j/2Q==';
  assert.throws(() => validateProject(p));
});
test('raster mode retains the entire original embedded image and shared rotation/scale', () => {
  const p = withAsset(); p.composition.mode = 'raster'; p.composition.rotation = 30; p.composition.scale = 1.5;
  validateProject(p);
  assert.deepEqual(compositionLayout(p).placements, []);
  const svg = swatchSVG(p);
  assert.ok(svg.includes(PNG));
  assert.ok(svg.includes('patternTransform="rotate(30) scale(1.5)"'));
  assert.ok(svg.includes('preserveAspectRatio="none"'));
});
test('runtime object URLs avoid repeated payloads but exports always embed original images', () => {
  const p = withAsset();
  try {
    setAssetRenderSources(new Map([['img-test', 'blob:http://127.0.0.1:8795/local-asset']]));
    const svg = swatchSVG(p);
    assert.ok(svg.includes('blob:http://127.0.0.1:8795/local-asset'));
    assert.ok(!svg.includes(PNG));
    assert.equal(parseProject(serializeProject(p)).assets[0].dataUrl, PNG);
    assert.throws(() => setAssetRenderSources(new Map([['img-test', 'https://external.invalid/img']])));
  } finally {
    setAssetRenderSources(new Map());
  }
});
