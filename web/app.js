import {
  LIMITS, MOTIFS, PAPER, COLOR, GROUND_NAMES, AUDIENCES, clone, defaultProject, validateProject, parseProject,
  serializeProject, inspectImageData, imageHeaderDimensions, validateDimensions,
  variantFromDraft, batchVariants, paginateVariants, paperDimensions,
} from './design.js';
import { initAtolye } from './atolye.js';
import { initRecolor } from './recolor.js';
import { initFigure } from './figur.js';
import { escapeHTML as e, motifIcon, garmentSVG, swatchSVG, printSheetsHTML, productLabel, setAssetRenderSources } from './render.js';

const $ = id => document.getElementById(id);
const names = ['Desen', 'Renkler', 'Ürünler', 'Föy & yazdır'];
const LAST_STEP = names.length;
let project = defaultProject();
let step = 1;
let selectedVariant = null;
let previewMode = 'product';
let showAll = false;
let revision = 0;
let autoTimer;
let frame;
let db = null;
let storageError = false;
let initializing = true;
let importBusy = false;
let printBusy = false;
let operationGeneration = 0;
let printRevision = -1;
let lastAutosave = Promise.resolve();
const decodedAssets = new Map();
const renderAssetURLs = new Map();

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  $('status').setAttribute('role', error ? 'alert' : 'status');
  $('status').setAttribute('aria-live', error ? 'assertive' : 'polite');
}
function setValue(id, value) {
  const element = $(id);
  if (document.activeElement !== element) element.value = value;
}
function newId(prefix = 'v') {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `${prefix}-${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
}
function changed(message) {
  revision++;
  if (message) status(message);
  $('save-state').textContent = storageError ? 'Yerel kayıt yok · JSON yedeği alın' : 'Yerel taslak kaydediliyor…';
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => { void autosave(); }, 750);
  if (!frame) frame = requestAnimationFrame(() => { frame = null; render(); });
}
function setStep(next) {
  step = Math.max(1, Math.min(LAST_STEP, next));
  document.querySelectorAll('[data-step]').forEach(button => {
    const active = Number(button.dataset.step) === step;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.panel) !== step; });
  $('current-step-title').textContent = names[step - 1];
  $('step-counter').textContent = `Adım ${step} / ${LAST_STEP}`;
  $('previous-step').disabled = step === 1;
  $('next-step').hidden = step === LAST_STEP;
  $('next-step').textContent = `${names[step] || ''} →`;
  $('presentation-area').hidden = step < LAST_STEP;
  $('collection-panel').hidden = step >= LAST_STEP;
  render();
}
function renderControls() {
  setValue('project-name', project.name);
  setValue('design-code', project.designCode);
  setValue('company-name', project.company);
  setValue('size-info', project.size);
  setValue('fabric-info', project.fabric);
  setValue('background-color', project.background);
  setValue('background-hex', project.background);
  setValue('trim-color', project.trim);
  setValue('trim-hex', project.trim);
  const allowed = AUDIENCES[project.audience].products;
  for (const option of $('product-type').options) option.hidden = option.disabled = !allowed.includes(option.value);
  $('audience').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.audience === project.audience)));
  setValue('product-type', project.product);
  setValue('pack-type', project.pack);
  setValue('pattern-mode', project.composition.mode);
  setValue('paper-size', project.presentation.paper);
  setValue('paper-orientation', project.presentation.orientation);
  setValue('repeat-width', project.composition.repeatWidthCm);
  setValue('repeat-height', project.composition.repeatHeightCm);
  for (const field of ['scale', 'rotation', 'density']) setValue(field, project.composition[field]);
  $('scale-output').textContent = `${project.composition.scale.toFixed(2)}×`;
  $('rotation-output').textContent = `${project.composition.rotation}°`;
  $('density-output').textContent = `${project.composition.density} motif`;
  $('seed-display').textContent = project.composition.seed;
  $('density').disabled = project.composition.mode === 'raster';
  $('pattern-mode-field').hidden = project.assets.length === 0;
  $('ground-quick').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ground === project.background.toUpperCase())));
  $('mix-button').disabled = project.composition.mode !== 'motifs' || project.composition.motifs.length === 0;
  $('mix-hint').textContent = project.composition.mode === 'raster'
    ? 'Yüklediğiniz desen olduğu gibi tekrarlanır; yeniden dizme ve motif sayısı kullanılmaz. Büyüklüğü değiştirebilirsiniz.'
    : project.composition.motifs.length === 0
      ? 'Önce yukarıdan en az bir motif seçin.'
      : 'Beğenene kadar basın; bütün ürünlerde aynı yerleşim kullanılır.';
  $('selected-variant-box').hidden = !selectedVariant;
  const selected = project.variants.find(v => v.id === selectedVariant);
  $('selected-variant-label').textContent = selected ? `Seçili: ${selected.label}` : '';
  $('add-variant').disabled = project.variants.length >= LIMITS.variants;
  $('generate-variants').disabled = project.selectedBackgrounds.length === 0 ||
    project.variants.length + project.selectedBackgrounds.length > LIMITS.variants;
  $('print-button').disabled = !project.variants.length || printBusy;
  $('add-color').disabled = project.palette.length >= LIMITS.palette;
}
function renderPalette() {
  $('palette-controls').innerHTML = project.palette.map(p => `<div class="palette-row" data-palette-id="${e(p.id)}">
    <input type="color" value="${e(p.color)}" data-palette-field="color" data-testid="palette-color" aria-label="${e(p.name)} rengi">
    <div class="palette-details"><input value="${e(p.name)}" maxlength="32" data-palette-field="name" aria-label="Renk adı"><small>${e(p.color)}</small></div>
    <input class="palette-code" value="${e(p.code)}" maxlength="32" data-palette-field="code" data-testid="palette-code" aria-label="${e(p.name)} kullanıcı kodu">
    <button class="icon-button" data-delete-color="${e(p.id)}" type="button" aria-label="${e(p.name)} rengini sil" ${project.palette.length === 1 ? 'disabled' : ''}>×</button>
  </div>`).join('');
}
function renderMotifs() {
  $('motif-controls').innerHTML = Object.entries(MOTIFS).map(([id, name], index) => {
    const selected = project.composition.motifs.includes(id);
    return `<button type="button" class="motif-choice ${selected ? 'selected' : ''}" data-motif="${id}"
      data-testid="motif-${id}" aria-pressed="${selected}">${motifIcon(id, project.palette[index % project.palette.length].color)}${e(name)}</button>`;
  }).join('');
}
function renderAssets() {
  $('asset-list').innerHTML = project.assets.map(asset => `<div class="asset-row">
    <img src="${e(asset.dataUrl)}" alt="" width="37" height="37">
    <div><strong>${e(asset.name)}</strong><small>${asset.width} × ${asset.height} px</small><div class="asset-actions">
      ${asset.mime === 'image/png' ? `<button class="text-button" type="button" data-asset-motif="${e(asset.id)}" aria-pressed="${project.composition.motifs.includes(`asset:${asset.id}`)}">${project.composition.motifs.includes(`asset:${asset.id}`) ? '✓ Motif seçili' : 'Motif olarak seç'}</button>` : ''}
      <button class="text-button" type="button" data-asset-figure="${e(asset.id)}">Figür seç</button>
      <button class="text-button" type="button" data-asset-recolor="${e(asset.id)}">Renkleri değiştir</button>
      <button class="text-button" type="button" data-asset-tile="${e(asset.id)}">${project.composition.mode === 'raster' && project.composition.rasterAssetId === asset.id ? '✓ Bütün desen' : 'Bütün desen yap'}</button>
    </div></div><button class="icon-button" type="button" data-delete-asset="${e(asset.id)}" aria-label="${e(asset.name)} görselini sil">×</button>
  </div>`).join('');
}
function renderGroundQuick() {
  $('ground-quick').innerHTML = Object.entries(GROUND_NAMES).map(([color, name]) =>
    `<button type="button" data-ground="${color}" aria-pressed="false" title="${color}"><i style="background:${color}"></i>${e(name)}</button>`).join('');
}
function renderBackgrounds() {
  const selected = project.selectedBackgrounds.map(color => color.toUpperCase());
  const options = [...new Set([...Object.keys(GROUND_NAMES), ...selected])];
  $('background-options').innerHTML = options.map(color => `<label class="background-option">
    <input type="checkbox" value="${color}" data-background-option ${selected.includes(color) ? 'checked' : ''} aria-label="${color} zeminini toplu üretime ekle">
    <i style="background:${color}"></i>${GROUND_NAMES[color] || color}</label>`).join('');
}
function renderPreview() {
  const draft = variantFromDraft(project, 'preview');
  $('main-preview').innerHTML = previewMode === 'product' ? garmentSVG(project, draft) : swatchSVG(project);
  $('main-preview').classList.toggle('fabric-mode', previewMode === 'fabric');
  $('mini-swatch').innerHTML = swatchSVG(project);
  $('preview-code').textContent = project.designCode;
  $('preview-product-label').textContent = previewMode === 'product' ? productLabel(draft) : 'Tekrar alanı · ölçekli önizleme';
  $('background-dot').style.backgroundColor = project.background;
  $('background-label').textContent = `${project.background} zemin`;
  $('repeat-label').textContent = `${project.composition.repeatWidthCm} × ${project.composition.repeatHeightCm} cm tekrar`;
  $('composition-badge').textContent = `Yerleşim no ${project.composition.seed}`;
  for (const mode of ['product', 'fabric']) {
    $(`view-${mode}`).classList.toggle('active', mode === previewMode);
    $(`view-${mode}`).setAttribute('aria-pressed', String(mode === previewMode));
  }
}
function renderVariants() {
  $('variant-count').textContent = `${project.variants.length} ürün`;
  if (step >= LAST_STEP) return;
  const all = showAll || step === 3;
  const variants = all ? project.variants : project.variants.slice(0, 6);
  $('show-all-variants').hidden = all || project.variants.length <= 6;
  $('show-all-variants').textContent = `Tüm ${project.variants.length} varyantı göster`;
  $('variant-list').innerHTML = variants.length ? variants.map((v, index) => `<article class="variant-card ${selectedVariant === v.id ? 'selected' : ''}"
    data-testid="variant-card" data-variant-id="${e(v.id)}">
    <button class="variant-select" data-select-variant="${e(v.id)}" type="button" aria-label="${e(v.label)} varyantını seç" aria-pressed="${selectedVariant === v.id}">
      <span class="variant-number">${String(index + 1).padStart(2, '0')}</span>${garmentSVG(project, v)}
    </button><div class="variant-card-footer"><div><strong>${e(v.label)}</strong><small>${e(productLabel(v))}</small>
      <span class="variant-color-pair"><i style="background:${e(v.background)}" title="Zemin ${e(v.background)}"></i><i style="background:${e(v.trim)}" title="Biye ${e(v.trim)}"></i></span>
    </div><button type="button" class="icon-button" data-delete-variant="${e(v.id)}" aria-label="${e(v.label)} varyantını sil">×</button></div>
  </article>`).join('') : '<div class="empty-state">Koleksiyonunuz için ilk varyantı ekleyin. Tasarım taslağı hazır; henüz bir ürün föye eklenmedi.</div>';
}
function renderPrint(force = false) {
  const { paper, orientation } = project.presentation;
  const { width, height } = paperDimensions(paper, orientation);
  const pages = paginateVariants(project.variants, paper);
  $('page-style').textContent = `@page { size: ${width}mm ${height}mm; margin: 0; }`;
  document.body.classList.toggle('no-print-variants', project.variants.length === 0);
  $('presentation-summary').textContent = `${project.variants.length} varyant · ${pages.length} sayfa · Ortak kompozisyon #${project.composition.seed}. Kaynak desen, kullanıcı kodları, gerçek zeminler ve biyeler föyde birlikte yer alır.`;
  $('print-summary').textContent = `${project.variants.length} ürün · ${pages.length} sayfa\n${paper} ${orientation === 'landscape' ? 'yatay' : 'dikey'} (${width} × ${height} mm) · sayfada en fazla ${PAPER[paper].capacity} ürün`;
  $('print-empty').hidden = project.variants.length > 0;
  // No hidden, potentially very large print DOM during normal editing.
  if (!force && step < LAST_STEP) {
    if ($('print-sheets').childElementCount) $('print-sheets').replaceChildren();
    printRevision = -1;
    return;
  }
  if (printRevision !== revision || force) {
    $('print-sheets').innerHTML = printSheetsHTML(project);
    printRevision = revision;
  }
}
function render() { renderControls(); renderPreview(); renderVariants(); renderPrint(); }
function renderAll() {
  renderPalette(); renderMotifs(); renderAssets(); renderGroundQuick(); renderBackgrounds(); render();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB bu tarayıcıda kullanılamıyor.')); return; }
    const request = indexedDB.open('kumashai-studio', 1);
    const timeout = setTimeout(() => reject(new Error('Yerel veritabanı açılamadı; başka sekmedeki bağlantıyı kapatın.')), 5000);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('projects');
      database.createObjectStore('catalog', { keyPath: 'id' });
    };
    request.onerror = () => { clearTimeout(timeout); reject(request.error); };
    request.onblocked = () => { clearTimeout(timeout); reject(new Error('Yerel veritabanı başka sekme tarafından engelleniyor.')); };
    request.onsuccess = () => {
      clearTimeout(timeout);
      request.result.onversionchange = () => {
        request.result.close(); db = null; storageFailure(new Error('Yerel kayıt bağlantısı değişti; sayfayı yeniden açın.'));
      };
      resolve(request.result);
    };
  });
}
function readRecord(key) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Yerel kayıt kullanılamıyor.')); return; }
    const tx = db.transaction('projects', 'readonly');
    const request = tx.objectStore('projects').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function catalogRecords() {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Yerel kayıt kullanılamıyor.')); return; }
    const tx = db.transaction('catalog', 'readonly');
    const request = tx.objectStore('catalog').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error);
  });
}
function persist(snapshot, key = 'draft') {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Yerel kayıt kullanılamıyor.')); return; }
    const tx = db.transaction(['projects', 'catalog'], 'readwrite');
    tx.objectStore('projects').put(snapshot, key);
    if (key !== 'draft') {
      tx.objectStore('catalog').put({ id: key, name: snapshot.name, code: snapshot.designCode, updatedAt: Date.now() });
      tx.objectStore('projects').put(snapshot, 'draft');
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Yerel kayıt başarısız.'));
    tx.onabort = () => reject(tx.error || new Error('Yerel kayıt işlemi iptal edildi.'));
  });
}
function storageFailure(error) {
  storageError = true;
  $('save-state').textContent = 'Kaydedilemedi · JSON yedeği alın';
  const detail = error?.name === 'QuotaExceededError' ? 'Tarayıcı depolama kotası doldu.' : error?.message || 'Tarayıcı depolaması kullanılamıyor.';
  status(`${detail} Çalışmanız ekranda korunuyor. “JSON yedek” ile dosyaya kaydedin.`, true);
}
function autosave() {
  if (initializing) return Promise.resolve();
  const savedRevision = revision;
  lastAutosave = lastAutosave.catch(() => {}).then(async () => {
    if (savedRevision !== revision) return;
    try {
      const snapshot = validateProject(project);
      await persist(snapshot);
      storageError = false;
      if (revision === savedRevision) $('save-state').textContent = '✓ Yerel taslak kaydedildi';
    } catch (error) { storageFailure(error); }
  });
  return lastAutosave;
}
async function saveProject() {
  try {
    const snapshot = validateProject(project);
    const key = `saved:${snapshot.name}`;
    const existing = await readRecord(key);
    if (existing && !confirm(`“${snapshot.name}” adlı yerel kaydın üzerine yazılsın mı?`)) return;
    const savedRevision = revision;
    await persist(snapshot, key);
    storageError = false;
    if (savedRevision === revision) $('save-state').textContent = '✓ Proje ve yerel taslak kaydedildi';
    status(`“${snapshot.name}” bu tarayıcıya kaydedildi. Kayıtları aç menüsünden geri açabilirsiniz.`);
  } catch (error) { storageFailure(error); }
}
async function showProjects() {
  $('projects-dialog').showModal();
  $('saved-projects').textContent = 'Kayıtlar okunuyor…';
  try {
    const records = await catalogRecords();
    $('saved-projects').innerHTML = records.length ? records.map(record => `<div class="saved-project-row"><div>
      <strong>${e(record.name)}</strong><small>${e(record.code)} · ${e(new Date(record.updatedAt).toLocaleString('tr-TR'))}</small>
      </div><button class="button secondary" type="button" data-open-saved="${e(record.id)}">Aç</button></div>`).join('')
      : '<p class="small muted">Henüz adlandırılmış kayıt yok. “Projeyi kaydet” ile bir kayıt oluşturun veya JSON yedeği açın.</p>';
  } catch {
    $('saved-projects').textContent = 'Yerel arşiv kullanılamıyor. JSON yedeğinden açabilirsiniz.';
  }
}

function decodeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => { image.src = ''; reject(new Error('Görsel çözümlenemedi veya süre aşımına uğradı.')); }, 12000);
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Görsel bozuk veya desteklenmiyor.')); };
    image.src = dataUrl; // Own validated data payload only. Never fetch().
  });
}
function imageBytes(dataUrl) {
  const payload = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i++) bytes[i] = payload.charCodeAt(i);
  return bytes;
}
function syncAssetSources() {
  // Store large image payloads once. Sixty product previews must not duplicate
  // ten-megabyte base64 attributes sixty times. JSON still owns the full data.
  for (const [id, source] of renderAssetURLs) {
    const asset = project.assets.find(asset => asset.id === id);
    if (!asset || asset.dataUrl !== source.dataUrl) {
      URL.revokeObjectURL(source.url);
      renderAssetURLs.delete(id);
    }
  }
  for (const asset of project.assets) {
    if (!renderAssetURLs.has(asset.id)) {
      const url = URL.createObjectURL(new Blob([imageBytes(asset.dataUrl)], { type: asset.mime }));
      renderAssetURLs.set(asset.id, { url, dataUrl: asset.dataUrl });
    }
  }
  setAssetRenderSources(new Map([...renderAssetURLs].map(([id, source]) => [id, source.url])));
}
async function verifyAsset(asset) {
  inspectImageData(asset.dataUrl, asset.mime);
  imageHeaderDimensions(imageBytes(asset.dataUrl), asset.mime);
  const image = await decodeImage(asset.dataUrl);
  validateDimensions(image.naturalWidth, image.naturalHeight);
  if (asset.width !== image.naturalWidth || asset.height !== image.naturalHeight)
    throw new Error('Görselin bildirilen ölçüleri çözümlenen dosyayla eşleşmiyor.');
  return image;
}
async function verifyProjectAssets(candidate) {
  const decoded = new Map();
  for (const asset of candidate.assets) decoded.set(asset.id, await verifyAsset(asset));
  return decoded;
}
async function replaceProject(candidate, decoded, message) {
  clearTimeout(autoTimer);
  operationGeneration++;
  project = candidate;
  syncAssetSources();
  selectedVariant = null;
  showAll = false;
  decodedAssets.clear();
  for (const [key, image] of decoded) decodedAssets.set(key, image);
  revision++;
  printRevision = -1;
  renderAll();
  status(message);
  await autosave();
}
async function importProject(file) {
  if (!file || importBusy) return;
  importBusy = true;
  const startRevision = revision;
  try {
    if (file.size > LIMITS.projectBytes) throw new Error('Proje JSON dosyası en fazla 20 MB olabilir.');
    status('Proje ve gömülü görseller doğrulanıyor; mevcut çalışma korunuyor…');
    const candidate = parseProject(await file.text());
    const decoded = await verifyProjectAssets(candidate);
    const message = revision !== startRevision
      ? 'Doğrulama sırasında tasarım değişti. Güncel çalışmanın yerine JSON projesi açılsın mı?'
      : `“${candidate.name}” açılsın mı? Mevcut çalışma değiştirilecek. Önce JSON yedeği alabilirsiniz.`;
    if (!confirm(message)) { status('İçe aktarma iptal edildi; mevcut çalışma korundu.'); return; }
    await replaceProject(candidate, decoded, `“${candidate.name}” bütün görselleriyle doğrulandı ve açıldı.`);
    $('projects-dialog').close();
  } catch (error) { status(`Proje açılamadı: ${error.message} Mevcut çalışma değiştirilmedi.`, true); }
  finally { importBusy = false; $('import-project').value = ''; }
}
function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.onabort = () => reject(new Error('Dosya okuma iptal edildi.'));
    reader.readAsDataURL(file);
  });
}
function hasTransparency(image) {
  const size = 64, canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}
