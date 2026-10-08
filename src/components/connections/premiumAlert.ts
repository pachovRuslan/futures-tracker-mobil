import { useRouter } from "expo-router";
import { Alert } from "react-native";

type Router = ReturnType<typeof useRouter>;

/**
 * Алерт «Требуется Premium» с кнопкой перехода на пейволл. Показывается
 * при ответе 402 PREMIUM_REQUIRED от сервера (подписка истекла, пока
 * пользователь был на экране подключений — гейт работает и на сервере).
 *
 * Выделено из app/connections.tsx при декомпозиции: один и тот же алерт
 * нужен и форме добавления ключа, и ручному синку.
 */
export function premiumAlert(router: Router): void {
  Alert.alert(
    "Требуется Premium",
    "Подключения бирж и авто-синк доступны по подписке Premium.",
    [
      { text: "Позже", style: "cancel" },
      {
        text: "Перейти на Premium",
        onPress: () => router.push("/paywall"),
      },
    ],
  );
}
