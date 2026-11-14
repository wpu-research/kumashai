# KumashAi — Tam teknik plan

Onay: 4 Kasım 2026  
Hedef kullanıcı: tekstilci, desen hazırlayan personel ve müşteri sunumu yapan satış ekibi  
İlk uygulama: `1-1-tekstilci-studyo`  
Onaylı teslim sınırı: `_bmad-output/implementation-artifacts/tech-spec-tekstilci-studyo.md`

## 1. Ürün tanımı

KumashAi, desen üretimini tek başına amaçlayan bir görsel sohbet aracı değil,
tekstilci için **desenden basılı müşteri sunumuna uzanan çalışma stüdyosudur**.

Ana akış:

**Renkleri belirle → Deseni belirle → Deseni karıştır → Zemin renklerini ayarla
→ Varyant yap → Sunum sayfasını hazırla → Çıktısını al.**

Manken üzerinde gösterme, ana akışın çalışmasını engellemeyen isteğe bağlı bir
sunum seçeneğidir. Başlangıçta ürünler gerçek işlevli 2D şablonlarda gösterilir.

Referanslar kullanıcının sağladığı R-K8162 ve R-K8203 sunumlarıdır. Benimsenecek
özellikler: desen kodu, firma başlığı, ana desen örneği, desen ve zemin paletlerinin
ayrılması, numaralandırılmış varyantlar, atlet/alt giyim takımları ve ön/arka görünüm.
Bu referansların motifleri veya firma markası uygulama varlığı olarak kopyalanmaz.

## 2. Teslim aşamaları

| Aşama | Kullanıcı kazanımı | Çıkış koşulu |
|---|---|---|
| 1 — Yerel stüdyo | Desen, renk, ürün varyantı, proje kaydı, A5/A6 sunum | Uçtan uca tarayıcı ve baskı testleri |
| 2 — Kataloglar | Toplu palet aktarımı, lisanslı desen arşivi düzeni | Veri kaynağı/kullanım hakkı belirlenmiş ve içe aktarım testleri geçmiş |
| 3 — Manken | Onaylı varyantın dış servisle görselleştirilmesi | Sağlayıcı, anahtar, bütçe, veri gönderim izni ve hata senaryoları tamamlanmış |
| 4 — AI motif | Komutla yeni motif hazırlama ve kütüphaneye ekleme | Üretilen varlık doğrulanıp kullanıcı tarafından kabul edilmiş |

Aşama 1 dış ağ, ücretli API veya resmî renk verisi gerektirmez. Sonraki aşamalar
ilk sürümde çalışıyormuş gibi gösterilmez. Çok kullanıcılı SaaS, abonelik,
muhasebe, üretim emri ve kumaş metraj hesabı bu ürün planının dışında kalır.

## 3. Ekranlar ve davranışlar

### 3.1 Proje alanı

- Proje adı, firma adı, desen kodu ve desen tekrar ölçüsü.
- Kaydet, kayıtlı projeyi aç, JSON yedeğini indir ve yedeği içeri al.
- Kaydetme başarılı olmadan başarı mesajı verilmez.
- Kaydedilmemiş çalışmanın üzerine başka proje alınması açık onay ister.
- Depolama tarayıcıya aittir; başka bilgisayara geçmek için yedek dosyası gerekir.

### 3.2 Renkleri belirle

- Başlangıç için isimlendirilmiş örnek renkler.
- Motif paleti, ürün zemini ve biye/lastik rengi ayrı veriler.
- Kullanıcı HEX değeri ile kendi katalog kodunu girebilir.
- Örnek değerler resmî TPX/Pantone karşılığı olarak etiketlenmez.
- Resmî renk kataloğu dağıtımı, yetkili veri kaynağı seçilene kadar yapılmaz.

### 3.3 Deseni belirle

Dört kaynak ayrı tutulur:

