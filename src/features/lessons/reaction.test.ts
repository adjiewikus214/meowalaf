import { describe, expect, it } from "vitest";

import { en, id } from "@/core/i18n";
import type { TranslationKey } from "@/core/i18n";

import { ABU_CHEER_KEYS, ABU_ENCOURAGE_KEYS, ABU_RETRY_KEY, lessonReaction } from "./reaction";

const base = { position: 1, isRetry: false, hintUsed: false };

describe("reaksi Abu di latihan", () => {
  it("jawaban benar → Abu bersorak, bukan sekadar diam", () => {
    expect(lessonReaction({ ...base, verdict: "correct" }).mood).toBe("cheer");
  });

  it("benar dengan bantuan hint tetap dihargai (mood happy)", () => {
    const withHint = lessonReaction({ ...base, verdict: "correct", hintUsed: true });
    expect(withHint.mood).toBe("happy");
    // Kalimatnya tetap dari keluarga sorak — memakai hint bukan pelanggaran.
    expect(ABU_CHEER_KEYS).toContain(withHint.lineKey);
  });

  it("jawaban salah → Abu menemani (encourage), tidak pernah pesta", () => {
    expect(lessonReaction({ ...base, verdict: "wrong" }).mood).toBe("encourage");
  });

  it("soal ulangan memakai kalimat khusus — tidak mengulang nada soal baru", () => {
    const retry = lessonReaction({ ...base, verdict: "wrong", isRetry: true });
    expect(retry.lineKey).toBe(ABU_RETRY_KEY);
    // Mood tetap menemani: yang berubah hanya kalimatnya.
    expect(retry.mood).toBe("encourage");
  });

  it("dua soal berturut-turut tidak pernah memberi kalimat yang sama", () => {
    const line = (position: number) => lessonReaction({ ...base, verdict: "wrong", position }).lineKey;
    expect(line(1)).not.toBe(line(2));
    expect(line(2)).not.toBe(line(3));
    // Tiga soal pertama memakai ketiga kalimat, tidak ada yang dobel.
    expect(new Set([line(1), line(2), line(3)]).size).toBe(3);
  });

  it("rotasi tetap benar untuk posisi yang tidak masuk akal (deep-link/junk)", () => {
    // Index negatif atau nol tidak boleh menghasilkan undefined — pernah jadi
    // sumber bug umum pada aritmetika modulo di repo ini.
    for (const position of [0, -3, 999]) {
      const reaction = lessonReaction({ ...base, verdict: "wrong", position });
      expect(typeof reaction.lineKey).toBe("string");
      expect(ABU_ENCOURAGE_KEYS).toContain(reaction.lineKey);
    }
  });

  it("semua kalimat Abu ada di kedua kamus (id & en)", () => {
    const keys: TranslationKey[] = [...ABU_CHEER_KEYS, ...ABU_ENCOURAGE_KEYS, ABU_RETRY_KEY];
    for (const key of keys) {
      expect(id[key]?.trim(), `id.${key}`).toBeTruthy();
      expect(en[key]?.trim(), `en.${key}`).toBeTruthy();
    }
  });

  it("tidak ada kalimat yang menghakimi atau bernada menyalahkan", () => {
    // Guard nada: audiensnya pemula. Kata-kata ini tidak boleh muncul di kalimat
    // yang menemani jawaban SALAH.
    const blaming = ["gagal", "salah banget", "bodoh", "harusnya", "kenapa tidak", "you failed", "wrong again"];
    for (const key of ABU_ENCOURAGE_KEYS) {
      const line = `${id[key]} ${en[key]}`.toLowerCase();
      for (const word of blaming) expect(line.includes(word), `${key} memuat "${word}"`).toBe(false);
    }
  });
});
