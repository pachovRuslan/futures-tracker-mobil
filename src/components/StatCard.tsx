import { colors } from "@/theme/colors";
import { Text, View } from "react-native";

export function StatCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        flex: 1,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: colors.textFaint,
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text }}>
        {value}
      </Text>
    </View>
  );
}
