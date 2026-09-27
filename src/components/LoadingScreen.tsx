import { colors } from "@/theme/colors";
import { ActivityIndicator, View } from "react-native";

export function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}
