# KumashAi

Tekstilci için yerel desen, renk, varyant ve baskı stüdyosu.

**Renk → desen → karıştır → zemin → ürün varyantı → sunum → çıktı**

## Çalıştırma

Python 3 ve güncel bir masaüstü tarayıcısı gerekir. Uygulama için npm paketi,
API anahtarı veya internet bağlantısı gerekmez.

```bash
./baslat.sh          # sunucuyu başlatır ve tarayıcıda açar
```

Elle başlatmak için:

```bash
python3 app/server.py
```

Tarayıcıda `http://127.0.0.1:8795` adresini açın. Başka port:

```bash
python3 app/server.py --port 8796
```

Sunucu yalnız kendi bilgisayarınızda dinler ve yalnız `web/` dosyalarını
yayınlar. Bu sürüm internete açık, çok kullanıcılı bir servis değildir.

## Windows

İki yol var:

- **Kurulumsuz (önerilen):** `dist/KumashAi.html` dosyasını Windows bilgisayara
  kopyalayıp çift tıklayın. Chrome veya Edge'de açılır; Python, sunucu ve
  internet gerekmez. Bütün özellikler aynıdır.
- **Sunuculu:** proje klasörünü kopyalayın ve `baslat.bat` dosyasını çift
  tıklayın. Python 3 gerekir; yoksa dosya ne yapılacağını söyler.

Tek dosyayı yeniden üretmek için: `python3 tools/tek_dosya.py`. `web/` altında
değişiklik yaptıktan sonra bu komutu yeniden çalıştırın.

Kayıtlar açılış yoluna bağlıdır: tek dosyayla yapılan çalışma sunuculu sürümde,
bir bilgisayardaki çalışma diğerinde görünmez. Taşımak için **JSON yedek** alın.

## Kullanım

Dört adım vardır; soldaki menüden ya da alttaki ileri/geri düğmeleriyle geçilir.

1. **Desen:** hazır motiflere dokunun, kendi deseninizi yükleyin (PNG/JPEG) ya da
   çizim atölyesinde çizin. Dizilimi seçin: **Serpme** (rastgele), **Düz sıra**,
   **Şaşırtmalı** ya da **Yarım kaydırmalı** (üçü de eşit aralıklı ve aynı yöne
   bakar). Kaydırıcılarla büyüklüğü ve motif sayısını ayarlayın. Dönüş ve tekrar ölçüsü "İnce ayar"dadır.
2. **Renkler:** zemini hazır renklerden (şeker pembesi, mint, ekru…) ya da renk
   kutusundan seçin; biye ve motif renklerini ayarlayın.
3. **Ürünler:** grubu (Kadın / Erkek / Çocuk), ürünü ve paketi seçin, istediğiniz zemin renklerini işaretleyin,
   "İşaretli renklerle ürünleri oluştur"a basın. Listeden bir ürüne dokunarak
   düzenleyebilir, × ile silebilirsiniz.
4. **Föy & yazdır:** firma, beden, kumaş ve kâğıdı (A5/A6) girip "Yazdır / PDF
   kaydet"e basın.

Grup seçimi ürün listesini süzer (Kadın: atlet, askılı atlet, külot; Erkek:
atlet, boxer; Çocuk: hepsi) ve föye yazılır. Kalıp çizimleri üç grupta aynıdır.

Deseni değiştirmek bütün ürünleri birlikte günceller; zemin ve biye her üründe
ayrıdır. Çalışma kendiliğinden bu tarayıcıya kaydedilir.

## Desen kaynakları

- Uygulamanın kodla çizilmiş özgün motifleri.
- Kendi desen arşivinizden PNG/JPEG.
- Kullanım hakkını edindiğiniz dosyalar; uygulama dış sitelerden desen kazımaz.

Şeffaf PNG ayrı motif gibi kullanılabilir. Opak JPEG/PNG içindeki nesneler
otomatik ayrıştırılmaz; dosya bütün desen olarak tekrarlanır.

**Renkleri değiştir** (her görselin altında): desenin baskın renklerini bulur;
her rengi yenisiyle değiştirebilir veya "Zemin yap" ile şeffaflaştırıp proje
zeminini (ör. şeker pembesi, mint, ekru) kullanabilirsiniz. Sonuç ayrı bir PNG
olarak eklenir (en uzun kenar 1600 px), özgün dosya durur. Düz renkli baskılarda
iyi çalışır; fotoğraf ve yumuşak geçişli görsellerde sonuç kabadır.

**Deseni al:** zemini şeffaf olmayan bir görsel (ürün fotoğrafı, stok önizleme)
yüklenince kendiliğinden açılır. Kumaşın zemin rengini bulur, zeminle çevrili
figürleri ayırır; masa, arka plan ve kenarda yarım kalan figürler alınmaz.
Seçilen figürler (en fazla 6) motif olur, proje zemini kumaşın rengine eşlenir
ve kaynak görsel projeden çıkarılır. Zemin yanlış bulunursa görselde kumaşın
zeminine tıklayın. "Görseli olduğu gibi kullan" eski davranışı korur.

