import {
  consumePendingCallbackUrl,
  describeOAuthError,
  exchangeCodeOnce,
  getSupabase,
  parseOAuthParams,
} from "@/services/auth";
import { colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";

/**
 * Экран /auth/callback — точка возврата из OAuth-браузера.
 *
 * Обрабатывает redirect двумя путями:
 *  1. Cold start: приложение было закрыто и открыто deep link'ом —
 *     URL доступен через Linking.getInitialURL().
 *  2. Warm start: приложение уже запущено — URL приходит событием
 *     Linking.addEventListener("url").
 *
 * ВАЖНО: обмен кода выполняется через exchangeCodeOnce (не
 * exchangeCodeForSession напрямую), потому что в Expo Go этот redirect
 * параллельно обрабатывает и signInWithGoogle (обещание
 * openAuthSessionAsync). PKCE-код одноразовый — без дедупликации
 * второй обмен падает с 400 и ломает вход (см. REFACTORING.md, баг №3).
 */
export default function AuthCallback() {
  const router = useRouter();
  const isHandled = useRef(false);
  // Обмен кода начат — таймауту запрещено выкидывать на /login (см. ниже).
  const codeStarted = useRef(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;
    let linkingSub: { remove: () => void } | null = null;

    const redirect = (path: "/" | "/login") => {
      if (isHandled.current) return;
      isHandled.current = true;
      unsub?.unsubscribe();
      linkingSub?.remove();
      setTimeout(() => router.replace(path), 100);
    };

    const handleCode = async (code: string) => {
      codeStarted.current = true;
      try {
        const user = await exchangeCodeOnce(code);
        redirect(user ? "/" : "/login");
      } catch (e) {
        // Ошибку показываем и в release: иначе обмен кода падал тихо, и
        // пользователь бесконечно возвращался на экран входа без объяснений.
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[Callback] exchangeCode error:", msg);
        Alert.alert("Не удалось завершить вход", msg);
        redirect("/login");
      }
    };

    const processUrl = (url: string | null): boolean => {
      if (!url || isHandled.current) return false;
      console.log("[Callback] processing URL:", url.slice(0, 120));

      const params = parseOAuthParams(url);

      if (params.code) {
        handleCode(params.code);
        return true;
      }
      if (params.error) {
        console.error(
          "[Callback] OAuth error:",
          params.error,
          params.error_description,
        );
        Alert.alert("Ошибка авторизации", describeOAuthError(params));
        redirect("/login");
        return true;
      }
      return false;
    };

    // 1. Сначала проверяем существующую сессию — её мог установить
    //    параллельный обработчик (signInWithGoogle в Expo Go).
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (isHandled.current) return;
        if (session?.user) {
          redirect("/");
          return;
        }

        // 2. Cold start: приложение открыто deep link'ом.
        Linking.getInitialURL().then((url) => {
          if (processUrl(url)) return;
          // 3. Warm start: событие "url" пришло ДО монтирования экрана
          //    (пользователь был на /login) — его перехватил глобальный
          //    слушатель в services/auth.ts. Забираем сохранённый URL.
          processUrl(consumePendingCallbackUrl());
        });
      });

    // 4. Warm start, событие пришло уже при смонтированном экране.
    linkingSub = Linking.addEventListener("url", ({ url }) => {
      processUrl(url);
    });

    // 5. Fallback через onAuthStateChange.
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        redirect("/");
      } else if (event === "SIGNED_OUT") {
        redirect("/login");
      }
    });
    unsub = data.subscription;

    // 6. Timeout fallback: только если обмен кода ещё НЕ начался.
    //
    // История бага: раньше здесь стоял безусловный redirect через 5 секунд.
    // На медленной сети/устройстве обмен кода занимает больше 5с
    // (RTT до региона Supabase + серверный обмен с Google + шифрование
    // SecureStore, где сессия ~4-6КБ пишется ~10 отдельными операциями
    // Keystore). Экран уходил на /login, обмен завершался уже без него,
    // сессия записывалась в хранилище, но UI узнавал о ней только после
    // перезапуска приложения — «бесконечный логин». Если обмен начат —
    // ждём (Android всё равно замораживает фоновый fetch, он доделается
    // при возврате в приложение).
    const timer = setTimeout(async () => {
      if (isHandled.current) return;
      if (codeStarted.current) {
        setSlow(true);
        return;
      }
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      redirect(session ? "/" : "/login");
    }, 5000);

    // 7. Жёсткий потолок: даже зависший сетевой запрос не должен держать
    //    экран бесконечно. 60с ≈ 12× старого бюджета — за это время живой
    //    обмен успеет точно.
    const hardTimer = setTimeout(async () => {
      if (isHandled.current) return;
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      if (!session) {
        Alert.alert(
          "Вход не завершён",
          "Обмен ключами затянулся более чем на минуту. Попробуйте войти ещё раз.",
        );
      }
      redirect(session ? "/" : "/login");
    }, 60000);

    return () => {
      clearTimeout(timer);
      clearTimeout(hardTimer);
      unsub?.unsubscribe();
      linkingSub?.remove();
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.text}>
        {slow
          ? "Завершаем вход — на медленной сети это может занять до минуты…"
          : "Вход в систему..."}
      </Text>
    </View>
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
    color: colors.textMuted,
    marginTop: 16,
  },
});
