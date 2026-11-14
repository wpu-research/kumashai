/**
 * Deseni al: bir ürün/kumaş görselinde kumaşın zemin rengini bulur, zeminle
 * tamamen çevrili adacıkları (figürleri) ayırır ve şeffaf motifler olarak verir.
 * Görselin kenarına ya da kumaş dışına (masa, arka plan) değen parçalar alınmaz.
 * findFigures ve guessGround saftır (DOM yok) ve Node'da test edilir.
 */
import { extractColors, toHex, toRgb } from './recolor.js';

const MAX_ANALYSIS = 1400; // çözümleme ve çıktı için en uzun kenar (px)
const MAX_FIGURES = 12;

/** Gölgeye dayanıklı renk farkı: renk tonu ağır, parlaklık hafif sayılır. */
function groundDistance(r, g, b, ground) {
  const s = r + g + b || 1, gs = ground[0] + ground[1] + ground[2] || 1;
  const chroma = Math.hypot(r / s - ground[0] / gs, g / s - ground[1] / gs, b / s - ground[2] / gs);
  return 255 * chroma + 0.45 * Math.abs(s - gs) / 3;
}

/**
 * Dönen: { figures: [{ id, x, y, width, height, area }], labels } (alan sırasına göre).
 * labels[p] === id olan pikseller o figüre aittir.
 */
export function findFigures(src, width, height, ground, tolerance) {
  const total = width * height;
  const labels = new Int32Array(total); // -1 zemin, 0 bakılmadı, >0 parça numarası
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (src[i + 3] >= 128 && groundDistance(src[i], src[i + 1], src[i + 2], ground) < tolerance) labels[p] = -1;
  }
  const stack = new Int32Array(total);
  const parts = [];
  for (let start = 0; start < total; start++) {
    if (labels[start]) continue;
    const id = parts.length + 1;
    const part = { id, area: 0, x0: width, y0: height, x1: 0, y1: 0, border: false };
    let top = 0;
    labels[start] = id; stack[top++] = start;
    while (top) {
      const p = stack[--top], x = p % width, y = (p - x) / width;
      part.area++;
      if (x < part.x0) part.x0 = x; if (x > part.x1) part.x1 = x;
      if (y < part.y0) part.y0 = y; if (y > part.y1) part.y1 = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) part.border = true;
      if (x > 0 && !labels[p - 1]) { labels[p - 1] = id; stack[top++] = p - 1; }
      if (x < width - 1 && !labels[p + 1]) { labels[p + 1] = id; stack[top++] = p + 1; }
      if (y > 0 && !labels[p - width]) { labels[p - width] = id; stack[top++] = p - width; }
      if (y < height - 1 && !labels[p + width]) { labels[p + width] = id; stack[top++] = p + width; }
    }
    parts.push(part);
  }
  const enclosed = parts.filter(c => {
    const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
    return !c.border && c.area >= 24 && w * h < total * 0.2 && w / h > 0.3 && w / h < 3.4;
  });
  const largest = Math.max(0, ...enclosed.map(c => c.area));
  const figures = enclosed.filter(c => c.area >= largest * 0.25).sort((a, b) => b.area - a.area).slice(0, MAX_FIGURES)
    .map(c => ({ id: c.id, x: c.x0, y: c.y0, width: c.x1 - c.x0 + 1, height: c.y1 - c.y0 + 1, area: c.area }));
  return { figures, labels };
}

/** Baskın renklerden, içinde en çok figür barındıranı zemin sayar. */
export function guessGround(src, width, height, tolerance) {
  let best = null;
  for (const candidate of extractColors(src, 6).slice(0, 5)) {
    const { figures } = findFigures(src, width, height, candidate.rgb, tolerance);
    const score = figures.length * figures.reduce((sum, f) => sum + f.area, 0);
    if (!best || score > best.score) best = { rgb: candidate.rgb, score };
  }
  return best ? best.rgb : null;
}