**Elle figür seç** (her görselin altında): görselde bir figürün etrafına kutu çizin;
kutunun kenarındaki zemin rengi silinir ve figür şeffaf motif olarak eklenir.
Düz zeminli, büyük ve net desen görsellerinde iyi çalışır; giysi fotoğrafından
(kırışık, gölge, düşük çözünürlük) kesilen figür baskıya uygun olmaz. Yalnız
kullanım hakkı sizde olan görsellerde kullanın; lisanslı karakterler izinsiz
basılamaz.

**Çizim atölyesi** (Desen adımı): motif, fırça, silgi ve simetriyle
kesintisiz tekrar eden raport çizersiniz; düz, yarım kaydırma, tuğla ve ayna
dizilimi, raport/kumaş PNG indirme vardır. Projedeki şeffaf figürler (ör.
"Deseni al" ile alınanlar) atölyede hazır motif olarak gelir; "Eşit aralıkla
diz" seçili motifi 1×1–4×4 ızgarayla yerleştirir. "Desene uygula" atölyenin tek
yuvasını günceller; "Yeni desen olarak kaydet" her seferinde ayrı bir desen ekler
(listeden "Bütün desen yap" ile aralarında geçilir). "Desene uygula" çizimi şeffaf PNG
olarak projeye bütün desen diye yazar. Çizim taslağı projeden ayrı olarak bu
tarayıcıda (localStorage) tutulur; JSON yedeğine yalnız uygulanan raport girer.

Görsel sınırı **10 MB / 16 megapiksel**, proje JSON sınırı **20 MB**.
Kullanıcı SVG dosyaları çalıştırılmaz. Çok büyük görselleri yüklemeden önce
uygun çözünürlükte PNG/JPEG olarak dışa aktarın.

## Kayıt ve yedek

Projeler bu tarayıcıdaki **IndexedDB** alanına kaydedilir. Tarayıcı verilerini
silmek, başka tarayıcı kullanmak veya portu değiştirmek kayıtların görünmemesine
neden olabilir. Bu kayıt bulut yedeği değildir.

Önemli projeleri **JSON dışa aktarımıyla** ayrıca yedekleyin. Yedekler desen
ayarlarını, varyantları ve yüklenen görselleri içerir. Başka bilgisayarda aynı
dosya içeri alınabilir. Bozuk veya desteklenmeyen proje mevcut çalışmanın
üzerine yazılmaz.

## Baskı

- A5: bir sayfada en fazla altı varyant.
- A6: bir sayfada en fazla üç varyant.
- Föy düzeni: üstte koyu şeritte "DESEN kod" ve firma adı; solda ölçü
  çizgileriyle desen kutusu, altında R1… desen renkleri ve F1… zemin renkleri;
  sağda "VARYANT n" başlıklı ürünler (takımlar üst üste çizilir).
- Sunum föyü adımındaki **Beden** ve **Kumaş** alanları doluysa föye yazılır.
- PDF, tarayıcının yazdır diyalogundaki **PDF olarak kaydet** seçeneğidir.
- Baskı diyalogunda seçili kağıt boyutunu kontrol edin; üstbilgi/altbilgiyi
  kapatın ve önizlemeyi inceleyin.

Kaynak desenin gerçek tekrar ölçüsü bilgi olarak yazılır; sayfaya sığdırılmış
görsel gerçek boy numune değildir. Ekran ve yazıcı renkleri için resmî
TPX/Pantone veya fiziksel renk eşleşmesi garantisi verilmez. Başlangıç paleti
örnek palettir. Üretim onayından önce gerçek numune ve deneme baskısı kullanın.

## API özelliklerinin durumu

Manken önizlemesi, AI motif üretimi ve resmî renk kataloğu bağlantıları ilk
yerel teslimde **aktif değildir**. Arayüz API anahtarı toplamaz; görsellerinizi
dış servise göndermez. Ürün önizlemeleri gerçek çalışan 2D SVG şablonlarıdır;
AI çıktısı gibi sunulmaz.

Sağlayıcı seçimi, güvenli anahtar saklama, izinli dosya gönderimi, asenkron iş
durumları ve maliyet kontrolü `docs/TEKNIK-PLAN.md` içinde planlanmıştır.

## Doğrulama

Node.js 20 veya üzeri:

```bash
node --test tests/
```

Tarayıcı testi, Python Playwright ve Chromium test ortamını kullanır:

```bash
python3 tests/e2e.py
```

Sunucu sınırları (Linux ve Windows kod yolu) ve tek dosyalık sürüm:

```bash
python3 tests/server_test.py
python3 tests/tek_dosya_test.py
```

Görsel/PDF test çıktıları `test-results/` altına yazılır ve Git'e eklenmez.
Gerçekte çalıştırılan testler ve kalan bulgular `docs/DOGRULAMA.md` dosyasında
raporlanacaktır.

## Dosya yapısı

```text
app/server.py                yerel HTTP sunucusu
web/                         uygulama, tasarım motoru ve SVG çizimleri
tests/                       birim ve tarayıcı testleri
docs/TEKNIK-PLAN.md           bütün ürünün teknik tasarımı
_bmad-output/                onaylı kapsam, story ve sprint kayıtları
```
