/**
 * Owner: features/gamification/components. Host toast achievement — satu-satunya
 * tempat yang membaca `lastUnlocked` lalu menerjemahkannya jadi UI. Dipasang di
 * root layout supaya toast muncul di layar mana pun achievement terbuka (lesson
 * hasil ATAU membuka surat), tidak cuma di satu screen.
 *
 * Antrean: satu sesi sering membuka >1 achievement sekaligus (mis. lesson pertama
 * sempurna → first-step + perfect). Menampilkan satu-satu berurutan jauh lebih
 * enak dibaca daripada menumpuk; jadi ada indeks + `clearLastUnlocked()` setelah
 * antrean habis. Toast tidak dipersist (sengaja) sehingga reload di tengah antrean
 * tidak memunculkan toast basi.
 */
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/core/i18n/hooks";

import { AchievementToast } from "@/ui/components";

import { useAchievementStore } from "../achievement-store";
import { formatAchievementXp, getAchievement } from "../achievements";

export function AchievementToastHost() {
  const { t } = useT();
  const lastUnlocked = useAchievementStore((s) => s.lastUnlocked);
  const clearLastUnlocked = useAchievementStore((s) => s.clearLastUnlocked);
  const [index, setIndex] = useState(0);

  // Unlock baru masuk (lastUnlocked berubah identitas) → antrean mulai dari depan.
  useEffect(() => {
    setIndex(0);
  }, [lastUnlocked]);

  const current = lastUnlocked[index];
  const def = current === undefined ? undefined : getAchievement(current);

  const handleDismiss = useCallback(() => {
    setIndex((previous) => {
      const next = previous + 1;
      // Antrean habis → bersihkan supaya toast tidak muncul lagi setelah reload.
      if (next >= lastUnlocked.length) clearLastUnlocked();
      return next;
    });
  }, [lastUnlocked.length, clearLastUnlocked]);

  return (
    // `key` wajib: AchievementToast menjadwalkan timer hide dari `visible`. Kalau
    // cuma ganti isi, `visible` tetap true → effect tidak jalan ulang → toast
    // kedua tampil tapi tidak pernah kedismiss (antrean macet di nomor 2).
    // Remount per item = tiap achievement punya toast + timer sendiri.
    <AchievementToast
      key={current ?? "kosong"}
      visible={def !== undefined}
      emoji={def?.emoji ?? ""}
      title={def?.title ?? ""}
      description={def ? t(def.descriptionKey) : ""}
      reward={current === undefined ? undefined : formatAchievementXp(current)}
      onDismiss={handleDismiss}
    />
  );
}