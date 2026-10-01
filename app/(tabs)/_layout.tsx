import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
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
          title: "Дашборд",
          headerShown: false,
          tabBarIcon: tabIcon("stats-chart"),
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{ title: "Сделки", tabBarIcon: tabIcon("swap-horizontal") }}
      />
      <Tabs.Screen
        name="balance"
        options={{ title: "Баланс", tabBarIcon: tabIcon("wallet") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Настройки", tabBarIcon: tabIcon("settings") }}
      />
    </Tabs>
  );
}
