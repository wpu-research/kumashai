/**
 * Çizim atölyesi: kesintisiz (seamless) raport çizim tuvali.
 * Kenardan taşan çizim karşı kenardan devam eder. Sonuç şeffaf PNG olarak
 * projeye "bütün desen" görseli şeklinde aktarılır; zemin rengi projeden gelir.
 * Ağ çağrısı yoktur; taslak yalnız bu tarayıcının localStorage alanında durur.
 */
const PALETTES = [
  { name: 'Ege', c: ['#12355B', '#2E86C1', '#85C1E9', '#F4D03F', '#FFFFFF'] },
  { name: 'Bahar', c: ['#E85D75', '#F7A1B5', '#FCE38A', '#95E1D3', '#3D5A80'] },
  { name: 'Toprak', c: ['#6B4226', '#A0522D', '#D2A46E', '#E9D8B4', '#4F6F52'] },
  { name: 'Gece', c: ['#0F1A2B', '#2C3E66', '#C9A227', '#E7E3D4', '#8E3B46'] },
  { name: 'Pastel', c: ['#FFB3C6', '#FFE29A', '#A8E6CF', '#A0C4FF', '#CDB4DB'] },
  { name: 'Retro', c: ['#F25F5C', '#FFE066', '#247BA0', '#70C1B3', '#50514F'] },
];
const SHAPES = [
  ['circle', 'Daire'], ['ring', 'Halka'], ['square', 'Kare'], ['diamond', 'Baklava'], ['triangle', 'Üçgen'],
  ['star', 'Yıldız'], ['heart', 'Kalp'], ['leaf', 'Yaprak'], ['flower', 'Çiçek'], ['drop', 'Damla'],
];
const MODE_HINTS = {
  straight: 'Raport olduğu gibi yan yana dizilir.',
  halfdrop: 'Her sütun yarım raport aşağı kayar; tekrar daha az belli olur.',
  brick: 'Her sıra yarım raport yana kayar, tuğla duvar gibi.',
  mirror: 'Raport sağa ve aşağıya aynalanarak dizilir.',
};
const KEY = 'kumashai-atolye-taslak';
const SIZES = [256, 512, 1024];
const MAX_STAMP_BYTES = 10 * 1024 * 1024;
const mod = (a, n) => ((a % n) + n) % n;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function shapePath(ctx, type, s) {
  const r = s / 2;
  ctx.beginPath();
  switch (type) {
    case 'circle': ctx.arc(0, 0, r, 0, Math.PI * 2); break;
    case 'ring': ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2, true); break;
    case 'square': ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7); break;
    case 'diamond': ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, 0); ctx.closePath(); break;
    case 'triangle': ctx.moveTo(0, -r); ctx.lineTo(r * 0.9, r * 0.65); ctx.lineTo(-r * 0.9, r * 0.65); ctx.closePath(); break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); break;
    case 'heart':
      ctx.moveTo(0, r * 0.85);
      ctx.bezierCurveTo(-r * 1.25, 0, -r * 0.6, -r * 1.05, 0, -r * 0.4);
      ctx.bezierCurveTo(r * 0.6, -r * 1.05, r * 1.25, 0, 0, r * 0.85); ctx.closePath(); break;
    case 'leaf':
      ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.95, 0, 0, r); ctx.quadraticCurveTo(-r * 0.95, 0, 0, -r); ctx.closePath(); break;
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        ctx.moveTo(Math.cos(a) * r * 0.5 + r * 0.38 * Math.cos(a), Math.sin(a) * r * 0.5 + r * 0.38 * Math.sin(a));
        ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.42, r * 0.3, a, 0, Math.PI * 2);
      }
      ctx.moveTo(r * 0.22, 0); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2, true); break;
    case 'drop':
      ctx.moveTo(0, -r); ctx.bezierCurveTo(r * 0.2, -r * 0.5, r * 0.75, 0, r * 0.75, r * 0.3);
      ctx.arc(0, r * 0.3, r * 0.75, 0, Math.PI, false); ctx.bezierCurveTo(-r * 0.75, 0, -r * 0.2, -r * 0.5, 0, -r); ctx.closePath(); break;
  }
}

