/**
 * 404 — copy santai (DESIGN.md § 5).
 */
import { Link } from "expo-router";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/ui/components";
import { useT } from "@/core/i18n/hooks";

export default function NotFound() {
  const { t } = useT();
  return (
    <SafeAreaView className="flex-1 bg-bg-base items-center justify-center gap-4 px-6">
      <Text className="text-5xl">😹</Text>
      <Text className="text-ink-primary font-display text-xl text-center">
        {t("notFound.title")}
      </Text>
      <Link href="/(tabs)" asChild>
        <Button label={t("notFound.backHome")} onPress={() => null} />
      </Link>
    </SafeAreaView>
  );
}
