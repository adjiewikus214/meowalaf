# ADR-005 — QuranHub MCP (api.qurani.ai) sebagai sumber enrichment build-time

> **Status**: Diterima · **Tanggal**: 2026-10-01 · **Konteks**: Phase 2 core loop
> Referensi: [ARCHITECTURE.md](../ARCHITECTURE.md) § 6, [ADR-002](ADR-002-sumber-konten-equran-id.md), [ADR-004](ADR-004-bundle-konten-penuh.md), [RULES.md](../RULES.md) § 7
>
> **Pelaksanaan**: Langkah 1 selesai (mcp-client + `content:mcp-check`, 2026-10-01). Langkah 2 selesai dengan **revisi scope** — lihat "Update Langkah 2" di bawah.

## Konteks

Phase 2 butuh data yang **tidak dimiliki** bundle equran.id saat ini — terutama arti per kata
(quest harian PRD § 5.2 menyebut "tebak 5 arti kata"), dan distractor soal yang lebih pedagogis.
Sementara itu ditemukan layanan **QuranHub MCP**: gateway Model Context Protocol di
`https://api.qurani.ai/gw/mcp` dengan **93 tools** di atas data quran.com v4.

Hasil verifikasi langsung dari environment ini (2026-10-01):

- `initialize` → server `quranhub` v1.0.0, protokol `2025-03-26`, HTTP JSON-RPC polos
  (tanpa auth, tanpa session header), berakhir di Cloudflare. **TLS berhasil dari mesin ini** —
  berbeda dari api.quran.com yang gagal (`SEC_E_UNTRUSTED_ROOT`).
- `tools/list` → 93 tool; nama asli turunan OpenAPI (mis. `get_ayah_by_number_or_number_in_surah_v1_ayah_reference_get`),
  **berbeda dari nama di tabel docs** — pipeline wajib men-pin nama hasil `tools/list`, bukan docs.
- `tools/call` `get_ayah … {reference:"1", editionIdentifier:"quran-uthmani"}` → data ayat valid kembali.

Kapabilitas yang relevan untuk produk (semua terverifikasi ada di `tools/list`):

| Kapabilitas | Tool (nama asli, disingkat) | Nilai untuk Ayatin |
|---|---|---|
| **Morfologi per kata** (root, kategori, `include_meaning`) | `get_ayah_morphological_analysis…`, `get_word_morphological_analysis…`, `search_words_by_arabic_root…` | Arti per kata → quest "tebak arti kata", gloss feedback T2, dasar mode hafalan v2 |
| **Surah per edisi + `words`** (1 call/surah) | `get_a_surah_by_number_and_edition…` (`words`, `includeTimings`) | Fetch word-data efisien (114 call, bukan 6.236); `includeTimings` → potensi highlight sinkron audio v2 |
| **Ayat mirip / mutashabihat** | `get_similar_ayahs_for_ayah_hafs…`, `get_mutashabihat_phrases_for_ayah_hafs…` | Distractor T3 yang membingungkan secara nyata (pedagogis kuat) |
| **Edisi terjemahan & audio** | `get_all_available_editions_by_language…`, `get_all_available_audio_editions_by_narrator…` | Cross-check terjemahan Kemenag (RULES § 7.7); kandidat qari tambahan |
| Word image, tajweed per lokasi, layout mushaf, sajdah, tema ayat | `get_word_image…`, `get_tajweed_rules_by_location…`, `layout_*`, `get_all_sajdas…`, `get_themes_for_ayah…` | Backlog v2 (visual/hafalan) — **tidak** untuk core loop Phase 2 |

## Keputusan

1. **MCP dipakai hanya sebagai sumber enrichment build-time** (di `scripts/build-content/`),
   bukan di runtime app. Alasan: v1 offline-first tanpa backend (PRD § 4.5, RULES § 8);
   dependensi jaringan runtime selain audio melanggar prinsip tersebut.
2. **equran.id tetap sumber kebenaran teks inti** (Arab + terjemahan, [ADR-002](ADR-002-sumber-konten-equran-id.md)).
   MCP **tidak pernah menimpa** teks inti; datanya aditif (file JSON baru terpisah).
3. Enrichment bersifat **fail-soft**: MCP down → pipeline tetap emit bundle inti; file enrichment
   jadi kosong/versi terakhir dari cache. Layanan gratis tanpa SLA tidak boleh memblokir rilis.
4. Semua output MCP melewati **validate → emit → checksum → atribusi** yang sama (RULES § 7);
   file enrichment ditandai `"source": "quranhub-mcp"` + atribusi di manifest.

## Rencana Implementasi (berurutan, tiap langkah = PR kecil)

**Langkah 1 — MCP client di pipeline** (`scripts/build-content/mcp-client.ts`)
- Klien JSON-RPC-over-HTTP minimal: `initialize` → `notifications/initialized` → `tools/call`
  (pola terverifikasi di probe di atas), URL dari env `MCP_URL`, timeout + retry ringan.
