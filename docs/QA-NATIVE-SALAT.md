# QA Native — Jadwal Salat, Kiblat, Pengingat (ADR-010)

Checklist untuk **device fisik**. Web sudah di-QA (lihat ROADMAP); yang belum
terbukti di sini adalah API yang hanya ada di HP: GPS, notifikasi lokal, dan
aplikasi kiblat. Sebelum rilis, centang semua item di minimal **1 Android +
1 iOS**. Alat bantu: `adb logcat` (Android) / Console Xcode (iOS), dan aplikasi
kompas/azan sebagai pembanding independen.

Prinsip dari ADR-010: **kiblat = sudut dari koordinat, tanpa kompas sensor**.
Item kompas TIDAK ada di checklist ini karena fiturnya memang tidak dibangun —
arah ditunjukkan sebagai angka derajat yang diverifikasi lewat pembanding
eksternal, bukan lewat sensor HP.

---

## 0. Persiapan (sekali)

- [ ] Build native terakhir (`npx expo run:android` / `npx expo run:ios`) dari kode yang sama dengan gate terakhir: tsc 0, ESLint bersih, semua test lulus.
- [ ] Catat device: model, OS, dan **zona waktu device** (mis. WIB padahal tes lokasi Papua — sengaja, lihat N4).
- [ ] Data tes dicatat: kota terpilih, waktu salat yang tampil, notifikasi yang diterima — dibandingkan dengan tabel referensi Aladhan `method=20` di ROADMAP.

## 1. GPS & lokasi

- [ ] **T1 — Izin pertama**: buka layar salat → pakai lokasi perangkat → dialog izin muncul → *izinkan* → label berubah jadi "sekitar [kota]" + koordinat/jarak tampil.
- [ ] **T2 — Izin ditolak**: reset izin (setelan app), ulangi → app **tidak crash**, kembali ke kota manual, pesan jelas, tombol kota tetap bisa dipilih.
- [ ] **T3 — Izin sekali pakai / while-using**: iOS "Allow While Using App" cukup (adapter hanya butuh foreground). Kalau hanya "Allow Once", fix tetap dipakai sesi itu.
- [ ] **T4 — Zona waktu benar**: fix GPS di kota lain mengubah jam salat sesuai zona **kota terdekat**, bukan zona device (device WIB + lokasi Makassar → jadwal WITA, tanpa jaringan).
- [ ] **T5 — Koordinat aneh ditolak**: device belum kunci GPS / mode pesawat → outcome `failed`/`denied` → fallback kota, tidak pernah jadwal di (0,0).
- [ ] **T6 — Persist**: pilih GPS → kill app → buka lagi → sumber lokasi & jadwal masih GPS (AsyncStorage `ayatin-prayer-location-v1`).
- [ ] **T7 — Balik ke kota manual**: pilih kota setelah GPS → sumber jadi kota, jadwal ikut kota, fix GPS lama tidak dipakai lagi.
- [ ] **T8 — Tanpa jaringan**: mode pesawat setelah fix → layar salat tetap tampil penuh (hitungan lokal, tidak ada panggilan API).

## 2. Kiblat (tanpa kompas)

- [ ] **T1 — Angka konsisten**: kiblat per kota cocok ±0,01° dengan nilai acuan (Jakarta 295,15°; Banda Aceh 292,17°; Makassar 292,48°; Jayapura 291,33°).
- [ ] **T2 — Dengan alat bantu**: aplikasi kompas pihak ketiga di device yang sama, di lokasi yang sama, arah Ka'bah → selisih ≤1°. Catat device + lokasi.
- [ ] **T3 — Jarak tampil**: jarak great-circle ke Ka'bah masuk akal (Jakarta ±9.100 km, Jayapura ±11.235 km).
- [ ] **T4 — Sablon jujur**: disclaimer "alat bantu, bukan pengganti arah masjid" terbaca di layar — kalau tidak, itu bug dokumen, bukan kosmetik.

## 3. Notifikasi lima waktu

- [ ] **T1 — Izin**: aktifkan pengingat → dialog izin OS muncul → *izinkan*. Tolak → UI menunjukkan tidak aktif, tanpa jadwal diam-diam.
- [ ] **T2 — Jumlah & isi**: di pengaturan notifikasi OS hanya ada **5 notifikasi** salat (channel Android "Pengingat salat"), judul sesuai waktu (Subuh/Dzuhur/…), jam = jam salat di layar.
- [ ] **T3 — Nyala beneran**: tunggu 1–2 waktu salat (atau set jam device ke dekat waktu berikutnya, lalu kembalikan) → notifikasi masuk dengan suara/vibrasi saat waktu itu juga.
- [ ] **T4 — Idempoten**: buka/buka lagi layar salat, ganti kota bolak-balik, restart app → jumlah notifikasi **tetap 5**, tidak menumpuk (signature anti-churn).
- [ ] **T5 — Matikan = bersih**: toggle pengingat mati → kelima notifikasi hilang dari daftar OS.
- [ ] **T6 — Latar belakang**: app di-kill dari recent apps → notifikasi tetap datang (jadwal disimpan OS, bukan timer in-app).
- [ ] **T7 — Nol notifikasi palsu**: kalau semua request tidak valid, hasilnya `cancelled` — tidak ada status "aktif" tanpa jadwal OS.

## 4. Interaksi & putaran

- [ ] **T1 — Ganti kota**: jadwal, hitung mundur, kiblat, dan 5 notifikasi ikut berubah bersamaan; tidak ada sisa jadwal kota lama.
- [ ] **T2 — Lewat Isya**: hitung mundur rollover ke Subuh besok (+1440), bukan angka negatif.
- [ ] **T3 — Restart bolak-balik**: force-stop 3× berturut-turut → tetap 5 notifikasi, tidak duplikat.
- [ ] **T4 — "Hapus semua data" (Profil)**: store salat ikut ter-reset ke Jakarta/kota-off/notif-off **dan** notifikasi OS ikut terbatalkan. Kalau OS masih menyimpan jadwal setelah wipe, catat sebagai temuan.

## 5. Batas yang diakui terbuka

- [ ] **N1 — Akurasi GPS**: uji di gedung/ruang dalam (akurasi ratusan meter) → waktu salat tetap beda ≤2 menit (yakin karena waktu salat sangat peka terhadap lintang).
- [ ] **N2 — Device OEM agresif** (Xiaomi/OPPO/Samsung): notifikasi tidak dibunuh mode hemat baterai; kalau perlu, catat perlu dibuka sekali setelah boot.
- [ ] **N3 — Kesalahan zona device**: device diset zona salah → zona ikut kota terdekat (T4 §1), bukan jam device.
- [ ] **N4 — Multi-zona dalam satu kota besar**: fix di kota satelit di luar 38 ibu kota → tetap memakai ibu kota terdekat; selisih jam salat dicatat (harus tetap ±1–2 menit).
- [ ] **N5 — Notifikasi vs zona beda**: perangkat di zona berbeda dari kota terpilih (user WIB pilih Jayapura) → catat jam notifikasi di panel notifikasi; kalau meleset dari jam layar, temuan nyata untuk perbaikan (trigger DAILY memakai jam device).

---

**Lolos** = semua item tercentang di 2 device atau temuan punya issue+owner.
Belum lolos = **jangan** sebut fitur "sudah jalan" di device — formula di ROADMAP/About tetap menyebut jadwal resmi masjid/Kemenag sebagai acuan.
