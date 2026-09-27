import { fmt } from "@/shared/trade-model";
import { colors } from "@/theme/colors";
import { Text } from "react-native";

export function PnlValue({
  value,
  size = 16,
}: {
  value: number;
  size?: number;
}) {
  const positive = value >= 0;
  return (
    <Text
      style={{
        fontSize: size,
        fontWeight: "600",
        color: positive ? colors.profit : colors.loss,
      }}
    >
      {positive ? "+" : ""}
      {fmt(value)}
    </Text>
  );
}