1. Uygulamaya özgü, kodla çizilmiş motifler.
2. Tekstilcinin kendi yüklediği PNG/JPEG dosyaları.
3. Sonraki aşamada kullanıcı tarafından edinilmiş lisanslı desen dosyaları.
4. Sonraki aşamada onaylanmış AI motif çıktıları.

Çiçek, yıldız, bulut, tavşan ve geometrik öğeler ilk kütüphaneyi oluşturur.
Kullanıcının dosyaları dış servise gönderilmeden yerelde işlenir.

**Şeffaf motif ile düzleştirilmiş desen aynı değildir:** Şeffaf PNG ayrı motif gibi
yerleştirilebilir. JPEG veya opak desen, içindeki nesneler ayrıştırılmadan bütün
bir tekrar görseli olarak kullanılır. Altındaki zemini değiştirmek, opak dosyanın
kendi arka planını değiştirmiş gibi sunulmaz.

### 3.4 Deseni karıştır

- Motif seçimi, ölçek, yön, yoğunluk ve yeniden yerleştirme.
- Karıştır düğmesi yeni bir seed oluşturur.
- Aynı seed ve parametreler aynı kompozisyonu verir.
- Karıştırma palet ve ürün tipi değişiminden bağımsızdır.
- Tekrar alanının kenarını aşan motifler karşı kenara taşınarak süreklilik sağlar.
- Yüklenen bir desenin zaten dikişsiz olduğu varsayılmaz; kullanıcıya önizlenir.

### 3.5 Zemin ve varyantlar

- Ana kompozisyon bütün varyantların ortak kaynağıdır.
- Zemin ve biye değişimi motiflerin yerini değiştirmez.
- Motif/yerleşim değişikliği ortak deseni ve varyant önizlemelerini birlikte günceller.
- Ürün seçenekleri: atlet, külot, boxer; külotta ön/arka görünüm.
- Takımlar: atlet–külot ve atlet–boxer.
- Paketler: aynı ürün ailesinden üçlü/beşli gruplar.
- Varyantlar açık bir kullanıcı işlemiyle oluşturulur; boş föy basılmaz.

### 3.6 Sunum ve baskı

Sayfada şu alanlar bulunur:

- Firma/proje başlığı, desen kodu ve sayfa numarası.
- Ölçüsü belirtilen ana desen örneği.
- Motif renkleri ve kullanılan varyant zeminleri.
- Numaralandırılmış ürün/takım/paket görselleri.
- Küçültülmüş örneğin gerçek boy olmadığını açıklayan ölçü notu.

A5 ve A6 için ayrı sayfalama uygulanır. A5 sayfasında en fazla altı, A6
sayfasında en fazla üç varyant bulunur. Bir paket tek varyanttır; içindeki
ürünler kendi alanına sığdırılır. Baskıda uygulama düğmeleri ve gezinme alanı
yer almaz. Taşan kartlar kesilmez; yeni sayfaya bölünür.

İlk PDF yöntemi tarayıcının yazdır/PDF olarak kaydet akışıdır; doğrudan PDF
motoru veya yazıcı sürücüsü entegrasyonu varmış gibi gösterilmez. A5/A6 kağıt
seçimi önizlemeyi ve CSS sayfa ölçüsünü birlikte günceller.

**Renk sınırı:** Ekran önizlemesi fiziksel katalog eşleşmesi garantisi değildir.
Üretim onayı için gerçek numune ve deneme baskısı gerekir. ICC profili,
CMYK ayrımı, RIP veya renk ölçüm cihazı ilk teslimde yoktur. Görsel canlılığı
ile ölçülmüş renk doğruluğu farklı hedefler olarak ele alınır.

## 4. İlk sürüm mimarisi

```text
Tarayıcı
 ├─ index.html + styles.css       arayüz / baskı kuralları
 ├─ app.js                       etkileşim / yükleme / IndexedDB
 ├─ design.js                    veri doğrulama / seed / varyant mantığı
 └─ render.js                    SVG motif / ürün / föy
       │
       ├─ IndexedDB              yerel proje kayıtları
       └─ JSON dosyası            taşınabilir yedek

127.0.0.1 üzerindeki Python sunucusu
 ├─ yalnız web/ dosyaları
 └─ healthz                      yerel sağlık kontrolü
```

