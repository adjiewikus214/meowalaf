/**
 * Test features/gamification/achievement-store — jalur pembayaran XP achievement
 * ke xp_ledger. Store ini yang paling rawan salah karena tiga hal yang tidak
 * kelihatan dari UI: XP dobel saat achievement kebuka dua kali, XP hilang saat
 * app restart, dan XP tetap bayar padahal tidak ada yang terbuka.
 *
 * Store lesson & reading di-mock karena yang diuji hanya sisi achievement —
 * bonus XP-nya memang datang dari `addBonusXp`, jadi justru itu yang direkam.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  streakCount: 0,
  openedSurahIds: [] as number[],
  bonusCalls: [] as { amount: number; reason: string }[],
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

vi.mock("@/core/progress/lesson-store", () => ({
  useProgressEventsStore: {
    getState: () => ({
      streakCount: h.streakCount,
      addBonusXp: (amount: number, reason: string) => {
        h.bonusCalls.push({ amount, reason });
      },
    }),
  },
}));

vi.mock("@/core/progress/reading", () => ({
  useReadingStore: {
    getState: () => ({ openedSurahIds: h.openedSurahIds }),
  },
}));

const { ACHIEVEMENTS } = await import("./achievements");
const { useAchievementStore } = await import("./achievement-store");

beforeEach(() => {
  h.streakCount = 0;
  h.openedSurahIds = [];
  h.bonusCalls.length = 0;
  useAchievementStore.getState().resetForTest();
});

describe("achievement membayar XP ke xp_ledger", () => {
  it("lesson pertama sempurna → dua achievement, dua entri ledger", () => {
    const fresh = useAchievementStore.getState().onLessonCompleted({ correctT4: 0, perfect: true });
    expect(fresh).toEqual(["first-step", "perfect"]);
    expect(h.bonusCalls).toEqual([
      { amount: 10, reason: "achievement:first-step" },
      { amount: 15, reason: "achievement:perfect" },
    ]);
  });

  it("lesson kedua tidak membayar achievement yang sudah terbuka (unlock-once)", () => {
    const store = useAchievementStore.getState();
    store.onLessonCompleted({ correctT4: 0, perfect: true });
    h.bonusCalls.length = 0;

    const fresh = store.onLessonCompleted({ correctT4: 0, perfect: true });
    expect(fresh).toEqual([]);
    expect(h.bonusCalls).toEqual([]);
  });

  it("lesson biasa tanpa unlock → nol panggilan XP (jangan bayar hantu)", () => {
    const store = useAchievementStore.getState();
    store.onLessonCompleted({ correctT4: 0, perfect: true }); // first-step + perfect
    h.bonusCalls.length = 0;

    const fresh = store.onLessonCompleted({ correctT4: 0, perfect: false });
    expect(fresh).toEqual([]);
    expect(h.bonusCalls).toEqual([]);
  });

  it("streak naik ke 3 → Starter Streak dibayar, achievement lain tetap diam", () => {
    const store = useAchievementStore.getState();
    store.onLessonCompleted({ correctT4: 0, perfect: false }); // first-step
    h.bonusCalls.length = 0;

    h.streakCount = 3;
    const fresh = store.onLessonCompleted({ correctT4: 0, perfect: false });
    expect(fresh).toEqual(["starter-streak"]);
    expect(h.bonusCalls).toEqual([{ amount: 25, reason: "achievement:starter-streak" }]);
  });

  it("buka surat ke-5 → Juz 30 Explorer dibayar lewat onSurahOpened", () => {
    h.openedSurahIds = [1, 2, 3, 4, 5];
    const fresh = useAchievementStore.getState().onSurahOpened();
    expect(fresh).toEqual(["juz30-explorer"]);
    expect(h.bonusCalls).toEqual([{ amount: 20, reason: "achievement:juz30-explorer" }]);
  });

  it("surat dibuka lagi → achievement yang sudah terbuka tidak dibayar dua kali", () => {
    h.openedSurahIds = [1, 2, 3, 4, 5];
    const store = useAchievementStore.getState();
    store.onSurahOpened();
    h.bonusCalls.length = 0;

    expect(store.onSurahOpened()).toEqual([]);
    expect(h.bonusCalls).toEqual([]);
  });

  it("tap dzikir ke-33 → Dhikr Starter dibayar sekali; tap berikutnya diam", () => {
    const store = useAchievementStore.getState();
    expect(store.onDzikirTap(32)).toEqual([]);
    h.bonusCalls.length = 0;

    expect(useAchievementStore.getState().onDzikirTap()).toEqual(["dzikir-starter"]);
    expect(h.bonusCalls).toEqual([{ amount: 10, reason: "achievement:dzikir-starter" }]);

    h.bonusCalls.length = 0;
    expect(useAchievementStore.getState().onDzikirTap()).toEqual([]);
    expect(h.bonusCalls).toEqual([]);
  });

  it("delta dzikir 0 / negatif tidak mengevaluasi apa pun", () => {
    const store = useAchievementStore.getState();
    expect(store.onDzikirTap(0)).toEqual([]);
    expect(useAchievementStore.getState().onDzikirTap(-5)).toEqual([]);
    expect(useAchievementStore.getState().stats.dzikirTotal).toBe(0);
    expect(h.bonusCalls).toEqual([]);
  });

  it("semua statistik tembus → 8 achievement, total XP persis jumlah definisi", () => {
    h.streakCount = 7;
    h.openedSurahIds = [1, 2, 3, 4, 5];

    const dzikirFresh = useAchievementStore.getState().onDzikirTap(1000);
    const fresh = useAchievementStore
      .getState()
      .onLessonCompleted({ correctT4: 10, perfect: true });
    expect([...dzikirFresh, ...fresh].sort()).toEqual([...ACHIEVEMENTS.map((def) => def.id)].sort());

    const total = h.bonusCalls.reduce((sum, call) => sum + call.amount, 0);
    expect(total).toBe(ACHIEVEMENTS.reduce((sum, def) => sum + def.xp, 0));
    // Satu entri ledger per achievement, bukan satu entri jumlah.
    expect(h.bonusCalls).toHaveLength(ACHIEVEMENTS.length);
  });

  it("setiap entri punya alasan achievement yang unik (bisa ditelusuri nanti)", () => {
    h.streakCount = 7;
    h.openedSurahIds = [1, 2, 3, 4, 5];
    useAchievementStore.getState().onLessonCompleted({ correctT4: 10, perfect: true });

    const reasons = h.bonusCalls.map((call) => call.reason);
    expect(new Set(reasons).size).toBe(reasons.length);
    for (const reason of reasons) expect(reason.startsWith("achievement:")).toBe(true);
  });

  it("resetAll (hapus semua data) → achievement bisa terbuka lagi dan XP dibayar ulang", () => {
    const store = useAchievementStore.getState();
    store.onLessonCompleted({ correctT4: 0, perfect: true });
    h.bonusCalls.length = 0;

    store.resetAll();
    const fresh = store.onLessonCompleted({ correctT4: 0, perfect: true });
    expect(fresh).toEqual(["first-step", "perfect"]);
    expect(h.bonusCalls).toHaveLength(2);
  });

  it("lastUnlocked untuk toast Terisi hanya kalau ada yang benar-benar terbuka", () => {
    useAchievementStore.getState().onLessonCompleted({ correctT4: 0, perfect: true });
    // Baca dari getState() lagi: snapshot sebelum panggilan masih punya nilai lama.
    expect(useAchievementStore.getState().lastUnlocked).toEqual(["first-step", "perfect"]);

    useAchievementStore.getState().clearLastUnlocked();
    expect(useAchievementStore.getState().lastUnlocked).toEqual([]);
    expect(h.bonusCalls).toHaveLength(2); // clearLastUnlocked tidak boleh membatalkan XP
  });
});