async function uploadImage(file) {
  if (!file) return;
  const generation = operationGeneration;
  $('image-upload').disabled = true;
  try {
    if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Yalnız PNG veya JPEG yükleyin.');
    if (!file.size || file.size > LIMITS.assetBytes) throw new Error('Görsel en fazla 10 MB olabilir; boş dosya kullanılamaz.');
    if (project.assets.length >= LIMITS.assets) throw new Error('En fazla 8 görsel eklenebilir.');
    imageHeaderDimensions(new Uint8Array(await file.arrayBuffer()), file.type);
    const dataUrl = await fileDataUrl(file);
    inspectImageData(dataUrl, file.type);
    const image = await decodeImage(dataUrl);
    const { width, height } = validateDimensions(image.naturalWidth, image.naturalHeight);
    if (generation !== operationGeneration) throw new Error('Yükleme sırasında proje değişti; görseli yeniden seçin.');
    const asset = { id: newId('img'), name: (file.name || 'Görsel').slice(0, 120), mime: file.type, width, height, dataUrl };
    const candidate = clone(project);
    candidate.assets.push(asset);
    candidate.composition.rasterAssetId = asset.id;
    // Yalnız şeffaf zeminli PNG tek motif gibi serpilir; opak görsel bütün desen olur.
    if (file.type === 'image/png' && hasTransparency(image)) {
      candidate.composition.mode = 'motifs';
      candidate.composition.motifs.push(`asset:${asset.id}`);
    } else {
      candidate.composition.mode = 'raster';
    }
    project = validateProject(candidate);
    syncAssetSources();
    decodedAssets.set(asset.id, image);
    renderAssets(); renderMotifs();
    changed('Desen eklendi. Altındaki düğmelerle içinden figür seçebilir ya da renklerini değiştirebilirsiniz.');
  } catch (error) { status(`Görsel yüklenemedi: ${error.message}`, true); }
  finally { $('image-upload').disabled = false; $('image-upload').value = ''; }
}
const ATOLYE_ASSET = 'atolye-raport';
/** Çizim atölyesinin şeffaf raportunu projeye "bütün desen" olarak yazar. */
async function applyAtolye({ dataUrl, width, height, repeatWidthCm, repeatHeightCm }) {
  const replacing = project.assets.some(a => a.id === ATOLYE_ASSET);
  if (!replacing && project.assets.length >= LIMITS.assets) throw new Error('En fazla 8 görsel eklenebilir; önce bir görseli silin.');
  const asset = { id: ATOLYE_ASSET, name: 'Çizim atölyesi raportu', mime: 'image/png', width, height, dataUrl };
  const image = await verifyAsset(asset);
  const candidate = clone(project);
  candidate.assets = [...candidate.assets.filter(a => a.id !== ATOLYE_ASSET), asset];
  candidate.composition.mode = 'raster';
  candidate.composition.rasterAssetId = ATOLYE_ASSET;
  candidate.composition.repeatWidthCm = repeatWidthCm;
  candidate.composition.repeatHeightCm = repeatHeightCm;
  project = validateProject(candidate);
  syncAssetSources();
  decodedAssets.set(ATOLYE_ASSET, image);
  renderAssets(); renderMotifs();
  changed(`Çizdiğiniz raport ortak desen oldu (${repeatWidthCm} × ${repeatHeightCm} cm). Zemin rengi tüm varyantlarda ayrı ayrı değiştirilebilir.`);
}
/** Kesilen figürü şeffaf PNG motif olarak ekler; kaynak görsel olduğu gibi kalır. */
async function applyFigure(sourceId, { dataUrl, width, height }) {
  const source = project.assets.find(a => a.id === sourceId);
  if (!source) throw new Error('Kaynak görsel artık projede yok.');
  if (project.assets.length >= LIMITS.assets) throw new Error('En fazla 8 görsel eklenebilir; önce bir görseli silin.');
  const asset = { id: newId('img'), name: `${source.name.slice(0, 100)} · figür`, mime: 'image/png', width, height, dataUrl };
  const image = await verifyAsset(asset);
  const candidate = clone(project);
  candidate.assets.push(asset);
  candidate.composition.mode = 'motifs';
  candidate.composition.motifs.push(`asset:${asset.id}`);
  project = validateProject(candidate);
  syncAssetSources();
  decodedAssets.set(asset.id, image);
  renderAssets(); renderMotifs();
  changed('Figür motif olarak eklendi. Yalnız onu kullanmak için diğer motiflerin işaretini kaldırın; rengi için “Renkleri değiştir”.');
}
/** Renk ayırma sonucunu kaynağın yanına ayrı PNG olarak yazar ve kaynağın rolünü ona verir. */
async function applyRecolor(sourceId, { dataUrl, width, height }) {
  const source = project.assets.find(a => a.id === sourceId);
  if (!source) throw new Error('Kaynak görsel artık projede yok.');
  const derivedId = `${sourceId}-rk`.length <= 48 ? `${sourceId}-rk` : newId('img');
  const replacing = project.assets.some(a => a.id === derivedId);
  if (!replacing && project.assets.length >= LIMITS.assets) throw new Error('En fazla 8 görsel eklenebilir; önce bir görseli silin.');
  const asset = { id: derivedId, name: `${source.name.slice(0, 100)} · yeni renk`, mime: 'image/png', width, height, dataUrl };
  const image = await verifyAsset(asset);
  const candidate = clone(project);
  candidate.assets = [...candidate.assets.filter(a => a.id !== derivedId), asset];
  const c = candidate.composition;
  const asMotif = c.mode === 'motifs' && c.motifs.includes(`asset:${sourceId}`);
  if (asMotif) {
    c.motifs = [...new Set(c.motifs.map(m => m === `asset:${sourceId}` ? `asset:${derivedId}` : m))];
  } else {
    c.mode = 'raster';
    c.rasterAssetId = derivedId;
  }
  project = validateProject(candidate);
  syncAssetSources();
  decodedAssets.set(derivedId, image);
  renderAssets(); renderMotifs();
  changed(`Yeni renkli kopya ${asMotif ? 'motif' : 'bütün desen'} olarak kullanılıyor. Özgün görsel listede duruyor; renkleri yeniden değiştirebilirsiniz.`);
}
function exportProject() {
  try {
    const json = serializeProject(project);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.designCode.replace(/[^a-zA-Z0-9_-]/g, '_') || 'kumashai'}-proje.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status('Görselleri içeren sürüm 1 JSON yedeği indirmeye gönderildi. İndirilen dosyayı saklayın.');
  } catch (error) { status(`Yedek oluşturulamadı: ${error.message}`, true); }
}
async function printProject() {
  if (printBusy || !project.variants.length) { status('Yazdırmak için en az bir varyant ekleyin.', true); return; }
  printBusy = true;
  $('print-button').disabled = true;
  try {
    status('Görseller ve baskı föyleri hazırlanıyor…');
    // Imported images must already be decoded; check again if the cache is cold.
    for (const asset of project.assets) {
      if (!decodedAssets.has(asset.id)) decodedAssets.set(asset.id, await verifyAsset(asset));
    }
    // Object URLs are local, not network calls. Wait for every image that SVG
    // references to load before invoking the browser's print dialog.
    await Promise.all([...renderAssetURLs.values()].map(source => decodeImage(source.url)));
    renderPrint(true);
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.print();
    status('Tarayıcı yazdır penceresi açıldı. PDF için “PDF olarak kaydet” seçin; fiziksel baskı veya dosya kaydı doğrulanamaz.');
  } catch (error) { status(`Baskı hazırlanamadı: ${error.message}`, true); }
  finally { printBusy = false; $('print-button').disabled = !project.variants.length; }
}