- Python standart kitaplığı; JavaScript ES modülleri; SVG çizim.
- Çalışma zamanında paket veya font indirme zorunluluğu yok.
- SVG seçimi: özgün motifler, ürün sınırına kırpma ve ölçeklenebilir baskı
  aynı çizim modelinden üretilir.
- Kodla oluşturulan SVG ile kullanıcıdan alınan SVG ayrılır; ilk sürüm
  kullanıcı SVG'si çalıştırmaz, yalnız raster dosya kabul eder.
- Ayrı şablon/motif/palet kavramları sayesinde API ve katalog özellikleri
  aynı düzenleme motorunu değiştirmeden eklenebilir.

## 5. Veri modeli ve sınırlar

Mantıksal model:

| Veri | İçerik |
|---|---|
| Proje | Sürüm, kimlik, ad/firma/desen kodu, kayıt bilgisi |
| Palet | Renk adı, geçerli HEX, isteğe bağlı kullanıcı katalog kodu |
| Kompozisyon | Motif seçimi, seed, ölçek, yoğunluk, yön, tekrar ölçüsü |
| Görsel varlık | Güvenli PNG/JPEG verisi, doğrulanan boyut, kullanım modu |
| Varyant | Kimlik, ürün/takım/paket türü, zemin ve biye renkleri |
| Sunum | Kağıt boyutu, varyant sırası ve başlık bilgileri |

Kaydedilen proje kendi görsellerini içerir; geçici `blob:` adresleri dosya
yedeğine taşınmaz. Kullanıcı tarafından içeri alınan JSON güvenilir kabul edilmez.
Kimlikler, sayı aralıkları, enum değerleri ve renkler doğrulanır. `NaN`, sonsuz
sayı, aşırı uzun metin, sınırsız liste ve dış URL kabul edilmez.

- Görsel dosyası: en fazla 10 MB; çözümlenmiş boyut en fazla 16 megapiksel.
- Proje dosyası: en fazla 20 MB; toplam varlık bütçesi de denetlenir.
- JSON içindeki gömülü görsel, gerçek görsel olarak çözümlenmeden kabul edilmez.
- Dosya uzantısı tek başına doğrulama değildir.
- İçe aktarım tamamen doğrulanır; ardından mevcut proje tek adımda değiştirilir.
- Kaydetme veya içe aktarım hatası son sağlam çalışmayı silmez.
- Şema sürümü desteklenmiyorsa açıklayıcı hata verilir; sessiz veri kaybı olmaz.

Uygulama içindeki gerçek alan isimleri ve sınırlar `web/design.js` tarafından
belirlenir; belgeyle çelişki kabul testinde hata sayılır.

## 6. Güvenlik ve gizlilik

İlk sürüm tek bilgisayarda kullanım için tasarlanır. Sunucu varsayılan olarak
yalnız `127.0.0.1` üzerinde dinler; internete açık servis olarak dağıtılmaz.

- Sunucu yalnız `web/` altını yayınlar.
- Dizin listeleme, üst dizine kaçış, sembolik bağlantı üzerinden dosya okuma,
  gizli dosyalar ve kaynak/config dosyası servisi engellenir.
- Kullanıcı metinleri HTML olarak çalıştırılmaz; SVG öznitelikleri de kaçışlanır.
- Harici görsel URL'leri ve çalıştırılabilir dosyalar kabul edilmez.
- Arayüzde API anahtarı formu, sahte üretim düğmesi veya gizli ağ isteği yoktur.
- Testlerde kullanıcıya ait gerçek ses/görsel dosyaları gerekli değildir.
- Yedek dosyaları ve ilerideki API anahtarları Git'e eklenmez.

İnternete açma ayrı güvenlik çalışması gerektirir: kimlik doğrulama,
yetkilendirme, TLS, CSRF koruması, iş/harcama limitleri ve erişim kayıtları.
Yerel ilk sürüm bunları sağlıyormuş gibi tanıtılmaz.