export function initPattern({ onApply, maxFigures }) {
  const $ = id => document.getElementById(id);
  const dialog = $('pattern-dialog');
  const canvas = $('pt-canvas'), ctx = canvas.getContext('2d');
  let source = null, pixels = null, ground = null, found = null, chosen = new Set(), busy = false;

  const note = (message, error = false) => {
    $('pt-status').textContent = message;
    $('pt-status').classList.toggle('error', error);
  };
  function figureCanvas(figure) {
    const out = document.createElement('canvas'); out.width = figure.width; out.height = figure.height;
    const image = new ImageData(figure.width, figure.height);
    const { width } = pixels, { labels } = found;
    for (let y = 0; y < figure.height; y++) for (let x = 0; x < figure.width; x++) {
      const p = (figure.y + y) * width + figure.x + x;
      if (labels[p] !== figure.id) continue;
      const edge = labels[p - 1] !== figure.id || labels[p + 1] !== figure.id ||
        labels[p - width] !== figure.id || labels[p + width] !== figure.id;
      const o = (y * figure.width + x) * 4;
      image.data.set(pixels.data.subarray(p * 4, p * 4 + 3), o);
      image.data[o + 3] = edge ? 150 : 255; // kenarı yumuşat
    }
    out.getContext('2d').putImageData(image, 0, 0);
    return out;
  }
  function draw() {
    ctx.putImageData(pixels, 0, 0);
    ctx.lineWidth = Math.max(2, canvas.width / 220);
    for (const figure of found.figures) {
      ctx.strokeStyle = chosen.has(figure.id) ? '#ffffff' : 'rgba(255,255,255,.35)';
      ctx.setLineDash(chosen.has(figure.id) ? [] : [6, 5]);
      ctx.strokeRect(figure.x - 2, figure.y - 2, figure.width + 4, figure.height + 4);
    }
    ctx.setLineDash([]);
  }
  function analyse(pickDefaults = true) {
    found = findFigures(pixels.data, pixels.width, pixels.height, ground, Number($('pt-tolerance').value));
    const limit = maxFigures();
    if (pickDefaults) chosen = new Set(found.figures.slice(0, Math.min(4, limit)).map(f => f.id));
    $('pt-ground').style.background = toHex(ground);
    $('pt-ground-label').textContent = toHex(ground);
    const box = $('pt-figures'); box.replaceChildren();
    for (const figure of found.figures) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.figure = figure.id; button.style.background = toHex(ground);
      button.setAttribute('aria-pressed', String(chosen.has(figure.id)));
      button.setAttribute('aria-label', `Figür ${figure.width} × ${figure.height} px`);
      button.append(figureCanvas(figure)); box.append(button);
    }
    draw();
    $('pt-apply').disabled = chosen.size === 0;
    if (!found.figures.length) note('Bu zemin renginde figür bulunamadı. Görselde kumaşın zemin rengine tıklayın ya da “Zemin payı”nı değiştirin.', true);
    else {
      const longest = Math.max(...found.figures.map(f => Math.max(f.width, f.height)));
      note(`${found.figures.length} figür bulundu, ${chosen.size} tanesi seçili (en fazla ${limit}). Zemin yanlışsa görselde kumaşın zeminine tıklayın.` +
        (longest < 300 ? ` En büyük figür ${longest} px: baskı için küçük, daha büyük ve net bir görsel kullanın.` : ''), longest < 300);
    }
  }
  canvas.addEventListener('click', event => {
    const r = canvas.getBoundingClientRect();
    const x = Math.min(pixels.width - 1, Math.max(0, Math.floor((event.clientX - r.left) / r.width * pixels.width)));
    const y = Math.min(pixels.height - 1, Math.max(0, Math.floor((event.clientY - r.top) / r.height * pixels.height)));
    // Tek piksel yerine 5×5 ortalama: baskı noktası ve gürültüye takılmasın.
    let sum = [0, 0, 0], n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const px = x + dx, py = y + dy;
      if (px < 0 || py < 0 || px >= pixels.width || py >= pixels.height) continue;
      const i = (py * pixels.width + px) * 4;
      sum = [sum[0] + pixels.data[i], sum[1] + pixels.data[i + 1], sum[2] + pixels.data[i + 2]]; n++;
    }
    ground = sum.map(v => v / n);
    analyse();
  });
  $('pt-tolerance').addEventListener('input', event => { $('pt-tolerance-val').textContent = event.target.value; analyse(); });
  $('pt-figures').addEventListener('click', event => {
    const button = event.target.closest('[data-figure]');
    if (!button) return;
    const id = Number(button.dataset.figure);
    if (chosen.has(id)) chosen.delete(id);
    else if (chosen.size >= maxFigures()) { note(`En fazla ${maxFigures()} figür alınabilir; önce birinin seçimini kaldırın.`, true); return; }
    else chosen.add(id);
    analyse(false);
  });
  $('pt-keep').addEventListener('click', () => dialog.close());
  $('pt-close').addEventListener('click', () => dialog.close());
  $('pt-apply').addEventListener('click', async () => {
    if (busy || !chosen.size) return;
    busy = true; $('pt-apply').disabled = true;
    try {
      const figures = found.figures.filter(f => chosen.has(f.id)).map(f => {
        const c = figureCanvas(f);
        return { dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height };
      });
      await onApply(source.asset.id, figures, toHex(ground));
      dialog.close();
    } catch (error) { note(`Desen alınamadı: ${error.message}`, true); $('pt-apply').disabled = false; }
    finally { busy = false; }
  });

  return {
    open(asset, image) {
      source = { asset, image };
      const k = Math.min(1, MAX_ANALYSIS / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * k));
      const work = document.createElement('canvas'); work.width = canvas.width; work.height = canvas.height;
      const wctx = work.getContext('2d', { willReadFrequently: true });
      wctx.drawImage(image, 0, 0, work.width, work.height);
      pixels = wctx.getImageData(0, 0, work.width, work.height);
      ground = guessGround(pixels.data, pixels.width, pixels.height, Number($('pt-tolerance').value)) || toRgb('#FFFFFF');
      dialog.showModal();
      analyse();
    },
  };
}
