import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/I18nContext";
import { useTheme } from "@/theme/ThemeContext";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

/**
 * Иконка нижней навигации. Библиотека @expo/vector-icons подключена
 * осознанно: юникод-глифы (✓, ↻) отсутствуют в Roboto, и React Native
 * на Android не делает font-fallback — вместо иконки рисуется tofu-бокс.
 */
const tabIcon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size - 2} color={color} />
  );

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.dashboard"),
          headerShown: false,
          tabBarIcon: tabIcon("stats-chart"),
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{ title: t("tabs.trades"), tabBarIcon: tabIcon("swap-horizontal") }}
      />
      <Tabs.Screen
        name="balance"
        options={{ title: t("tabs.balance"), tabBarIcon: tabIcon("wallet") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("tabs.settings"), tabBarIcon: tabIcon("settings") }}
      />
    </Tabs>
  );
}