## 7. Katalog entegrasyonu tasarımı

### 7.1 Palet aktarımı

Sonraki teslimin giriş sözleşmesi:

```csv
name,code,hex
Kullanıcı rengi,KULLANICI-001,#E7B9AA
```

Dosya UTF-8 olacaktır. Zorunlu alanlar ve HEX değerleri satır bazında
doğrulanacak; hatalı satırlar raporlanacak. Mevcut paletin üzerine yazma açık
onay isteyecek. Aynı kodun farklı HEX değerlerine karşılık gelmesi sessizce
çözülmeyecek. Kaynağı doğrulanmamış bir palete “resmî” etiketi verilmeyecek.

### 7.2 Desen arşivi

Öncelik kullanıcının kendi arşividir. Dış kaynaktan alınan dosyalar için
kaynak adı, kullanıcı notu ve edinim/kullanım hakkı bilgisi saklanabilir.
Dosyaları içeri almak ile tüm uygulama kullanıcılarına dağıtmak ayrı
işlemler olarak tasarlanır. Otomatik site kazıma veya izinsiz toplu arşiv
oluşturma uygulanmaz.

## 8. Manken API entegrasyonu tasarımı

### 8.1 Aktivasyon önkoşulları

1. Kullanıcı desteklenen sağlayıcıyı ve bütçesini seçer.
2. Ürün görseli ve seçilen manken görselinin servisle uyumluluğu doğrulanır.
3. Sağlayıcının veri saklama ve kullanım şartları kullanıcıya gösterilir.
4. Anahtar yalnız sunucu yapılandırmasına eklenir.
5. Kullanıcı açıkça “Manken görseli oluştur” işlemini başlatır.

FASHN aday sağlayıcıdır; nihai sağlayıcı seçilmiş veya bağlantı yapılmış
değildir. Adayın resmî belgelerinde Bearer anahtarıyla `/v1/run` ve
`/v1/status/{id}` tabanlı asenkron işlem bulunur. Entegrasyon açılırken
güncel model adı, parametreleri, ürün desteği ve ücret yeniden doğrulanır.

### 8.2 Uygulama sözleşmesi

Sağlayıcıyı arayüzden ayıran sunucu adaptörü:

```text
POST /api/try-on/jobs          açık kullanıcı işlemiyle iş oluştur
GET  /api/try-on/jobs/{id}     iş durumu / güvenli sonuç
POST /api/try-on/jobs/{id}/cancel
```

Bu yollar ilk sürümde uygulanmış değildir. İş durumları:

`queued → running → succeeded | failed | cancelled | expired`

- İstek kimliği/idempotency kaydı: çift tıklama iki ücretli iş yaratmaz.
- Görsel, boyut ve içerik türü doğrulanır; rastgele kullanıcı URL'si çekilmez.
- Sağlayıcı anahtarı istemciye, proje JSON'una veya loglara gönderilmez.
- Zaman aşımı, `401`, `429`, servis hatası, reddedilen içerik ve boş/bozuk
  sonuç ayrı mesajlarla ele alınır.
- Başarısız isteği sınırsız otomatik tekrarlayarak harcama yapılmaz.
- İptal desteği sağlayıcıda yoksa uygulama bunu açıkça söyler; ücret iadesi
  veya üretimin durduğu iddia edilmez.
- Sağlayıcının döndürdüğü sonuç URL'si izinli HTTPS kaynaklarıyla sınırlandırılır.
- Sonuç kaynağı “AI önizleme” olarak işaretlenir.

AI görseli, onaylanmış desenin veya üretim renklerinin yerine geçmez.
Kullanıcı sonucunu kabul ederse sunuma ekler; orijinal varyant değişmeden
korunur. Çocuk ürünlerinde ilk teslim 2D ürün çizimlerini kullanır; ilerideki
manken görselleştirmeleri seçilen servisin içerik ve ürün kurallarına göre
ayrıca değerlendirilir.

