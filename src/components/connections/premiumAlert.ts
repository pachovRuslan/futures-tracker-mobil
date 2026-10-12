import { useRouter } from "expo-router";
import { t } from "@/i18n";
import { Alert } from "react-native";

type Router = ReturnType<typeof useRouter>;

/**
 * Алерт «Требуется Premium» с кнопкой перехода на пейволл. Показывается
 * при ответе 402 PREMIUM_REQUIRED от сервера (подписка истекла, пока
 * пользователь был на экране подключений — гейт работает и на сервере).
 *
 * Используется и формой добавления ключа, и ручным синком. Перевод —
 * standalone t (вызов происходит в момент действия, язык уже актуален).
 */
export function premiumAlert(router: Router): void {
  Alert.alert(
    t("premium.requiredTitle"),
    t("premium.requiredMsg"),
    [
      { text: t("common.later"), style: "cancel" },
      {
        text: t("common.upgrade"),
        onPress: () => router.push("/paywall"),
      },
    ],
  );
}
