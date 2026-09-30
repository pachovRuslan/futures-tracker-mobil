import { colors } from "@/theme/colors";
import { Link, Stack } from "expo-router";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Не найдено" }} />
      <Text style={styles.text}>Экран не найден</Text>
      <Link href="/" style={styles.link}>
        На главную
      </Link>
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
  text: {
    color: colors.text,
    fontSize: 18,
    marginBottom: 16,
  },
  link: {
    color: colors.accent,
    fontSize: 14,
  },
});
