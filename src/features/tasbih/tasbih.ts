/**
 * Owner: features/tasbih. Aturan tasbih digital (PRD § 5.5) — PURE & data-only:
 * tanpa React/storage, jadi bisa dites tanpa DB. Store di `tasbih-store.ts`
 * hanya membungkus state + imbalan XP + streak.
 *
 * Kenapa hitungannya hidup di AsyncStorage, bukan SQLite: tap tasbih bukan
 * peristiwa belajar, dan angkanya reset tiap tengah malam WIB — tidak ada
 * statistik yang perlu direkonstruksi dari log (beda dari lesson_log). Yang
 * MASUK `xp_ledger` cuma hadiah XP-nya, dan itu append-only lewat
 * `addBonusXp` — jadi XP tidak hilang saat hydrate (reconcile menjumlahkannya).
 *
 * Hadiah dibatasi SEKALI per preset per hari (bukan per putaran): tanpa batas
 * itu, memutar tasbih 33x berulang-ulang jadi ladang XP tanpa akhir — angka
 * yang naik dari ibadah tidak boleh dirancang sebagai celah eksploit.
 */

import type { TranslationKey } from "@/core/i18n";

/** Hadiah XP saat satu preset menyelesaikan putaran pertamanya hari ini. */
export const TASBIH_XP_PER_PRESET = 5;
/** Bonus saat total dzikir hari ini mencapai target harian — sekali per hari. */
export const TASBIH_XP_TARGET = 10;
/** Target harian bawaan: 100 dzikir (umum: 33 tasbih + 33 tahmid + 34 takbir). */
export const TASBIH_DEFAULT_TARGET = 100;
export const TASBIH_MIN_TARGET = 1;
export const TASBIH_MAX_TARGET = 10000;

export type TasbihPresetId =
  | "subhanallah"
  | "alhamdulillah"
  | "allahuakbar"
  | "astaghfirullah"
  | "salat";

export type TasbihPreset = {
  id: TasbihPresetId;
  /** Teks dzikir — TIDAK diedit pipeline apa pun, jadi tidak ada salinan menyimpang. */
  arabic: string;
  /** Kunci i18n, bukan string siap tampil (core/data tidak tahu bahasa). */
  labelKey: TranslationKey;
  /** Target tap satu putaran (33/34/100). */
  goal: number;
};

/**
 * Preset dzikir yang paling umum dipakai. Urutan mengikuti kebiasaan setelah
 * salat: tasbih, tahmid, takbir (33/33/34 = Tasbih Fatimah), lalu istighfar
 * dan salawat. Teks Arabnya adalah lafaz dzikir standar — bukan ayat, jadi
 * tidak ada nomor ayat/surah yang perlu diatribusikan.
 */
export const TASBIH_PRESETS: readonly TasbihPreset[] = [
  { id: "subhanallah", arabic: "سُبْحَانَ اللَّهِ", labelKey: "tasbih.subhanallah", goal: 33 },
  { id: "alhamdulillah", arabic: "الْحَمْدُ لِلَّهِ", labelKey: "tasbih.alhamdulillah", goal: 33 },
  { id: "allahuakbar", arabic: "اللَّهُ أَكْبَرُ", labelKey: "tasbih.allahuakbar", goal: 34 },
  { id: "astaghfirullah", arabic: "أَسْتَغْفِرُ اللَّهَ", labelKey: "tasbih.astaghfirullah", goal: 100 },
  {
    id: "salat",
    arabic: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ",
    labelKey: "tasbih.salat",
    goal: 100,
  },
];

export function getTasbihPreset(id: TasbihPresetId): TasbihPreset | undefined {
  return TASBIH_PRESETS.find((preset) => preset.id === id);
}

/** State tasbih SATU hari WIB (roll tengah malam, sama seperti quest). */
/** Target harian yang dipakai user (lihat TASBIH_*_TARGET untuk batasnya). */
export type TasbihDayState = {
  day: string;
  /** Total tap berjalan per preset hari ini (reset tiap ganti hari). */
  counts: Partial<Record<TasbihPresetId, number>>;
  /** Target total dzikir per hari; disimpan supaya pilihan user bertahan. */
  target: number;
  /** Preset yang hadiah putarannya sudah dibayar hari ini (sekali per hari). */
  paidPresetIds: readonly TasbihPresetId[];
  /** Bonus target harian sudah dibayar hari ini. */
  targetPaid: boolean;
};

