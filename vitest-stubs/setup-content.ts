/**
 * Setup global vitest.
 *
 * Modul teks Quran didaftarkan sebagai sumber ayat saat dimuat (lihat
 * `src/core/content/ayah-source.ts`). Di app, itu terjadi karena layar lesson/mushaf
 * memanggil `ensureQuranText()`. Di test, modul pure (generator soal, session) tidak
 * pernah memanggil itu -- jadi mendaftarkannya di sini, persis seperti kondisi app
 * setelah teks selesai dimuat. Tanpa ini, `generateLessonQuestions` akan mendapat
 * array ayat kosong dan test lulus dengan hasil yang menipu.
 */
import "@/core/content/loader";