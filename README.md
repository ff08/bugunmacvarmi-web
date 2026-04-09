# Bugün Maç Var mı? (bugunmacvarmi.com)

Bu proje, Google Sheet (GViz JSON) kaynağından günlük maçları çekip **kullanıcının yerel saatine göre** listeler.

## Geliştirme

```bash
cd bugunmacvarmi-web
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Build çıktısı `dist/` klasörüne üretilir.

## Deploy (statik)

Herhangi bir statik hosting ile çalışır:
- **Cloudflare Pages** / **Netlify** / **Vercel (Static)**:
  - **Build command**: `npm run build`
  - **Output directory**: `dist`

## Veri kaynağı

Uygulama Google Sheet GViz endpoint’inden veri çeker.
- Sheet kolonları: `Saat(TR)`, `Kanal`, `Takımlar`
- Saat dönüşümü: TR saati \(UTC+3 varsayımı\) baz alınır, kullanıcı cihazının saat dilimine çevrilip gösterilir.

