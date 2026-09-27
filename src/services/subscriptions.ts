import { REVENUECAT_API_KEY } from "@/shared/config";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
export async function initRevenueCat() {
  // Пропускаем инициализацию, если нет ключа, мы в вебе или в Expo Go
  if (!REVENUECAT_API_KEY || Platform.OS === "web") {
    return;
  }

  // Проверяем, запущены ли мы в Expo Go
  const isExpoGo = Constants.appOwnership === "expo";
  if (isExpoGo) {
    console.log("RevenueCat: пропуск инициализации в Expo Go");
    return;
  }

  try {
    const apiKey =
      Platform.OS === "ios" ? REVENUECAT_API_KEY : REVENUECAT_API_KEY;
    await Purchases.configure({ apiKey });
  } catch (e) {
    console.log(
      "RevenueCat: ошибка инициализации (игнорируем в режиме разработки)",
    );
  }
}

export async function getSubscriptionStatus(): Promise<boolean> {
  // Пока считаем, что у пользователя нет Premium
  return false;
}

export async function purchasePremium(productId: string) {
  return false;
}

export async function restorePurchases() {
  return false;
}

export async function getOfferings() {
  return [];
}
