/**
 * Разбор и формат пользовательского ввода даты-времени в формах сделок.
 *
 * Формат ввода: "YYYY-MM-DD HH:MM" (время опционально → 00:00).
 * В БД пишем ISO-строку. Ввод трактуем как ЛОКАЛЬНОЕ время устройства —
 * трейдер вводит то, что видел в терминале/на бирже.
 *
 * Без новых зависимостей: поля дат — обычные TextInput с валидацией
 * (нативный пикер @react-native-community/datetimepicker тащил бы
 * нативный модуль ради двух полей).
 */

const USER_DT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/;

/**
 * "YYYY-MM-DD[ HH:MM]" → ISO string. null — если не разбирается или
 * даты не существует (31 февраля и т.п.).
 */
export function parseUserDateTime(raw: string): string | null {
  const m = USER_DT_RE.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const dt = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h ?? 0),
    Number(mi ?? 0),
  );
  // new Date() «нормализует» несуществующие даты (31.02 → 03.03),
  // поэтому сверяем компоненты с введёнными.
  if (
    dt.getFullYear() !== Number(y) ||
    dt.getMonth() !== Number(mo) - 1 ||
    dt.getDate() !== Number(d)
  ) {
    return null;
  }
  return dt.toISOString();
}

/** ISO → "YYYY-MM-DD HH:MM" в локальном времени; "" для null/мусора. */
export function formatUserDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Текущий момент в формате формы (для кнопки «сейчас»). */
export function nowUserDateTime(): string {
  return formatUserDateTime(new Date().toISOString());
}
