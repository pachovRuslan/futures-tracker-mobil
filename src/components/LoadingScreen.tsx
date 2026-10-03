import { TrendLoader } from "@/components/TrendLoader";
import { colors } from "@/theme/colors";
import { SafeAreaView, StyleSheet } from "react-native";

export function LoadingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <TrendLoader />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
});
