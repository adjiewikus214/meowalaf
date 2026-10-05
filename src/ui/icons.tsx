/**
 * Owner: ui. SATU-SATUNYA titik import ikon di seluruh app.
 *
 * Kenapa tidak boleh `import { Ionicons } from "@expo/vector-icons"` langsung di layar:
 * entry point paket itu (`build/IconsLazy.js`) mendaftarkan SEMUA 19 family ikon, dan
 * tiap family menarik file .ttf-nya sendiri ke dalam bundle. Diukur 3 Okt 2026 di dist/:
 * 18 font ikon = ~1,48 MB gzip yang tidak pernah dipakai — app ini cuma memakai 4 glyph
 * Ionicons (home, book, person, play/pause/hourglass/arrow-back). Deep import
 * `@expo/vector-icons/Ionicons` hanya menarik `build/Ionicons.js` + satu .ttf.
 *
 * Aturan: kalau suatu layar butuh family ikon lain, tambahkan di sini SECARA SADAR
 * (dan sadari ukuran font-nya), jangan meng-import langsung dari paket di layar itu.
 */
import IoniconsBase from "@expo/vector-icons/Ionicons";

/**
 * `font-ionicons` wajib ada karena override body font di `global.css` memakai
 * `!important` (lihat komentar blok itu). Tanpa kelas ini, glyph ikon ikut
 * dirender dengan Poppins: karakternya di Private Use Area, jadi yang tampil
 * kotak KOSONG — dan itu kelihatannya "ikon tidak ada", bukan "font tidak cocok".
 * Tidak ketahuan di QA karena ikon yang bocor cuma chevron kecil di satu baris.
 */
type IoniconsProps = React.ComponentProps<typeof IoniconsBase>;

export function Ionicons({ className, ...props }: IoniconsProps) {
  return <IoniconsBase className={className === undefined ? "font-ionicons" : `font-ionicons ${className}`} {...props} />;
}