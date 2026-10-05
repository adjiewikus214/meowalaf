# ADR-011 — Tafsir: tidak ada sumber Indonesia yang aman untuk komersial; hanya tafsir Arab klasik Quranpedia yang diterima

> **Status**: Diterima (sebagian — menolak tafsir Indonesia, menerima jalur sempit) ·
> **Tanggal**: 2026-10-05 · **Konteks**: Phase 1/2 pipeline konten, Area 2
> [FEATURE-PLAN.md](../FEATURE-PLAN.md) · Prasyarat: [ADR-002](ADR-002-sumber-konten-equran-id.md)
> (sumber equran.id), [ADR-004](ADR-004-bundle-konten-penuh.md) (bundle offline penuh).
> Investigasi sumber dilakukan 2026-10-05; hasilnya dicatat di sini karena ADR-010
> (jadwal salat) menunggu ADR ini sejak penyebutan "lisensi tafsir → ADR terpisah".

## Konteks

Tafsir adalah satu-satunya bagian bernilai tinggi dari Fase B yang tertahan oleh
pertanyaan lisensi, bukan oleh teknologi. Bundle app ini **offline penuh dan
dikirim ke pengguna** (ADR-004), dan produknya **komersial**. Dua fakta itu
menyaring hampir semua sumber populer sebelum sempat mempertimbangkan kualitas
teksnya.

Yang dicari: tafsir berbahasa Indonesia (target pasar) dengan lisensi yang
mengizinkan redistribusi ter-bundel, tanpa syarat yang bertentangan dengan
bundle statis.

## Investigasi (hasil per sumber)

| Sumber | Temuan | Verdict |
|---|---|---|
| **Tanzil** | Lisensi non-commercial | **Tolak** — produk komersial |
| **QuranEnc** | 7 syarat; salah satunya wajib selalu memakai versi terbaru | **Tolak** — bundle statis tidak bisa diperbarui otomatis; syarat "versi terbaru" mustahil dipenuhi oleh artefak yang di-emit lalu dikunci checksum |
| **QUL / Tarteel** | Lisensi per-resource; situs live 404 / DNS mati; hanya arsip Wayback 16–17 Apr 2026 yang tersisa, tanpa teks lisensi di dalamnya | **Tolak** — tidak ada teks lisensi yang bisa diverifikasi hari ini. Tidak ada sumber = tidak ada izin |
| **equran.id (ToS §5/§7)** | Terjemahan & tafsir dinyatakan ber-hak cipta; "data tidak boleh dijual" | **Tolak untuk tafsir** — bertabrakan dengan model app. **Perlu adendum ADR-002**: ToS itu mengikat konten *tafsir/terjemahan tambahan*, bukan teks Al-Quran & terjemahan Kemenag open data yang sudah terlanjur dipakai. Klausul "tidak boleh dijual" harus diperiksa terhadap monetisasi app sebelum rilis |
| **Repo GitHub (MIT)** | Banyak tafsir/mudah ada di GitHub dengan lisensi MIT | **Tolak** — MIT melindungi *kode*, bukan *konten* teks. Lisensi repo tidak memindahkan hak cipta teks ke kita |
| **Quranpedia** | Tafsir Arab klasik (Jalalain dll.) — syarat: kredit + sebut versi saat republish; morfologi bawaan = GPL (corpus.quran.com) | **Terima, dengan 2 syarat**: (a) kredit + versi dicatat, (b) data morfologi GPL **tidak ikut dibundle** |
| **Terjemahan public domain** | Daftar lengkap tersedia (karya penerjemah yang wafat >100 tahun) | **Terima** sebagai opsi cadangan terjemahan |

## Keputusan

1. **Tafsir berbahasa Indonesia: DITOLAK untuk rilis.** Bukan karena tidak
   dicari, tapi karena tidak ada satu pun sumber yang lisensinya mengizinkan
   redistribusi ter-bundel komersial. Ini keputusan *absennya* opsi, bukan
   penilaian kualitas.
2. **Satu-satunya jalur yang diterima: tafsir Arab klasik via Quranpedia**,
   dengan syarat kredit + versi, dan **tanpa morfologi GPL**. Kalau ini tidak
   bernilai cukup untuk user, Fase B jalan tanpa tafsir — Asmaul Husna tetap
   berjalan sendiri (lihat FEATURE-PLAN §Fase B).
3. **ADR-002 perlu adendum** sebelum rilis: telusuri ToS equran.id §5/§7
   terhadap terjemahan Kemenag yang sudah dipakai. Jika ToS itu juga mengikat
   terjemahan, bundle sekarang punya masalah — dan itu temuan yang lebih urgensi
   daripada tafsir.
4. **Tidak ada riset ulang otomatis.** Kalau nanti muncul sumber baru, syarat
   yang harus dipenuhi tertulis di bawah; tidak perlu membuka ulang seluruh
   daftar.

## Syarat minimum sumber tafsir (untuk evaluasi mendatang)

- Lisensi mengizinkan **redistribusi komersial dalam artefak statis**.
- Tidak ada syarat "selalu versi terbaru" atau pembaruan wajib — bundle terkunci.
- Teks lisensi bisa diverifikasi dari sumber primer **yang masih hidup hari ini** (bukan hanya arsip).
- Kredit/atribusi bisa dipenuhi di layar "Tentang & Sumber Konten".

## Konsekuensi

- (+) Nol risiko lisensi tafsir di rilis; tidak ada yang perlu ditarik setelah terlanjur bundle.
- (+) Kriteria evaluasi terdokumentasi — sumber berikutnya tinggal dicek, bukan diteliti dari nol.
- (+) Morfologi GPL dicegah masuk bundle sebelum sempat terlanjur.
- (−) Fase B kehilangan daya tarik utamanya: tafsir. Fitur tetap bisa jalan tanpa itu.
- (−) ADR-002 berdiri di atas asumsi yang belum diverifikasi ulang terhadap ToS terkini — adendum wajib sebelum rilis, bukan nanti.
