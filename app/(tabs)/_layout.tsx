import { useI18n } from "@/i18n/I18nContext";
import { useTheme } from "@/theme/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

type TabIconProps = { color: ColorValue; size: number };
type TabIconComponent = (props: TabIconProps) => React.JSX.Element;

const makeTabIcon = (
  name: keyof typeof Ionicons.glyphMap,
): TabIconComponent => {
  const Icon = ({ color, size }: TabIconProps) => (
    <Ionicons name={name} size={size - 2} color={color} />
  );
  Icon.displayName = `TabIcon(${String(name)})`;
  return Icon;
};

const DashboardIcon = makeTabIcon("stats-chart");
const TradesIcon = makeTabIcon("swap-horizontal");
const BalanceIcon = makeTabIcon("wallet");
const SettingsIcon = makeTabIcon("settings");

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
          tabBarIcon: DashboardIcon,
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{ title: t("tabs.trades"), tabBarIcon: TradesIcon }}
      />
      <Tabs.Screen
        name="balance"
        options={{ title: t("tabs.balance"), tabBarIcon: BalanceIcon }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("tabs.settings"), tabBarIcon: SettingsIcon }}
      />
    </Tabs>
  );
}