function clampTarget(target: number): number {
  if (!Number.isFinite(target)) return TASBIH_DEFAULT_TARGET;
  return Math.min(TASBIH_MAX_TARGET, Math.max(TASBIH_MIN_TARGET, Math.round(target)));
}

export function initialTasbihDay(day: string, target = TASBIH_DEFAULT_TARGET): TasbihDayState {
  return { day, counts: {}, target: clampTarget(target), paidPresetIds: [], targetPaid: false };
}

/**
 * Ubah target harian TANPA menyentuh hitungan hari ini — mengganti target
 * tidak boleh menghapus dzikir yang sudah dikerjakan (itu kehilangan data di
 * tangan user). Bonus target tetap dibayar saat tap berikutnya, bukan saat
 * target diubah: kalau dibayar saat diubah, menurunkan target ke 1 di detik
 * pertama langsung jadi celah XP gratis.
 */
export function withTarget(state: TasbihDayState, target: number): TasbihDayState {
  return { ...state, target: clampTarget(target) };
}

/** Hari sama → state apa adanya (idempoten); ganti hari → hitungan dari nol, target dibawa. */
export function rollTasbihDay(state: TasbihDayState, day: string): TasbihDayState {
  return state.day === day ? state : initialTasbihDay(day, state.target);
}

export function tasbihTotal(state: TasbihDayState): number {
  return totalOf(state.counts);
}

/** Progres putaran berjalan satu preset (0..goal) — untuk UI, bukan hadiah. */
export function presetRoundProgress(state: TasbihDayState, preset: TasbihPreset): number {
  const count = state.counts[preset.id] ?? 0;
  return count % preset.goal;
}

export type TapResult = {
  state: TasbihDayState;
  /** XP yang baru diperoleh pada tap ini (0 kalau sudah pernah dibayar). */
  xpEarned: number;
  /** Preset yang putaran pertamanya baru saja dibayar (untuk toast), null kalau bukan. */
  paidPresetId: TasbihPresetId | null;
  /** Target harian baru saja tercapai pada tap ini (streak + bonus). */
  targetReachedNow: boolean;
};

/**
 * Terapkan satu tap ke state harian — PURE & idempoten terhadap pembayaran:
 * memanggil dengan state hasil sebelumnya tidak membayar XP dua kali.
 */
export function applyTap(state: TasbihDayState, day: string, preset: TasbihPreset): TapResult {
  const rolled = rollTasbihDay(state, day);
  const count = (rolled.counts[preset.id] ?? 0) + 1;
  const counts: Partial<Record<TasbihPresetId, number>> = { ...rolled.counts, [preset.id]: count };

  // Putaran selesai saat count mencapai kelipatan goal; hadiahnya tetap sekali
  // per hari per preset (lihat catatan di atas).
  const roundDone = count >= preset.goal && count % preset.goal === 0;
  const alreadyPaid = rolled.paidPresetIds.includes(preset.id);
  const paidPresetId = roundDone && !alreadyPaid ? preset.id : null;
  const paidPresetIds = paidPresetId === null ? rolled.paidPresetIds : [...rolled.paidPresetIds, paidPresetId];

  const targetReachedNow = totalOf(counts) >= rolled.target && !rolled.targetPaid;

  return {
    state: {
      ...rolled,
      counts,
      paidPresetIds,
      targetPaid: rolled.targetPaid || targetReachedNow,
    },
    xpEarned: (paidPresetId === null ? 0 : TASBIH_XP_PER_PRESET) + (targetReachedNow ? TASBIH_XP_TARGET : 0),
    paidPresetId,
    targetReachedNow,
  };
}

function totalOf(counts: Partial<Record<TasbihPresetId, number>>): number {
  let total = 0;
  for (const count of Object.values(counts)) total += count ?? 0;
  return total;
}