function bindEvents() {
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => setStep(Number(button.dataset.step))));
  $('previous-step').addEventListener('click', () => setStep(step - 1));
  $('next-step').addEventListener('click', () => setStep(step + 1));
  $('edit-repeat').addEventListener('click', () => { setStep(1); $('fine-tune').open = true; $('repeat-width').focus(); });
  $('manage-variants').addEventListener('click', () => setStep(3));
  for (const [id, field, max] of [['project-name', 'name', 80], ['design-code', 'designCode', 40], ['company-name', 'company', 80]]) {
    $(id).addEventListener('change', event => {
      const value = event.target.value.trim();
      if (!value || value.length > max || /[\u0000-\u001F\u007F]/.test(value)) {
        event.target.value = project[field]; status('Geçerli, boş olmayan bir metin girin. Eski değer korundu.', true); return;
      }
      project[field] = value; changed();
    });
  }
  for (const [id, field, max] of [['size-info', 'size', 40], ['fabric-info', 'fabric', 80]]) {
    $(id).addEventListener('change', event => {
      const value = event.target.value.trim();
      if (value.length > max || /[\u0000-\u001F\u007F]/.test(value)) {
        event.target.value = project[field]; status('Geçersiz metin; eski değer korundu.', true); return;
      }
      project[field] = value; changed('Föydeki beden / kumaş bilgisi güncellendi.');
    });
  }
  $('palette-controls').addEventListener('input', event => {
    const input = event.target.closest('[data-palette-field]');
    if (!input || input.dataset.paletteField !== 'color') return;
    const p = project.palette.find(p => p.id === input.closest('[data-palette-id]').dataset.paletteId);
    if (!COLOR.test(input.value)) return;
    p.color = input.value.toUpperCase();
    input.closest('.palette-row').querySelector('small').textContent = p.color;
    changed();
  });
  $('palette-controls').addEventListener('change', event => {
    const input = event.target.closest('[data-palette-field]');
    if (!input || input.dataset.paletteField === 'color') { renderMotifs(); return; }
    const p = project.palette.find(p => p.id === input.closest('[data-palette-id]').dataset.paletteId);
    const field = input.dataset.paletteField;
    const value = input.value.trim();
    if ((field === 'name' && !value) || value.length > 32 || /[\u0000-\u001F\u007F]/.test(value)) {
      input.value = p[field]; status('Renk adı/kodu geçersiz; eski değer korundu.', true); return;
    }
    p[field] = value; changed();
  });
  $('palette-controls').addEventListener('click', event => {
    const button = event.target.closest('[data-delete-color]');
    if (!button || project.palette.length <= 1) return;
    if (!confirm('Bu palet rengi silinsin mi? Ortak motif renkleri tüm varyantlarda yeniden eşleşir.')) return;
    project.palette = project.palette.filter(p => p.id !== button.dataset.deleteColor);
    renderPalette(); renderMotifs(); changed('Palet rengi silindi. Motif yerleşimi aynı kaldı.');
  });
  $('add-color').addEventListener('click', () => {
    if (project.palette.length >= LIMITS.palette) return;
    project.palette.push({ id: newId('color'), color: '#A6B5A0', name: 'Yeni renk', code: '' });
    renderPalette(); renderMotifs(); changed();
  });
  $('motif-controls').addEventListener('click', event => {
    const button = event.target.closest('[data-motif]');
    if (!button) return;
    const motif = button.dataset.motif;
    const list = project.composition.motifs;
    project.composition.motifs = list.includes(motif) ? list.filter(m => m !== motif) : [...list, motif];
    project.composition.mode = 'motifs';
    renderMotifs(); renderAssets();
    changed('Motif seçimi bütün ürünlerde güncellendi.');
  });
  $('pattern-mode').addEventListener('change', event => {
    if (event.target.value === 'raster' && !project.assets.length) {
      event.target.value = project.composition.mode; status('Önce bir desen yükleyin.', true); return;
    }
    project.composition.mode = event.target.value;
    if (project.composition.mode === 'raster' && !project.composition.rasterAssetId) project.composition.rasterAssetId = project.assets[0].id;
    renderAssets(); changed();
  });
  $('image-upload').addEventListener('change', event => { void uploadImage(event.target.files[0]); });
  const atolye = initAtolye({
    getColors: () => ({ background: project.background, palette: project.palette.map(p => p.color) }),
    onApply: applyAtolye,
  });
  $('open-atolye').addEventListener('click', () => atolye.open());
  const recolorTool = initRecolor({ getBackground: () => project.background, onApply: applyRecolor });
  const figureTool = initFigure({ getBackground: () => project.background, onApply: applyFigure });
  $('asset-list').addEventListener('click', async event => {
    const button = event.target.closest('[data-asset-recolor], [data-asset-figure]');
    if (!button) return;
    const figure = button.dataset.assetFigure !== undefined;
    const asset = project.assets.find(a => a.id === (figure ? button.dataset.assetFigure : button.dataset.assetRecolor));
    if (!asset) return;
    try {
      if (!decodedAssets.has(asset.id)) decodedAssets.set(asset.id, await verifyAsset(asset));
      (figure ? figureTool : recolorTool).open(asset, decodedAssets.get(asset.id));
    } catch (error) { status(`Görsel açılamadı: ${error.message}`, true); }
  });
  $('asset-list').addEventListener('click', event => {
    const motifButton = event.target.closest('[data-asset-motif]');
    const tileButton = event.target.closest('[data-asset-tile]');
    const deleteButton = event.target.closest('[data-delete-asset]');
    if (motifButton) {
      const id = `asset:${motifButton.dataset.assetMotif}`;
      const list = project.composition.motifs;
      project.composition.motifs = list.includes(id) ? list.filter(m => m !== id) : [...list, id];
      project.composition.mode = 'motifs';
    } else if (tileButton) {
      project.composition.rasterAssetId = tileButton.dataset.assetTile;
      project.composition.mode = 'raster';
    } else if (deleteButton) {
      if (!confirm('Bu görsel projeden ve ortak desenden silinsin mi? Tüm varyantlar etkilenir.')) return;
      const id = deleteButton.dataset.deleteAsset;
      project.assets = project.assets.filter(a => a.id !== id);
      syncAssetSources();
      decodedAssets.delete(id);
      project.composition.motifs = project.composition.motifs.filter(m => m !== `asset:${id}`);
      if (project.composition.rasterAssetId === id) {
        project.composition.rasterAssetId = null; project.composition.mode = 'motifs';
      }
    } else return;
    renderAssets(); renderMotifs(); changed();
  });
  for (const field of ['scale', 'rotation', 'density']) {
    $(field).addEventListener('input', event => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) return;
      project.composition[field] = value;
      changed();
    });
  }
  for (const [id, field] of [['repeat-width', 'repeatWidthCm'], ['repeat-height', 'repeatHeightCm']]) {
    $(id).addEventListener('change', event => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value) || value < 5 || value > 50) {
        event.target.value = project.composition[field]; status('Tekrar ölçüsü 5–50 cm arasında olmalı.', true); return;
      }
      project.composition[field] = value; changed('Tekrar ölçüsü ortak kompozisyonda güncellendi. Önizleme gerçek boy değildir.');
    });
  }
  $('mix-button').addEventListener('click', () => {
    if (!project.composition.motifs.length || project.composition.mode !== 'motifs') return;
    project.composition.seed = (project.composition.seed + 1) >>> 0;
    changed('Motifler yeniden dizildi; bütün ürünler güncellendi.');
  });
  for (const key of ['background', 'trim']) {
    $(`${key}-color`).addEventListener('input', event => {
      if (!COLOR.test(event.target.value)) return;
      project[key] = event.target.value.toUpperCase(); setValue(`${key}-hex`, project[key]); changed();
    });
    $(`${key}-hex`).addEventListener('change', event => {
      if (!COLOR.test(event.target.value)) {
        event.target.value = project[key]; status('Renk #RRGGBB biçiminde olmalı. Eski renk korundu.', true); return;
      }
      project[key] = event.target.value.toUpperCase(); changed();
    });
  }
  $('ground-quick').addEventListener('click', event => {
    const button = event.target.closest('[data-ground]');
    if (!button) return;
    project.background = button.dataset.ground;
    changed(`Zemin: ${GROUND_NAMES[button.dataset.ground]}.`);
  });
  $('background-options').addEventListener('change', event => {
    if (!event.target.matches('[data-background-option]')) return;
    const value = event.target.value;
    if (event.target.checked && project.selectedBackgrounds.length >= LIMITS.backgrounds) {
      event.target.checked = false; status('En fazla 12 toplu zemin seçilebilir.', true); return;
    }
    project.selectedBackgrounds = event.target.checked ? [...project.selectedBackgrounds, value] : project.selectedBackgrounds.filter(c => c.toUpperCase() !== value);
    changed();
  });
  $('add-background').addEventListener('click', () => {
    if (project.selectedBackgrounds.some(color => color.toUpperCase() === project.background.toUpperCase())) { status('Bu zemin zaten toplu üretim listesinde.'); return; }
    if (project.selectedBackgrounds.length >= LIMITS.backgrounds) { status('En fazla 12 toplu zemin seçilebilir.', true); return; }
    project.selectedBackgrounds.push(project.background); renderBackgrounds(); changed('Geçerli zemin toplu üretim listesine eklendi.');
  });
  $('audience').addEventListener('click', event => {
    const button = event.target.closest('[data-audience]');
    if (!button || button.dataset.audience === project.audience) return;
    project.audience = button.dataset.audience;
    const { label, products } = AUDIENCES[project.audience];
    if (!products.includes(project.product)) project.product = products[0];
    changed(`${label} ürünleri gösteriliyor. Daha önce eklediğiniz ürünler değişmedi.`);
  });
  for (const [id, key] of [['product-type', 'product'], ['pack-type', 'pack']]) {
    $(id).addEventListener('change', event => { project[key] = event.target.value; changed(); });
  }
  $('add-variant').addEventListener('click', () => {
    if (project.variants.length >= LIMITS.variants) { status('En fazla 60 varyant eklenebilir.', true); return; }
    const label = $('variant-label').value.trim();
    if (!label || label.length > 48 || /[\u0000-\u001F\u007F]/.test(label)) { status('Varyant adı 1–48 karakter olmalı.', true); return; }
    project.variants.push(variantFromDraft(project, newId(), label));
    changed('Ürün eklendi.');
  });
  $('generate-variants').addEventListener('click', () => {
    try {
      if (!project.selectedBackgrounds.length) throw new Error('Önce en az bir toplu zemin seçin.');
      const variants = batchVariants(project, project.selectedBackgrounds.map(() => newId()));
      for (const v of variants) v.label = GROUND_NAMES[v.background.toUpperCase()] || v.label;
      project.variants.push(...variants);
      changed(`${variants.length} ürün eklendi. Aşağıdaki listede görebilir, 4. adımda yazdırabilirsiniz.`);
    } catch (error) { status(error.message, true); }
  });
  $('variant-list').addEventListener('click', event => {
    const select = event.target.closest('[data-select-variant]');
    const remove = event.target.closest('[data-delete-variant]');
    if (select) {
      const variant = project.variants.find(v => v.id === select.dataset.selectVariant);
      if (!variant) return;
      selectedVariant = variant.id;
      for (const key of ['background', 'trim', 'product', 'pack']) project[key] = variant[key];
      $('variant-label').value = variant.label;
      setStep(3);
      changed('Ürün düzenlemeye açıldı. Değiştirip “Değişikliği bu ürüne kaydet”e basın.');
    } else if (remove) {
      if (!confirm('Bu ürün listeden silinsin mi?')) return;
      project.variants = project.variants.filter(v => v.id !== remove.dataset.deleteVariant);
      if (selectedVariant === remove.dataset.deleteVariant) selectedVariant = null;
      changed('Ürün silindi.');
    }
  });
  $('update-variant').addEventListener('click', () => {
    const index = project.variants.findIndex(v => v.id === selectedVariant);
    if (index < 0) return;
    const label = $('variant-label').value.trim();
    if (!label || label.length > 48 || /[\u0000-\u001F\u007F]/.test(label)) { status('Geçerli bir varyant adı girin.', true); return; }
    if (!confirm('Seçili varyantın zemin, biye, ürün ve paket bilgileri güncellensin mi?')) return;
    project.variants[index] = variantFromDraft(project, selectedVariant, label);
    changed('Ürün güncellendi.');
  });
  $('clear-selection').addEventListener('click', () => { selectedVariant = null; render(); });
  $('show-all-variants').addEventListener('click', () => { showAll = true; renderVariants(); });
  for (const mode of ['product', 'fabric']) $(`view-${mode}`).addEventListener('click', () => { previewMode = mode; renderPreview(); });
  for (const [id, key] of [['paper-size', 'paper'], ['paper-orientation', 'orientation']]) {
    $(id).addEventListener('change', event => { project.presentation[key] = event.target.value; changed(); });
  }
  $('save-project').addEventListener('click', () => { void saveProject(); });
  $('export-project').addEventListener('click', exportProject);
  $('open-project').addEventListener('click', () => { void showProjects(); });
  $('close-projects').addEventListener('click', () => $('projects-dialog').close());
  $('import-project').addEventListener('change', event => { void importProject(event.target.files[0]); });
  $('saved-projects').addEventListener('click', async event => {
    const button = event.target.closest('[data-open-saved]');
    if (!button || importBusy) return;
    importBusy = true;
    try {
      const candidate = validateProject(await readRecord(button.dataset.openSaved));
      const decoded = await verifyProjectAssets(candidate);
      if (!confirm(`“${candidate.name}” açılsın mı? Mevcut çalışma değiştirilecek.`)) return;
      await replaceProject(candidate, decoded, 'Yerel proje bütün görselleriyle açıldı.');
      $('projects-dialog').close();
    } catch (error) { status(`Yerel proje açılamadı: ${error.message} Mevcut çalışma korundu.`, true); }
    finally { importBusy = false; }
  });
  $('print-button').addEventListener('click', () => { void printProject(); });
  window.addEventListener('beforeprint', () => renderPrint(true));
  window.addEventListener('afterprint', () => { if (step < LAST_STEP) renderPrint(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { clearTimeout(autoTimer); void autosave(); }
  });
}

async function initialize() {
  // Render immediately but prevent edits until the previous draft is verified.
  $('studio').inert = true;
  renderAll();
  try {
    db = await openDatabase();
    const saved = await readRecord('draft');
    if (saved) {
      const candidate = validateProject(saved);
      const decoded = await verifyProjectAssets(candidate);
      project = candidate;
      syncAssetSources();
      for (const [key, image] of decoded) decodedAssets.set(key, image);
      status('Son yerel taslağınız görselleri ve varyantlarıyla geri yüklendi.');
    }
    $('save-state').textContent = saved ? '✓ Son yerel taslak açıldı' : 'Yeni yerel taslak';
  } catch (error) { storageFailure(error); }
  finally {
    initializing = false;
    $('studio').inert = false;
    bindEvents();
    renderAll();
  }
}
const ready = initialize();
// Read-only integration hooks; exports/imports remain the persistence boundary.
window.KumashAi = Object.freeze({
  ready,
  getProject: () => clone(project),
  getStep: () => step,
});