### 8.3 API kabul testleri

- Anahtar yokken ana stüdyo çalışır; dış istek gönderilmez.
- Çift tıklama tek iş oluşturur.
- Hatalı anahtarda sonuç veya ücret başarısı taklit edilmez.
- Ağ kesilmesinden sonra mevcut proje kaybolmaz.
- Tamamlanan görsel gerçek servis sonucudur ve “AI önizleme” etiketlidir.
- Log, tarayıcı ağı ve JSON yedeği anahtar içermez.

## 9. AI motif üretimi tasarımı

İstek; konu, renk paleti, motif sayısı ve kullanım amacı içerir. Sistem,
çıktıyı doğrudan onaylı desen kabul etmez:

`istek → üretim → dosya doğrulama → kullanıcı önizleme/onayı → kütüphaneye ekleme`

Çıktı şeffaf değilse zemin ayrıştırma otomatik başarı gibi gösterilmez.
Dikişsiz tekrar iddiası, kenar kontrolü yapılmadan verilmez. Mevcut motifler
ve projeler AI hatasında korunur. Ücret, anahtar ve dış veri gönderimi
manken entegrasyonundaki güvenlik modelini izler.

## 10. Test ve teslim planı

### Birim testleri

- Aynı seed aynı yerleşim; farklı seed farklı yerleşim.
- Yalnız zemin değişimi yerleşimi etkilemez.
- Renk, enum, sayı, kimlik, liste ve dosya bütçesi doğrulamaları.
- Bozuk veya desteklenmeyen proje reddi.
- A5/A6 sayfalama, boş ve sınırdaki varyant sayıları.

### Tarayıcı testleri

- İlk açılış, adımlar arası gezinme ve canlı önizleme.
- Motif ekleme/çıkarma, karıştırma ve renk değişimi.
- Tek ürün, takım, üçlü/beşli paket.
- PNG/JPEG yükleme; opak görsel sınırı; bozuk dosya.
- IndexedDB kayıt, sayfa yenileme, JSON dışa/içe aktarım.
- Hatalı içe aktarımda mevcut çalışmanın korunması.
- JavaScript hatası ve beklenmedik harici ağ isteği bulunmaması.
- Dar ekranda okunabilirlik; yatay taşma kontrolü.

### Baskı testleri

- A5/A6 PDF fiziksel sayfa boyutlarının kontrolü.
- Varyant sayısına göre doğru sayfa sayısı.
- Ürünlerin, paletin ve başlıkların kesilmemesi.
- Arayüzün çıktıda bulunmaması.
- Yüklenen raster görsellerin PDF içinde de görünmesi.
- Ölçü etiketlerinin küçültülmüş örneğe gerçek-boy iddiası taşımaması.

### İnceleme ve Git akışı

- Projeye özel depo ve `story/1-1-tekstilci-studyo` dalı.
- Test sonuçları ve doğrulama çıktıları belgelenecek.
- CR öncesi uygulama commit'i ve `review` durumu.
- Üç bağımsız paralel inceleme: kör hata avcısı, sınır durumları ve kabul denetimi.
- Bulgular severity, konum ve öneriyle story dosyasına yazılacak.
- Projenin deferred-fix kuralına göre sonuç kaydedilip `main` dalına
  fast-forward merge yapılacak; kalan bulgular saklanmayacak.
- Uzak depoya push, dağıtım veya ücretli servis açılışı yapılmayacak.

## 11. Teknik kaynaklar

Yalnız teknik kararları doğrulamak için kullanılan birincil belgeler:

- MDN: SVG `pattern` / `patternUnits` ve CSS `@page` / `size`.
- MDN: IndexedDB ve dosya/görsel API'leri.
- FASHN: API kimlik doğrulama, `POST /v1/run`, `GET /v1/status/{id}`.

Bu kaynaklar uygulamanın ağ bağımlılığı değildir. Sağlayıcı modeli/ücreti
ve resmî katalog verisi ilk teslimin parçası sayılmaz.
