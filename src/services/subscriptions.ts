import { REVENUECAT_API_KEY } from "@/shared/config";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";

export async function initRevenueCat() {
  // Временно отключаем инициализацию, если ключа нет или мы в вебе
  if (!REVENUECAT_API_KEY || Platform.OS === "web") {
    console.log(
      "RevenueCat: инициализация пропущена (нет ключа или веб-среда)",
    );
    return;
  }

  try {
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
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
