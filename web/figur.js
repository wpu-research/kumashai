/**
 * Figür seçme: yüklenen görselde bir figürün etrafına kutu çizilir; kutunun
 * kenarındaki zemin rengi içeri doğru silinir ve figür şeffaf PNG motif olur.
 * Düz zeminli desen görsellerinde iyi çalışır; fotoğrafta (kırışık, gölge) kabadır.
 * cutFigure saftır (DOM yok) ve Node'da test edilir.
 */
const MAX_FIGURE = 1024; // çıktının en uzun kenarı (px)

const median = values => { values.sort((a, b) => a - b); return values[values.length >> 1]; };

/**
 * Kenara bağlı ve kenar rengine yakın pikselleri şeffaf yapar.
 * Dönen: { data, bounds: { x, y, width, height } } ya da figür kalmadıysa null.
 */
export function cutFigure(src, width, height, tolerance) {
  const border = [[], [], []];
  const visit = (x, y) => {
    const i = (y * width + x) * 4;
    if (src[i + 3] >= 128) for (let ch = 0; ch < 3; ch++) border[ch].push(src[i + ch]);
  };
  for (let x = 0; x < width; x++) { visit(x, 0); visit(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { visit(0, y); visit(width - 1, y); }
  const ref = border[0].length ? border.map(median) : [0, 0, 0];
  const dist = i => Math.hypot(src[i] - ref[0], src[i + 1] - ref[1], src[i + 2] - ref[2]);
  const isGround = p => src[p * 4 + 3] < 128 || dist(p * 4) < tolerance;

  const removed = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let top = 0;
  const push = p => { if (!removed[p] && isGround(p)) { removed[p] = 1; stack[top++] = p; } };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (top) {
    const p = stack[--top], x = p % width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p < width * (height - 1)) push(p + width);
  }

  const data = new Uint8ClampedArray(src);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (removed[p]) { data[i + 3] = 0; continue; }
    const x = p % width;
    const edge = (x > 0 && removed[p - 1]) || (x < width - 1 && removed[p + 1]) ||
      (p >= width && removed[p - width]) || (p < width * (height - 1) && removed[p + width]);
    if (edge) { // kenar pikselini zemine yakınlığı kadar saydamlaştır (tırtık azalır)
      const d = dist(i);
      if (d < tolerance * 1.6) data[i + 3] = src[i + 3] * Math.max(0, (d - tolerance) / (0.6 * tolerance));
    }
    if (data[i + 3] > 8) {
      const y = (p - x) / width;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { data, bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}

export function initFigure({ getBackground, onApply }) {
  const $ = id => document.getElementById(id);
  const dialog = $('figure-dialog');
  const canvas = $('fg-canvas'), ctx = canvas.getContext('2d');
  const result = $('fg-result');
  let source = null, selection = null, cut = null, drag = null, busy = false;

  const note = (message, error = false) => {
    $('fg-status').textContent = message;
    $('fg-status').classList.toggle('error', error);
  };
  function drawStage() {
    const { image } = source;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (!selection) return;
    const k = canvas.width / image.naturalWidth;
    const [x, y, w, h] = [selection.x * k, selection.y * k, selection.width * k, selection.height * k];
    ctx.fillStyle = 'rgba(20,30,25,.5)';
    ctx.beginPath(); ctx.rect(0, 0, canvas.width, canvas.height); ctx.rect(x, y, w, h); ctx.fill('evenodd');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  }
  function compute() {
    cut = null;
    $('fg-apply').disabled = true;
    if (!selection || selection.width < 8 || selection.height < 8) { result.hidden = true; return; }
    const k = Math.min(1, MAX_FIGURE / Math.max(selection.width, selection.height));
    const w = Math.max(1, Math.round(selection.width * k)), h = Math.max(1, Math.round(selection.height * k));
    const work = document.createElement('canvas'); work.width = w; work.height = h;
    const wctx = work.getContext('2d', { willReadFrequently: true });
    wctx.drawImage(source.image, selection.x, selection.y, selection.width, selection.height, 0, 0, w, h);
    const found = cutFigure(wctx.getImageData(0, 0, w, h).data, w, h, Number($('fg-tolerance').value));
    if (!found) { result.hidden = true; note('Seçimde figür kalmadı; hassasiyeti azaltın ya da kutuyu büyütün.', true); return; }
    wctx.putImageData(new ImageData(found.data, w, h), 0, 0);
    const b = found.bounds;
    result.width = b.width; result.height = b.height;
    result.getContext('2d').drawImage(work, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height);
    result.hidden = false;
    $('fg-result-wrap').style.background = getBackground();
    cut = { width: b.width, height: b.height };
    $('fg-apply').disabled = false;
    const small = Math.max(b.width, b.height) < 300;
    note(`Figür ${b.width} × ${b.height} px.${small ? ' Bu boyut baskı için küçük; daha büyük ve net bir kaynak görsel kullanın.' : ''} Zemin kalıyorsa “Zemin silme”yi artırın; figür eriyorsa azaltın.`, small);
  }
  const toImage = event => {
    const r = canvas.getBoundingClientRect(), k = source.image.naturalWidth / r.width;
    return {
      x: Math.max(0, Math.min(source.image.naturalWidth, (event.clientX - r.left) * k)),
      y: Math.max(0, Math.min(source.image.naturalHeight, (event.clientY - r.top) * k)),
    };
  };
  canvas.addEventListener('pointerdown', event => {
    event.preventDefault(); canvas.setPointerCapture(event.pointerId);
    drag = toImage(event); selection = null; drawStage();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    const p = toImage(event);
    selection = {
      x: Math.round(Math.min(drag.x, p.x)), y: Math.round(Math.min(drag.y, p.y)),
      width: Math.round(Math.abs(p.x - drag.x)), height: Math.round(Math.abs(p.y - drag.y)),
    };
    drawStage();
  });
  const finish = () => { if (drag) { drag = null; compute(); } };
  canvas.addEventListener('pointerup', finish); canvas.addEventListener('pointercancel', finish);
  $('fg-tolerance').addEventListener('input', event => { $('fg-tolerance-val').textContent = event.target.value; compute(); });
  $('fg-close').addEventListener('click', () => dialog.close());
  $('fg-apply').addEventListener('click', async () => {
    if (busy || !cut) return;
    busy = true; $('fg-apply').disabled = true;
    try {
      await onApply(source.asset.id, { dataUrl: result.toDataURL('image/png'), width: cut.width, height: cut.height });
      dialog.close();
    } catch (error) { note(`Figür eklenemedi: ${error.message}`, true); $('fg-apply').disabled = false; }
    finally { busy = false; }
  });

  return {
    open(asset, image) {
      source = { asset, image }; selection = null; cut = null;
      const k = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.round(image.naturalWidth * k); canvas.height = Math.round(image.naturalHeight * k);
      result.hidden = true; $('fg-apply').disabled = true;
      $('fg-name').textContent = asset.name;
      note('Almak istediğiniz figürün etrafına, çevresinde biraz zemin kalacak şekilde bir kutu çizin.');
      dialog.showModal();
      drawStage();
    },
  };
}
