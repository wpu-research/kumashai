/**
 * Renk ayırma: yüklenen (ör. lisanslı stok) desenin baskın renklerini bulur,
 * her birini yeni renkle değiştirir veya şeffaf yapar (zemin projeden gelir).
 * Düz renkli/vektör tarzı baskılar için tasarlanmıştır; fotoğrafta sonuç kabadır.
 * Saf fonksiyonlar DOM kullanmaz ve Node'da test edilebilir.
 */
const MAX_WORK = 1600;   // projeye yazılan en uzun kenar (px)
const MAX_PREVIEW = 560; // canlı önizleme en uzun kenar (px)
const MERGE_DISTANCE = 44;

export const toHex = rgb => `#${rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
export const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** RGBA piksellerden en fazla maxColors baskın renk: [{ rgb, share }] (paya göre sıralı). */
export function extractColors(data, maxColors = 8) {
  const total = data.length / 4;
  const step = Math.max(1, Math.floor(total / 40000));
  const bins = new Map();
  let counted = 0;
  for (let p = 0; p < total; p += step) {
    const i = p * 4;
    if (data[i + 3] < 128) continue;
    const key = (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | (data[i + 2] >> 4);
    let bin = bins.get(key);
    if (!bin) { bin = [0, 0, 0, 0]; bins.set(key, bin); }
    bin[0] += data[i]; bin[1] += data[i + 1]; bin[2] += data[i + 2]; bin[3]++;
    counted++;
  }
  if (!counted) return [];
  const centers = [];
  for (const bin of [...bins.values()].sort((a, b) => b[3] - a[3])) {
    const rgb = [bin[0] / bin[3], bin[1] / bin[3], bin[2] / bin[3]];
    let nearest = null, best = Infinity;
    for (const center of centers) {
      const d = distance(center.rgb, rgb);
      if (d < best) { best = d; nearest = center; }
    }
    if (nearest && (best < MERGE_DISTANCE || centers.length >= maxColors)) nearest.count += bin[3];
    else centers.push({ rgb, count: bin[3] });
  }
  const significant = centers.filter((c, i) => i === 0 || c.count / counted >= 0.004);
  return significant.sort((a, b) => b.count - a.count).map(c => ({ rgb: c.rgb, share: c.count / counted }));
}

/**
 * Her pikseli en yakın iki renk merkezine göre yeniden boyar.
 * targets[i] = { rgb, transparent }. Kenar yumuşatması ve doku (merkezden sapma) korunur.
 */
export function recolor(src, centers, targets) {
  const out = new Uint8ClampedArray(src.length);
  const count = centers.length;
  for (let i = 0; i < src.length; i += 4) {
    const alpha = src[i + 3];
    if (!alpha || !count) continue;
    const r = src[i], g = src[i + 1], b = src[i + 2];
    let n1 = 0, n2 = -1, d1 = Infinity, d2 = Infinity;
    for (let k = 0; k < count; k++) {
      const c = centers[k];
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
      if (d < d1) { d2 = d1; n2 = n1; d1 = d; n1 = k; } else if (d < d2) { d2 = d; n2 = k; }
    }
    let t = 0;
    if (n2 >= 0) {
      d1 = Math.sqrt(d1); d2 = Math.sqrt(d2);
      t = d1 + d2 > 0 ? d1 / (d1 + d2) : 0;
      // Düz alanlardaki gürültü komşu renge sızmasın; yalnız gerçek kenarlar karışsın.
      t = t < 0.12 ? 0 : (t - 0.12) / 0.38 * 0.5;
    }
    const a = targets[n1], cA = centers[n1], wA = 1 - t;
    const bT = t ? targets[n2] : a, cB = t ? centers[n2] : cA, wB = t;
    const opaque = (a.transparent ? 0 : wA) + (bT.transparent ? 0 : wB);
    if (!opaque) continue;
    for (let ch = 0; ch < 3; ch++) {
      const target = ((a.transparent ? 0 : wA * a.rgb[ch]) + (bT.transparent ? 0 : wB * bT.rgb[ch])) / opaque;
      const residual = src[i + ch] - (wA * cA[ch] + wB * cB[ch]);
      out[i + ch] = target + residual;
    }
    out[i + 3] = alpha * opaque;
  }
  return out;
}

/** Dört köşe aynı renge düşüyorsa o renk büyük olasılıkla zemindir. */
export function guessBackground(data, width, height, centers) {
  if (!centers.length || !width || !height) return -1;
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(([x, y]) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128) return -1;
    let best = 0, bestD = Infinity;
    centers.forEach((c, k) => { const d = distance(c, [data[i], data[i + 1], data[i + 2]]); if (d < bestD) { bestD = d; best = k; } });
    return best;
  });
  return corners.every(c => c === corners[0]) ? corners[0] : -1;
}

export function initRecolor({ getBackground, onApply }) {
  const $ = id => document.getElementById(id);
  const dialog = $('recolor-dialog');
  const canvas = $('rc-canvas'), ctx = canvas.getContext('2d');
  let source = null;      // { asset, image }
  let preview = null;     // ImageData, küçük
  let centers = [];       // [[r,g,b]]
  let rows = [];          // [{ original, color, transparent, share }]
  let raf = 0, busy = false;

  const note = (message, error = false) => {
    $('rc-status').textContent = message;
    $('rc-status').classList.toggle('error', error);
  };
  function pixels(image, limit) {
    const k = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
    const w = Math.max(1, Math.round(image.naturalWidth * k)), h = Math.max(1, Math.round(image.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(image, 0, 0, w, h);
    return x.getImageData(0, 0, w, h);
  }
  const targets = () => rows.map(r => ({ rgb: toRgb(r.color), transparent: r.transparent }));
  function render() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!preview) return;
      canvas.width = preview.width; canvas.height = preview.height;
      ctx.putImageData(new ImageData(recolor(preview.data, centers, targets()), preview.width, preview.height), 0, 0);
      $('rc-stage').style.background = getBackground();
    });
  }
  function analyse() {
    const found = extractColors(preview.data, Number($('rc-count').value));
    centers = found.map(c => c.rgb);
    const bg = guessBackground(preview.data, preview.width, preview.height, centers);
    rows = found.map((c, i) => ({ original: toHex(c.rgb), color: toHex(c.rgb), transparent: i === bg, share: c.share }));
    buildRows(); render();
    note(rows.length
      ? `${rows.length} renk bulundu.${bg >= 0 ? ' Köşelerdeki renk zemin sayıldı ve şeffaf yapıldı; istemezseniz işareti kaldırın.' : ''}`
      : 'Görselde ayrılabilecek renk bulunamadı.', !rows.length);
  }
  function buildRows() {
    const box = $('rc-rows'); box.replaceChildren();
    rows.forEach((row, i) => {
      const line = document.createElement('div'); line.className = 'rc-row';
      const from = document.createElement('i'); from.className = 'rc-from'; from.style.background = row.original; from.title = `Özgün ${row.original}`;
      const arrow = document.createElement('span'); arrow.textContent = '→';
      const input = document.createElement('input'); input.type = 'color'; input.value = row.color.toLowerCase();
      input.dataset.rc = i; input.disabled = row.transparent; input.setAttribute('aria-label', `${row.original} yerine yeni renk`);
      const share = document.createElement('small'); share.textContent = `%${Math.max(1, Math.round(row.share * 100))}`;
      const label = document.createElement('label'); label.className = 'rc-clear';
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = row.transparent; check.dataset.rcClear = i;
      label.append(check, ' Zemin yap');
      line.append(from, arrow, input, share, label); box.append(line);
    });
  }

  $('rc-rows').addEventListener('input', event => {
    const color = event.target.dataset.rc, clear = event.target.dataset.rcClear;
    if (color !== undefined) rows[color].color = event.target.value.toUpperCase();
    else if (clear !== undefined) {
      rows[clear].transparent = event.target.checked;
      event.target.closest('.rc-row').querySelector('input[type="color"]').disabled = event.target.checked;
    } else return;
    render();
  });
  $('rc-count').addEventListener('change', () => { if (preview) analyse(); });
  $('rc-reset').addEventListener('click', () => { if (preview) analyse(); });
  $('rc-close').addEventListener('click', () => dialog.close());
  $('rc-apply').addEventListener('click', async () => {
    if (busy || !source || !rows.length) return;
    if (rows.every(r => r.transparent)) { note('Bütün renkler zemin yapılamaz; en az birini bırakın.', true); return; }
    busy = true; $('rc-apply').disabled = true;
    try {
      const full = pixels(source.image, MAX_WORK);
      const out = document.createElement('canvas'); out.width = full.width; out.height = full.height;
      out.getContext('2d').putImageData(new ImageData(recolor(full.data, centers, targets()), full.width, full.height), 0, 0);
      await onApply(source.asset.id, { dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height });
      dialog.close();
    } catch (error) { note(`Renkli kopya eklenemedi: ${error.message}`, true); }
    finally { busy = false; $('rc-apply').disabled = false; }
  });

  return {
    open(asset, image) {
      source = { asset, image };
      preview = pixels(image, MAX_PREVIEW);
      $('rc-name').textContent = asset.name;
      dialog.showModal();
      analyse();
    },
  };
}