/** Raport birimi ve cm ölçüsü: tekrar modu birimi iki katına çıkarabilir. */
export function unitGeometry(mode, n, cm) {
  const wide = mode === 'halfdrop' || mode === 'mirror' ? 2 : 1;
  const tall = mode === 'brick' || mode === 'mirror' ? 2 : 1;
  return { width: n * wide, height: n * tall, repeatWidthCm: cm * wide, repeatHeightCm: cm * tall };
}

export function initAtolye({ getColors, onApply }) {
  const $ = id => document.getElementById(id);
  const dialog = $('atolye-dialog');
  const editor = $('at-editor'), ectx = editor.getContext('2d');
  const preview = $('at-preview'), pctx = preview.getContext('2d');
  const S = {
    N: 512, tool: 'stamp', shape: 'circle', size: 60, color: '#2E86C1', sym: 'none', mode: 'straight',
    scale: 1, randRot: true, randSize: false, pal: 0, img: null, cm: 20,
  };
  let draw = mk(S.N, S.N);
  let dctx = draw.getContext('2d');
  const comp = mk(S.N, S.N);
  const unit = mk(S.N, S.N);
  let hasContent = false;
  let undoStack = [], redoStack = [];
  let raf = 0, saveTimer = 0, busy = false;

  const note = (message, error = false) => {
    $('at-status').textContent = message;
    $('at-status').classList.toggle('error', error);
  };
  const background = () => getColors().background;
  /** 0 = canlı proje paleti, 1..6 = hazır paletler. */
  const paletteList = () => [{ name: 'Proje paleti', c: getColors().palette }, ...PALETTES];
  const activeColors = () => paletteList()[S.pal].c;

  function drawShape(ctx, type, x, y, s, rot, color, flipX = 1, flipY = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flipX, flipY); ctx.rotate(rot);
    if (type === 'image' && S.img) {
      const im = S.img, k = s / Math.max(im.width, im.height);
      ctx.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k);
    } else {
      ctx.fillStyle = color; shapePath(ctx, type, s); ctx.fill('evenodd');
    }
    ctx.restore();
  }
  function symPoints(x, y) {
    const N = S.N, c = N / 2;
    const p = [{ x, y, fx: 1, fy: 1, dr: 0 }];
    if (S.sym === 'h' || S.sym === 'quad') p.push({ x: N - x, y, fx: -1, fy: 1, dr: 0 });
    if (S.sym === 'v' || S.sym === 'quad') p.push({ x, y: N - y, fx: 1, fy: -1, dr: 0 });
    if (S.sym === 'quad') p.push({ x: N - x, y: N - y, fx: -1, fy: -1, dr: 0 });
    if (S.sym === 'rot') {
      const dx = x - c, dy = y - c;
      p.push({ x: c - dy, y: c + dx, fx: 1, fy: 1, dr: Math.PI / 2 }, { x: c - dx, y: c - dy, fx: 1, fy: 1, dr: Math.PI },
        { x: c + dy, y: c - dx, fx: 1, fy: 1, dr: Math.PI * 1.5 });
    }
    return p;
  }
  /** Her çizimi 3×3 komşu raporta da uygular; kenarda dikiş izi kalmaz. */
  function wrapped(fn) {
    const N = S.N;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      dctx.save(); dctx.translate(ox, oy); fn(dctx); dctx.restore();
    }
  }
  function stampAt(x, y, opts = {}) {
    const color = opts.color || S.color, shape = opts.shape || S.shape;
    let size = opts.size || S.size;
    if (!opts.size && S.randSize) size *= 0.7 + Math.random() * 0.6;
    const rot = opts.rot ?? (S.randRot ? Math.random() * Math.PI * 2 : 0);
    for (const p of symPoints(x, y)) {
      const px = mod(p.x, S.N), py = mod(p.y, S.N);
      wrapped(c => drawShape(c, shape, px, py, size, rot + p.dr, color, p.fx, p.fy));
    }
    hasContent = true;
  }
  function segment(x0, y0, x1, y1) {
    const from = symPoints(x0, y0), to = symPoints(x1, y1);
    from.forEach((a, i) => {
      const b = to[i];
      const sx = mod(a.x, S.N) - a.x, sy = mod(a.y, S.N) - a.y;
      wrapped(c => {
        c.globalCompositeOperation = S.tool === 'erase' ? 'destination-out' : 'source-over';
        c.strokeStyle = S.color; c.lineWidth = S.size * (S.tool === 'erase' ? 1 : 0.5); c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(a.x + sx, a.y + sy); c.lineTo(b.x + sx, b.y + sy); c.stroke();
      });
    });
    if (S.tool !== 'erase') hasContent = true;
  }

  /** bg=null şeffaf birim üretir (projeye aktarım); renk verilirse zemin boyanır. */
  function composeUnit(bg, out = unit) {
    const N = S.N;
    comp.width = N; comp.height = N; // boyut ataması tuvali de temizler
    const c = comp.getContext('2d');
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, N, N); }
    c.drawImage(draw, 0, 0);
    const { width: w, height: h } = unitGeometry(S.mode, N, 1);
    out.width = w; out.height = h;
    const u = out.getContext('2d');
    if (S.mode === 'straight') u.drawImage(comp, 0, 0);
    else if (S.mode === 'halfdrop') { u.drawImage(comp, 0, 0); u.drawImage(comp, N, N / 2); u.drawImage(comp, N, -N / 2); }
    else if (S.mode === 'brick') { u.drawImage(comp, 0, 0); u.drawImage(comp, N / 2, N); u.drawImage(comp, -N / 2, N); }
    else {
      u.drawImage(comp, 0, 0);
      u.save(); u.translate(2 * N, 0); u.scale(-1, 1); u.drawImage(comp, 0, 0); u.restore();
      u.save(); u.translate(0, 2 * N); u.scale(1, -1); u.drawImage(comp, 0, 0); u.restore();
      u.save(); u.translate(2 * N, 2 * N); u.scale(-1, -1); u.drawImage(comp, 0, 0); u.restore();
    }
    return out;
  }
  function renderEditor() {
    const N = S.N, V = 2 * N;
    if (editor.width !== V) { editor.width = V; editor.height = V; }
    const pat = ectx.createPattern(unit, 'repeat');
    pat.setTransform(new DOMMatrix().translate(N / 2, N / 2));
    ectx.fillStyle = pat; ectx.fillRect(0, 0, V, V);
    ectx.fillStyle = 'rgba(247,247,241,.62)';
    ectx.beginPath(); ectx.rect(0, 0, V, V); ectx.rect(N / 2, N / 2, N, N); ectx.fill('evenodd');
    ectx.save(); ectx.setLineDash([N / 40, N / 50]); ectx.lineWidth = Math.max(1.5, N / 256);
    ectx.strokeStyle = '#244D3F'; ectx.strokeRect(N / 2, N / 2, N, N); ectx.restore();
  }
  const tilePxCss = () => 150 * S.scale;
  function renderPreview() {
    const dpr = window.devicePixelRatio || 1, r = preview.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (preview.width !== w || preview.height !== h) { preview.width = w; preview.height = h; }
    const pat = pctx.createPattern(unit, 'repeat');
    pat.setTransform(new DOMMatrix().scale(tilePxCss() * dpr / S.N));
    pctx.fillStyle = pat; pctx.fillRect(0, 0, w, h);
  }
  function render() {
    if (raf || !dialog.open) return;
    raf = requestAnimationFrame(() => { raf = 0; composeUnit(background()); renderEditor(); renderPreview(); });
  }

  /* ---------- geri al / yinele ---------- */
  const snap = () => dctx.getImageData(0, 0, S.N, S.N);
  function syncHistory() { $('at-undo').disabled = !undoStack.length; $('at-redo').disabled = !redoStack.length; }
  function pushUndo() {
    undoStack.push(snap());
    // 1024 px raportta her adım ~4 MB tutar; geçmişi kısa tut.
    if (undoStack.length > (S.N > 512 ? 10 : 30)) undoStack.shift();
    redoStack = []; syncHistory();
  }
  function restore(image) { dctx.putImageData(image, 0, 0); render(); autosave(); }
  function undo() { if (!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); syncHistory(); }
  function redo() { if (!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); syncHistory(); }

  /* ---------- taslak ---------- */
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ N: S.N, mode: S.mode, pal: S.pal, cm: S.cm, img: draw.toDataURL('image/png') }));
      } catch { note('Çizim taslağı tarayıcıya kaydedilemedi; “Desene uygula” ile projeye aktarın.', true); }
    }, 400);
  }
  function loadDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
    if (!d || typeof d.img !== 'string' || !d.img.startsWith('data:image/png;base64,')) return;
    S.N = SIZES.includes(d.N) ? d.N : 512;
    S.mode = MODE_HINTS[d.mode] ? d.mode : 'straight';
    S.pal = Number.isInteger(d.pal) && d.pal >= 0 && d.pal <= PALETTES.length ? d.pal : 0;
    S.cm = Number.isFinite(d.cm) && d.cm >= 5 && d.cm <= 25 ? d.cm : 20;
    S.size = Math.round(60 * S.N / 512);
    draw = mk(S.N, S.N); dctx = draw.getContext('2d');
    hasContent = true;
    const im = new Image();
    im.onload = () => { dctx.drawImage(im, 0, 0, S.N, S.N); render(); };
    im.src = d.img;
  }

  /* ---------- arayüz ---------- */
  function press(container, attr, value) {
    container.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr] === String(value))));
  }
  function buildShapes() {
    const box = $('at-shapes'); box.replaceChildren();
    for (const [id, label] of S.img ? [...SHAPES, ['image', 'Görselim']] : SHAPES) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.shape = id; b.title = label;
      b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', String(S.shape === id));
      const c = mk(64, 64);
      drawShape(c.getContext('2d'), id, 32, 32, 44, 0, '#283E35');
      b.append(c); box.append(b);
    }
  }
  function buildSwatches() {
    const box = $('at-swatches'); box.replaceChildren();
    for (const col of activeColors()) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'at-sw'; b.style.background = col; b.dataset.c = col;
      b.setAttribute('aria-label', `Renk ${col}`);
      b.setAttribute('aria-pressed', String(col.toLowerCase() === S.color.toLowerCase()));
      box.append(b);
    }
  }
  function buildPalettes() {
    const box = $('at-palettes'); box.replaceChildren();
    paletteList().forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'at-pal'; b.dataset.i = i; b.setAttribute('aria-pressed', String(i === S.pal));
      const strip = document.createElement('span'); strip.className = 'at-strip';
      for (const col of p.c) { const cell = document.createElement('i'); cell.style.background = col; strip.append(cell); }
      const name = document.createElement('span'); name.textContent = p.name;
      b.append(strip, name); box.append(b);
    });
  }
  function setColor(c) { S.color = c; $('at-custom-color').value = c.toLowerCase(); buildSwatches(); }
  function syncControls() {
    press($('at-tools'), 'tool', S.tool);
    press($('at-modes'), 'mode', S.mode);
    $('at-mode-hint').textContent = MODE_HINTS[S.mode];
    $('at-shape-group').hidden = S.tool !== 'stamp';
    $('at-tile-size').value = String(S.N);
    $('at-size').max = Math.round(220 * S.N / 512);
    $('at-size').value = S.size; $('at-size-val').textContent = S.size;
    $('at-cm').value = S.cm;
    const g = unitGeometry(S.mode, S.N, S.cm);
    $('at-unit-info').textContent = `Aktarılacak tekrar: ${g.repeatWidthCm} × ${g.repeatHeightCm} cm · ${g.width} × ${g.height} px`;
  }
  function scatter() {
    pushUndo();
    const bg = background().toLowerCase();
    const cols = activeColors().filter(c => c.toLowerCase() !== bg);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const kinds = SHAPES.map(s => s[0]);
    const main = pick(kinds), second = pick(kinds);
    const count = Math.round(14 + Math.random() * 14);
    for (let i = 0; i < count; i++) {
      const big = Math.random() < 0.35;
      stampAt(Math.random() * S.N, Math.random() * S.N, {
        shape: big ? main : (Math.random() < 0.5 ? second : 'circle'),
        color: pick(cols.length ? cols : activeColors()),
        size: S.N * (big ? 0.12 + Math.random() * 0.08 : 0.03 + Math.random() * 0.05),
        rot: Math.random() * Math.PI * 2,
      });
    }
    render(); autosave();
  }
  function download(canvas, name) {
    canvas.toBlob(blob => {
      if (!blob) { note('Görsel oluşturulamadı.', true); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = name;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      note(`İndirmeye gönderildi: ${name}`);
    }, 'image/png');
  }

  /* ---------- işaretçi ---------- */
  let down = false, last = null, lastStamp = null;
  const toTile = e => {
    const r = editor.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * 2 * S.N - S.N / 2, y: (e.clientY - r.top) / r.height * 2 * S.N - S.N / 2 };
  };
  editor.addEventListener('pointerdown', e => {
    e.preventDefault(); editor.setPointerCapture(e.pointerId); down = true; pushUndo();
    const p = toTile(e); last = p;
    if (S.tool === 'stamp') { stampAt(p.x, p.y); lastStamp = p; } else segment(p.x, p.y, p.x + 0.01, p.y);
    render();
  });
  editor.addEventListener('pointermove', e => {
    if (!down) return;
    const p = toTile(e);
    if (S.tool === 'stamp') {
      if (Math.hypot(p.x - lastStamp.x, p.y - lastStamp.y) > S.size * 1.15) { stampAt(p.x, p.y); lastStamp = p; render(); }
    } else { segment(last.x, last.y, p.x, p.y); render(); }
    last = p;
  });
  const end = () => { if (down) { down = false; autosave(); } };
  editor.addEventListener('pointerup', end); editor.addEventListener('pointercancel', end);

  /* ---------- olaylar ---------- */
  $('at-tools').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.tool = b.dataset.tool; syncControls();
  });
  $('at-modes').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.mode = b.dataset.mode; syncControls(); render(); autosave();
  });
  $('at-shapes').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.shape = b.dataset.shape; press($('at-shapes'), 'shape', S.shape);
  });
  $('at-swatches').addEventListener('click', e => { const b = e.target.closest('.at-sw'); if (b) setColor(b.dataset.c); });
  $('at-custom-color').addEventListener('input', e => { S.color = e.target.value; buildSwatches(); });
  $('at-palettes').addEventListener('click', e => {
    const b = e.target.closest('.at-pal'); if (!b) return;
    S.pal = Number(b.dataset.i); buildPalettes(); setColor(activeColors()[0]); autosave();
  });
  $('at-size').addEventListener('input', e => { S.size = Number(e.target.value); $('at-size-val').textContent = S.size; });
  $('at-sym').addEventListener('change', e => { S.sym = e.target.value; });
  $('at-rand-rot').addEventListener('change', e => { S.randRot = e.target.checked; });
  $('at-rand-size').addEventListener('change', e => { S.randSize = e.target.checked; });
  $('at-scale').addEventListener('input', e => { S.scale = e.target.value / 100; $('at-scale-val').textContent = `%${e.target.value}`; render(); });
  $('at-cm').addEventListener('change', e => {
    const value = Number(e.target.value);
    if (!Number.isFinite(value) || value < 5 || value > 25) { note('Raport ölçüsü 5–25 cm arasında olmalı.', true); syncControls(); return; }
    S.cm = value; syncControls(); autosave();
  });
  $('at-tile-size').addEventListener('change', e => {
    const n = Number(e.target.value), old = draw;
    if (!SIZES.includes(n)) return;
    draw = mk(n, n); dctx = draw.getContext('2d'); dctx.drawImage(old, 0, 0, n, n);
    S.N = n; S.size = Math.max(4, Math.round(S.size * n / old.width));
    undoStack = []; redoStack = []; syncHistory(); syncControls(); render(); autosave();
  });
  $('at-scatter').addEventListener('click', scatter);
  $('at-clear').addEventListener('click', () => {
    pushUndo(); dctx.clearRect(0, 0, S.N, S.N); hasContent = false; render(); autosave();
    note('Çizim temizlendi. Geri almak için “Geri al”.');
  });
  $('at-undo').addEventListener('click', undo);
  $('at-redo').addEventListener('click', redo);
  dialog.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  });
  $('at-img-input').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!['image/png', 'image/jpeg'].includes(f.type) || !f.size || f.size > MAX_STAMP_BYTES) {
      note('Motif için en fazla 10 MB PNG veya JPEG seçin.', true); return;
    }
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      S.img = im; S.shape = 'image'; S.tool = 'stamp'; buildShapes(); syncControls();
      note('Görseliniz motif olarak eklendi. Çizim alanına tıklayın.');
    };
    im.onerror = () => { URL.revokeObjectURL(url); note('Bu dosya açılamadı. PNG veya JPEG deneyin.', true); };
    im.src = url;
  });
  $('at-dl-tile').addEventListener('click', () => {
    const out = composeUnit(background(), mk(1, 1));
    download(out, `raport-${S.mode}-${out.width}x${out.height}.png`);
  });
  $('at-dl-fabric').addEventListener('click', () => {
    const tile = composeUnit(background(), mk(1, 1));
    const r = preview.getBoundingClientRect(), W = 2400, H = Math.round(W * (r.height / r.width || 0.75));
    const out = mk(W, H), o = out.getContext('2d');
    const pat = o.createPattern(tile, 'repeat');
    pat.setTransform(new DOMMatrix().scale((tilePxCss() / (r.width || 800)) * W / S.N));
    o.fillStyle = pat; o.fillRect(0, 0, W, H);
    download(out, 'kumas-onizleme.png');
  });
  $('at-apply').addEventListener('click', async () => {
    if (busy) return;
    busy = true; $('at-apply').disabled = true;
    try {
      const out = composeUnit(null, mk(1, 1));
      const g = unitGeometry(S.mode, S.N, S.cm);
      await onApply({
        dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height,
        repeatWidthCm: g.repeatWidthCm, repeatHeightCm: g.repeatHeightCm,
      });
      dialog.close();
    } catch (error) { note(`Desen aktarılamadı: ${error.message}`, true); }
    finally { busy = false; $('at-apply').disabled = false; }
  });
  $('at-close').addEventListener('click', () => dialog.close());
  new ResizeObserver(() => render()).observe(preview);

  loadDraft();
  syncHistory();

  return {
    open() {
      if (S.pal === 0 || !activeColors().some(c => c.toLowerCase() === S.color.toLowerCase())) S.color = activeColors()[0];
      $('at-custom-color').value = S.color.toLowerCase();
      buildShapes(); buildSwatches(); buildPalettes(); syncControls();
      note('Ortadaki kareye çizin; kumaşın tamamı kendiliğinden tekrar eder.');
      dialog.showModal();
      if (!hasContent) { scatter(); undoStack = []; syncHistory(); }
      render();
    },
  };
}