- Test unit memakai fake transport (tanpa jaringan di test).
- Script `content:mcp-check`: ping 3 tool kunci + bandingkan nama tool vs daftar ter-pin
  (deteksi dini bila server mengubah nama tool).

**Langkah 2 — Dataset word-data (morfologi) ter-fase**

> **Update Langkah 2 (2026-10-01) — hasil probe & revisi scope**:
> 1. **Glos per kata Indonesia TIDAK tersedia** di gateway (terverifikasi): tidak ada tipe
>    edisi `word_by_word` (43 edisi `versebyverse` semuanya bacaan Arab), dan
>    `id.indonesian` menolak parameter `words`. Arti per kata quest "tebak arti kata"
>    **ditunda** — butuh sumber lain/backlog, jangan dikarang (RULES § 7).
> 2. Morfologi MCP memberi akar + tag gramatika **bahasa Arab** per ayat (~2 dtk/ayat) —
>    layak hanya untuk Al-Fatihah (7 ayat), file `roots` di dalam bundle.
> 3. **Yang di-emit**: segmentasi kata per ayat (`quran-uthmani` + `words: true`, 1 call/surah)
>    → `word-data-juz30.json`: 38 surah, 571 ayat, 2.340 token dengan `pos/text/location`
>    (`surah:ayah:word`) + akar kata Al-Fatihah. Checksum & atribusi masuk manifest.
> 4. **Validator berbasis bukti** (cache, offline): 571/571 ayat cocok konsonan vs teks inti
>    equran.id setelah skeleton-fold keluarga alef/ya/hamza (digitalisasi beda konvensi
>    dagger-alef — 126 kasus varian ejaan semuanya terjelaskan); 94 ayat beda jumlah token
>    karena equran menjadikan marka kecil ( ە ) token sendiri → **warning**, bukan gagal;
>    3 ayat quran.com memecah kata beda (84:21, 96:19, 100:9) → warning juga.
> 5. **TLS intermiten**: `SEC_E_UNTRUSTED_ROOT` muncul kembali di mesin ini pertengahan
>    pekerjaan (sama seperti api.quran.com Phase 1). Mitigasi terbukti: semua fetch sudah
>    ter-cache di `.content-cache/` → validasi/emit lanjut offline tanpa hambatan.

**Langkah 3 — Integrasi core loop Phase 2 (SELESAI 2026-10-01, scope: T2 & T3)**
- `alignAyahWords()` di `core/content/word-data`: **teks tampilan tetap equran.id** (RULES § 7.1);
  dari word-data hanya diambil struktur (batas token) + `location`. 3 ayat beda pemecahan
  (84:21, 96:19, 100:9) → location null (fallback aman, tanpa alignment karangan).
- Generator T2 (Susun Ayat) & prompt T3 kini memakai kata ter-align — **chunk murni marka
  standalone tidak mungkin lagi** (sebelumnya whitespace-split equran bisa menghasilkan
  chunk " ە "). Tipe soal tetap T1–T4 (PRD § 5.4 tidak berubah).
- **Quest "tebak arti kata" DITUNDA** (PRD § 5.2/§ 5.5): glos per kata Indonesia tidak
  tersedia via QuranHub (lihat Update Langkah 2 #1) — jangan dibangun dari data lain tanpa
  lisensi jelas. Bila modul `quests.ts` dibangun, gunakan varian non-glos (mis. "selesaikan
  N lesson", "buka surah baru"). **Sumber pengganti sudah diteliti & disetujui**: QUL
  "Indonesian wbw translation" — lihat [ADR-006](ADR-006-sumber-glos-per-kata-qul.md).
- Ukuran: `word-data-juz30.json` = 135,6 KB raw / **20,4 KB gzip** — dampak diabaikan vs
  budget 8 MB gzip ([ADR-004](ADR-004-bundle-konten-penuh.md)).

**Langkah 4 — Backlog (jangan sekarang)**
- Distractor T3 dari mutashabihat; word-image untuk render potongan T2; tajweed; layout
  mushaf presisi; highlight audio via `includeTimings`; perluasan word-data ke 114 surah penuh.
- Semua butuh pengukuran ukuran bundle + review adab konten (RULES § 7.4: ayat tidak
  dianotasi di dalam blok ayat).

## Konsekuensi

- (+) Data yang mustahil didapat dari equran.id (arti per kata, ayat mirip) masuk tanpa
  mengubah sumber kebenaran inti; pipeline tetap satu pola `fetch → validate → emit`.
- (+) Terjangkau dari environment ini (TLS terverifikasi), tanpa API key.
- (−) Ketergantungan layanan pihak ketiga tanpa SLA → dipagari fail-soft + cache + checksum.
- (−) Nama tool bisa berubah tanpa pengumuman → `content:mcp-check` sebagai smoke test; nama
  ter-pin di satu modul `mcp-tools.ts`.
- (−) Lisensi data quran.com di balik MCP perlu diverifikasi & diatribusi sebelum rilis publik
  (RULES § 7.6, § 7.8) — masuk checklist layar "Tentang & Sumber Konten" Phase 3.
