/**
 * Tabs: Home · Mushaf · Profil (DESIGN.md § 4). Web tetap bottom bar max-width 480.
 */
import { Tabs } from "expo-router";
import { View } from "react-native";

import { useT } from "@/core/i18n/hooks";
import { Ionicons } from "@/ui/icons";

export default function TabsLayout() {
  const { t } = useT();
  return (
    <View className="flex-1 bg-bg-base max-w-[480px] w-full self-center" style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#141B19",
            borderTopColor: "rgba(255,255,255,0.08)",
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: "#10B981",
          tabBarInactiveTintColor: "#9CA8A4",
          sceneStyle: { backgroundColor: "#0B0F0E" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabs.home"),
            // Jejak kaki, bukan rumah: tab Home = "tempat Abu" (BRAND.md § 4).
            // `paw` tetap keluarga Ionicons yang sudah dibundel — tidak ada font
            // ikon baru yang ikut ke bundle (src/ui/icons.ts).
            tabBarIcon: ({ color, size }) => <Ionicons name="paw" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="mushaf"
          options={{
            title: t("tabs.mushaf"),
            tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("tabs.profile"),
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
