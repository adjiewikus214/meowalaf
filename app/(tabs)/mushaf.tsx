/**
 * Mushaf: daftar 114 surat, searchable (PRD § 5.3), plus dua jalan membuka
 * yang paling sering dipakai: shortcut Surah Yasin dan daftar Ayat Favorit.
 */
import { useMemo, useState } from "react";
import { Link, useRouter } from "expo-router";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/ui/components";
import { Ionicons } from "@/ui/icons";
import { getSurahMeta, surahMetadata, type SurahMeta } from "@/core/content/meta";
import { useT } from "@/core/i18n/hooks";
import { useBookmarkStore } from "@/core/progress/bookmark-store";

/**
 * Yasin (surah 36) adalah tujuan "baca sendiri" — sering dibaca tanpa lesson.
 * Shortcut-nya supaya tidak perlu scroll 114 baris atau mengetik namanya. ID-nya
 * tetap konstanta (itu memang identitas surah, bukan data yang berubah), tapi
 * NAMA & jumlah ayat diambil dari bundle metadata — bukan diketik ulang, supaya
 * tidak bisa menyimpang dari mushaf.
 */
const YASIN_ID = 36;

function filterSurahs(query: string): readonly SurahMeta[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return surahMetadata;
  return surahMetadata.filter(
    (s) => s.nameLatin.toLowerCase().includes(q) || String(s.id) === q || s.meaningId.toLowerCase().includes(q),
  );
}

function SurahRow({ surah }: { surah: SurahMeta }) {
  const { t } = useT();
  return (
    <Link href={`/surah/${surah.id}`} asChild accessibilityRole="link">
      <Pressable className="bg-bg-elevated border border-line rounded-card px-4 py-3 flex-row items-center gap-3 active:opacity-80">
        <View className="w-9 h-9 rounded-xl bg-brand-emerald/15 items-center justify-center">
          <Text className="text-brand-emerald font-sans-bold text-sm">{surah.id}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-ink-primary font-sans-semibold">{surah.nameLatin}</Text>
          <Text className="text-ink-secondary text-xs">
            {surah.meaningId} · {t("mushaf.ayahCount", { count: surah.ayahCount })} ·{" "}
            {t(surah.revelation === "mekkah" ? "mushaf.revelation.mekkah" : "mushaf.revelation.madinah")}
          </Text>
        </View>
        <Text className="font-arab text-ink-arab text-xl">{surah.nameArabic}</Text>
      </Pressable>
    </Link>
  );
}

function SearchField({ query, onChange }: { query: string; onChange: (value: string) => void }) {
  const { t } = useT();
  return (
    <TextInput
      value={query}
      onChangeText={onChange}
      placeholder={t("mushaf.searchPlaceholder")}
      placeholderTextColor="#9CA8A4"
      accessibilityLabel={t("mushaf.searchLabel")}
      className="bg-white/5 border border-line rounded-card px-4 min-h-[44px] text-ink-primary"
    />
  );
}

export default function Mushaf() {
  const { t } = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const bookmarkCount = useBookmarkStore((s) => s.bookmarks.length);
  const bookmarksLoaded = useBookmarkStore((s) => s.loaded);
  const yasin = getSurahMeta(YASIN_ID);

  const filtered = useMemo(() => filterSurahs(query), [query]);

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="px-4 pt-2 pb-3 gap-2">
        <Text className="text-ink-primary font-display text-2xl">{t("mushaf.title")}</Text>
        <SearchField query={query} onChange={setQuery} />
        {query.length === 0 ? (
          <View className="gap-2">
            <Text className="text-ink-secondary text-[10px] uppercase tracking-widest font-sans-semibold px-1">
              {t("mushaf.quickSection")}
            </Text>
            {yasin !== undefined ? (
              <Link href={`/surah/${yasin.id}`} asChild accessibilityRole="link">
                <Pressable className="bg-brand-emerald/10 border border-brand-emerald/40 rounded-card px-4 py-3 flex-row items-center gap-3 active:opacity-80">
                  <View className="w-9 h-9 rounded-xl bg-brand-emerald/20 items-center justify-center">
                    <Text className="text-brand-emerald font-sans-bold text-sm">{yasin.id}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink-primary font-sans-semibold">{yasin.nameLatin}</Text>
                    <Text className="text-ink-secondary text-xs">
                      {yasin.meaningId} · {t("mushaf.ayahCount", { count: yasin.ayahCount })}
                    </Text>
                  </View>
                  <Text className="font-arab text-ink-arab text-xl">{yasin.nameArabic}</Text>
                </Pressable>
              </Link>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("bookmark.title")}
              onPress={() => router.push("/bookmarks")}
              className="bg-bg-elevated border border-line rounded-card px-4 py-3 flex-row items-center gap-3 active:opacity-80"
            >
              <View className="w-9 h-9 rounded-xl bg-white/5 items-center justify-center">
                <Ionicons name="bookmark" size={16} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-ink-primary font-sans-semibold">{t("bookmark.title")}</Text>
                {/* Sebelum storage siap, "0 ayat tersimpan" adalah klaim palsu —
                    jadi teksnya belum ada, bukan tampil nol (RULES § 9). */}
                {bookmarksLoaded && bookmarkCount > 0 ? (
                  <Text className="text-ink-secondary text-xs">
                    {t("bookmark.count", { count: bookmarkCount })}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA8A4" />
            </Pressable>
          </View>
        ) : null}
      </View>
      <FlatList
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 24, gap: 8 }}
        data={filtered}
        keyExtractor={(s) => String(s.id)}
        ListEmptyComponent={
          <EmptyState
            emoji="🔍"
            title={t("mushaf.empty.title")}
            subtitle={t("mushaf.empty.subtitle")}
          />
        }
        renderItem={({ item }) => <SurahRow surah={item} />}
      />
    </SafeAreaView>
  );
}
