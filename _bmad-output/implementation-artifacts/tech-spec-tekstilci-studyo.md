---
title: 'KumashAi — Tekstilci tasarım ve baskı akışı'
type: 'feature'
created: '2026-11-04'
status: 'ready-for-dev'
approved: '2026-11-04'
story_id: '1-1-tekstilci-studyo'
context: []
---

# KumashAi — Tekstilci tasarım ve baskı akışı

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tekstilci, desenleri ve renklerini birleştirerek ürün varyantları ve müşteriye sunulacak basılı föyler hazırlamak istiyor. Çalışma klasöründe uygulama veya BMAD yapılandırması bulunmuyor.

**Approach:** Türkçe, yerel çalışan bir web stüdyosu: renk → desen → karıştır → zemin → varyant → sunum → yazdır. Kullanıcının iki örneğindeki desen, palet ve ürün yerleşimi temel alınacak.

## Boundaries & Constraints

**Always:** Ana akış ücretsiz dış servislere dahi bağımlı olmayacak. Özgün motifler, tekrar kullanılabilen SVG ürün şablonları ve kaydedilebilir projeler kullanılacak. Aynı kaydedilmiş kompozisyon bütün varyantlarda korunacak.

**Ask First:** Ücretli API çağrısı, dosyaların dışarı gönderilmesi, lisanslı katalog dağıtımı ve proje dışındaki Git değişiklikleri.

**Never:** Referans föyleri uygulamanın desen varlığı olarak dağıtmak; örnek HEX değerlerini resmî TPX eşleşmesi diye sunmak; AI çıktısı veya baskı renk doğruluğu taklidi yapmak. Canlı manken API entegrasyonu bu ilk teslimin dışında.

## I/O & Edge-Case Matrix

| Durum | Girdi | Davranış | Hata yönetimi |
|---|---|---|---|
| Motif | Hazır motif veya şeffaf PNG | Ölçek, yön, sıklık, karıştırma | Seçim yoksa açıklama |
| Raster desen | PNG/JPEG; en fazla 10 MB ve 16 MP | Bütün desen olarak tekrarlanır | Bozuk/büyük dosya reddedilir |
| Zemin | Katmanlı motif/şeffaf görsel | Motiften bağımsız değişir | Opak görselde sınırlama açıklanır |
| Palet | HEX, kullanıcı renk kodu | Geçerli renk önizlenir | Hatalı değer kaydedilmez |
| Proje | Sürümlü JSON; en fazla 20 MB | Doğrulanıp geri yüklenir | Mevcut çalışma korunur |
| Kayıt | Tarayıcı depolaması dolu | Görünür hata, dosya yedeği | Başarılı kaydedildi denmez |
| Baskı | A5/A6; çok sayıda varyant | Sayfalama; taşma yok | Boş seçimde baskı engellenir |

</frozen-after-approval>

## Code Map

- `app/server.py`: yalnızca uygulama dosyalarını localhost üzerinde sunar.
- `web/index.html`, `web/styles.css`: Türkçe stüdyo ve baskı düzeni.
- `web/app.js`: ekranlar, dosyalar, kayıt ve işlemler.
- `web/design.js`: doğrulama, deterministik karıştırma ve varyant modeli.
- `web/render.js`: motifler, tekrar alanı, ürünler ve föyler.
- `tests/`: birim ve Playwright uçtan uca testleri.
- `README.md`: çalıştırma, sınırlar, veri yedeği ve baskı.

## Tasks & Acceptance

**Execution:**
- [ ] `app/server.py`, `README.md`: Python standart kitaplığıyla yerel sunucu; yalnız `web/` yayınlanır. Üst dizin Git deposuna dokunulmaz.
- [ ] `web/design.js`: palet, seçili motifler, seed, ölçek, yön, yoğunluk, zemin, biye, ürün türü ve varyantları tanımla.
- [ ] `web/render.js`: özgün çiçek/yıldız/bulut/tavşan/geometrik motifler; atlet, külot, boxer ve külot arka görünümü; taşmayan desen ve biye.
- [ ] `web/index.html`, `web/styles.css`, `web/app.js`: adımlı stüdyo, canlı önizleme, görsel yükleme, bağımsız renkler, karıştırma, takım ve üçlü/beşli paketler.
- [ ] `web/app.js`: IndexedDB kayıt/açma ve doğrulanmış JSON dışa/içe aktarımı; kullanıcı metnini HTML olarak çalıştırma.
- [ ] `web/render.js`, `web/styles.css`: firma/desen bilgisi, palet, varyant numaraları; A5'te sayfa başına en fazla altı, A6'da üç varyant. Yazdır düğmesi tarayıcı baskı/PDF diyalogunu açar.
- [ ] `web/index.html`: manken alanında “API bağlantısı henüz kurulmadı”; anahtar toplama veya sahte üretim yok.
- [ ] `tests/design.test.mjs`, `tests/e2e.py`: matris hataları, kayıt, varyant tutarlılığı ve baskı boyutlarını doğrula.

**Acceptance Criteria:**
- Given hazır motifler, when kullanıcı akışı tamamlar, then seçilen desen ve renklerle ürün föyü hazırlanır.
- Given bir kompozisyon, when yalnız zemin değiştirilir, then motif yerleşimi değişmez.
- Given proje kaydı, when sayfa yenilenir veya JSON açılır, then desen, görseller, palet ve varyantlar korunur.
- Given A5/A6, when PDF oluşturulur, then yalnız föyler çıkar; arayüz ve taşmalar bulunmaz.
- Given ölçülü desen, when föye sığdırılır, then gerçek tekrar ölçüsü ile baskı önizleme ölçeği karıştırılmaz.
- Given API bulunmaması, when ana akış kullanılır, then desen, varyant ve baskı işlemleri çalışır.

## Spec Change Log

- 2026-11-04: Kullanıcı teknik planın tamamlanmasını ve kodlamaya başlanmasını onayladı. İlk teslim sınırları korunur; sonraki entegrasyonlar ayrı teknik planda detaylandırılır.

## Design Notes

Vanilla JavaScript, SVG ve Python; çalışma zamanı paket kurulumu yok. Şeffaf PNG motif olarak karıştırılabilir; düzleştirilmiş JPEG içindeki nesnelerin otomatik ayrıştırılması vaat edilmez. Başlangıç renkleri örnek palettir; kullanıcı kendi katalog kodunu girebilir. Desen ölçüsü metadata olarak tutulur; küçültülmüş föyde “orijinal boy” etiketi kullanılmaz.

## Verification

- `node --test tests/design.test.mjs`: doğrulama ve deterministik kompozisyon testleri geçer.
- `python3 tests/e2e.py`: tarayıcı akışı, yeniden açma, hatalı dosyalar ve PDF denetimleri geçer.
- Masaüstü ve dar ekranda görsel kontrol; A5/A6 PDF sayfa ölçüleri ve taşma kontrolü.
