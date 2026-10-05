/**
 * Owner: ui/components. Grafik batang mini (batang murni View — tanpa svg, biar
 * jalan di web & native tanpa dep tambahan, sama seperti ProgressRing).
 * Presentasi sepenuhnya generik: caller sudah menghitung `ratio` 0..1, jadi
 * komponen ini tidak tahu apa pun soal XP/akurasi/streak.
 *
 * `ratio` dinormalkan terhadap `maxValue` di dalam supaya pemanggil cukup
 * mengirim angka mentah. Batang bernilai 0 tetap dirender (jejak tipis) supaya
 * sumbu X tetap terbaca dan hari kosong tidak "hilang".
 */
import { Text, View } from "react-native";

export type MiniBar = {
  key: string;
  /** Label sumbu X ( Singkat). */
  label: string;
  /** Nilai mentah (bukan rasio) — dinormalkan terhadap max antar-batang. */
  value: number;
  /** Tandai hari ini / nilai terbaik supaya menonjol. */
  emphasis?: boolean;
  /** Nilai tanpa data (mis. akurasi null) → batang redup, bukan 0%. */
  muted?: boolean;
};

export type MiniBarsProps = {
  bars: readonly MiniBar[];
  /** Tinggi area grafik (px). */
  height?: number;
  /** Warna batang via className token. */
  barClassName?: string;
  /** Angka kecil di atas batang (opsional; melewati jika undefined). */
  formatValue?: (value: number) => string;
  accessibilityLabel: string;
};

const BAR_TRACK = "absolute inset-x-0 bottom-0 rounded-t-[3px] bg-white/5";

export function MiniBars({
  bars,
  height = 72,
  barClassName = "bg-brand-emerald",
  formatValue,
  accessibilityLabel,
}: MiniBarsProps) {
  // `null`-safe: MiniBar.value selalu number, tapi guard agar max tidak NaN.
  const max = Math.max(0, ...bars.map((bar) => (Number.isFinite(bar.value) ? bar.value : 0)));

  return (
    <View accessible accessibilityLabel={accessibilityLabel} className="w-full gap-1">
      {/* Caption jadi baris sendiri, BUKAN di dalam kolom bar: tinggi font teks
          platform-dependen, jadi kalau dipatok dalam baris `height` tetap,
          caption-nya bisa tergeser keluar dan tidak pernah terlihat. */}
      {formatValue !== undefined ? (
        <View className="flex-row gap-1.5">
          {bars.map((bar) => (
            <Text
              key={bar.key}
              numberOfLines={1}
              className="flex-1 text-center text-[9px] text-ink-secondary"
            >
              {bar.muted ? "" : formatValue(Number.isFinite(bar.value) ? bar.value : 0)}
            </Text>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-end gap-1.5" style={{ height }}>
        {bars.map((bar) => {
          const value = Number.isFinite(bar.value) ? bar.value : 0;
          const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
          // Bar 0 tetap punya tinggi kecil supaya "tidak ada" ≠ "hilang".
          const barHeight = bar.muted ? 3 : Math.max(3, Math.round(ratio * height));
          return (
            <View key={bar.key} className="flex-1 justify-end">
              <View className={`w-full ${BAR_TRACK}`} style={{ height }}>
                <View
                  className={`absolute inset-x-0 bottom-0 rounded-t-[3px] ${
                    bar.muted ? "bg-white/15" : bar.emphasis ? "bg-brand-violet" : barClassName
                  }`}
                  style={{ height: barHeight }}
                />
              </View>
            </View>
          );
        })}
      </View>

      <View className="flex-row gap-1.5">
        {bars.map((bar) => (
          <Text
            key={bar.key}
            numberOfLines={1}
            className={`flex-1 text-center text-[9px] ${
              bar.emphasis ? "text-brand-violet font-sans-semibold" : "text-ink-secondary"
            }`}
          >
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}