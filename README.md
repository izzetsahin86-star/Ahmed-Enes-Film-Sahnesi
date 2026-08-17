# Ahmed Enes Film Sahnesi

Tarayıcı üzerinde çalışan, kamera ile kare kare çekim yapmaya odaklanan stop-motion film stüdyosu.

## İlk sürüm

- Kamera aç / kapat ve ön-arka kamera değiştir
- Kare yakalama
- 3 saniyelik çekim sayacı
- Onion skin
- 3x3 kadraj ızgarası
- Ayna modu
- Timeline üzerinde kare seçme ve sürükleyerek sıralama
- Kare çoğaltma, silme ve taşıma
- FPS ayarı ve önizleme oynatımı
- Projeyi IndexedDB'de yerel saklama
- JSON proje dosyası dışa / içe aktarma
- WebM video dışa aktarma (destekleyen tarayıcılarda)
- Mobil ve masaüstü uyumlu arayüz

## Çalıştırma

Bu proje bağımlılıksız statik HTML/CSS/JavaScript kullanır. Yerel sunucu üzerinden açın:

```bash
python3 -m http.server 8080
```

Ardından `http://localhost:8080` adresini açın.

> Kamera erişimi tarayıcı güvenlik kuralları nedeniyle HTTPS veya localhost gerektirir.
