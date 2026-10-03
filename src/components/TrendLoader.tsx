import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Анимация загрузки «трендовая линия»: зелёная кривая доходности
 * рисуется слева направо, область под ней мягко заливается, а по линии
 * бежит пульсирующая точка и остаётся мигать на конце графика.
 * Фирменная замена системному ActivityIndicator в теме приложения.
 *
 * Реализовано на встроенном Animated (useNativeDriver: true) — внешних
 * зависимостей нет, 60 fps на нативном потоке.
 *
 * Как устроен «рисунок» линии: содержимое графика статично, но прикрыто
 * «занавесом» цвета фона, который уезжает вправо (translateX). Точка-«перо»
 * движется ровно по кромке занавеса: её вертикаль задана кусочно-линейной
 * интерполяцией по опорным точкам — то есть точно по ломаной.
 *
 * ⚠️ Занавес закрашен colors.bg — компонент рассчитан на экраны с фоном
 * colors.bg (все экраны приложения). SVG-библиотеки в проекте нет,
 * поэтому линия — повёрнутые отрезки, а заливка — столбики по 4px.
 */

/** Опорные точки ломаной (координаты графика, ось Y направлена вниз). */
const POINTS = [
  { x: 0, y: 56 },
  { x: 26, y: 44 },
  { x: 52, y: 50 },
  { x: 78, y: 32 },
  { x: 104, y: 38 },
  { x: 130, y: 16 },
];

const CHART_W = 130;
const CHART_H = 66;
const BASE_Y = 64;
const PAD = 16;
const WRAP_W = PAD + CHART_W + PAD;
const WRAP_H = PAD + CHART_H + PAD;

const LINE_W = 3;
const STRIP_W = 4;
const FILL_OPACITY = 0.12;
const DOT = 10;
const RING = 16;
const RING_BORDER = 2;

const REVEAL = 1150;
const HOLD = 850;
const FADE = 240;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** y ломаной в точке x (кусочно-линейная интерполяция). */
function lineY(x: number): number {
  for (let i = 1; i < POINTS.length; i++) {
    const a = POINTS[i - 1];
    const b = POINTS[i];
    if (x <= b.x) {
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return POINTS[POINTS.length - 1].y;
}

/** Отрезки линии: позиция, длина и угол посчитаны заранее. */
const SEGMENTS = POINTS.slice(1).map((b, i) => {
  const a = POINTS[i];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    left: (a.x + b.x) / 2 - len / 2,
    top: (a.y + b.y) / 2 - LINE_W / 2,
    len,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
});

/** Столбики заливки под линией — area fill без SVG. */
const FILL_STRIPS = Array.from(
  { length: Math.ceil(CHART_W / STRIP_W) },
  (_, i) => {
    const y = lineY(i * STRIP_W + STRIP_W / 2);
    return { left: i * STRIP_W, top: y, height: BASE_Y - y };
  },
);

/** Горизонтальная сетка. */
const GRID = [22, 44];

/**
 * Трендовый загрузчик.
 *
 * @param scale Уменьшение для компактных мест (карточки, инлайн-блоки):
 *              scale={0.6} — размер контейнера пропорционально меньше.
 */
export function TrendLoader({ scale = 1 }: { scale?: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const draw = Animated.loop(
      Animated.sequence([
        // Линия рисуется: занавес уезжает вправо, точка бежит по кромке.
        Animated.timing(progress, {
          toValue: 1,
          duration: REVEAL,
          easing: EASE,
          useNativeDriver: true,
        }),
        Animated.delay(HOLD),
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Сброс ширины и прозрачности при нулевой видимости — кадр
        // не мелькает, loop() запускает цикл заново.
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    draw.start();
    return () => draw.stop();
  }, [progress, opacity]);

  useEffect(() => {
    // Пульс кольца вокруг точки — независимый цикл.
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.9,
            duration: 750,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 750,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0.45,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [ringScale, ringOpacity]);

  const curtainX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, CHART_W],
  });
  // Точка едет ровно по кромке занавеса (x-шаг точек равномерный).
  const dotX = curtainX;
  const dotY = progress.interpolate({
    inputRange: POINTS.map((_, i) => i / (POINTS.length - 1)),
    outputRange: POINTS.map((p) => p.y),
  });

  return (
    <View
      style={{
        width: WRAP_W * scale,
        height: WRAP_H * scale,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: WRAP_W,
          height: WRAP_H,
          opacity,
          transform: [{ scale }],
        }}
      >
        {/* График; обрезка прячет линию справа от «пера» */}
        <View
          style={{
            position: "absolute",
            left: PAD,
            top: PAD,
            width: CHART_W,
            height: CHART_H,
            overflow: "hidden",
          }}
        >
          {GRID.map((y) => (
            <View
              key={y}
              style={{
                position: "absolute",
                left: 0,
                top: y,
                width: CHART_W,
                height: 1,
                backgroundColor: colors.text,
                opacity: 0.06,
              }}
            />
          ))}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: BASE_Y,
              width: CHART_W,
              height: 1,
              backgroundColor: colors.text,
              opacity: 0.12,
            }}
          />
          {FILL_STRIPS.map((s, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: s.left,
                top: s.top,
                width: STRIP_W,
                height: s.height,
                backgroundColor: colors.profit,
                opacity: FILL_OPACITY,
              }}
            />
          ))}
          {SEGMENTS.map((s, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: s.left,
                top: s.top,
                width: s.len,
                height: LINE_W,
                borderRadius: LINE_W / 2,
                backgroundColor: colors.profit,
                transform: [{ rotate: `${s.angle}deg` }],
              }}
            />
          ))}
          {/* Занавес цвета фона: уезжая вправо, «рисует» график */}
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CHART_W,
              height: CHART_H,
              backgroundColor: colors.bg,
              transform: [{ translateX: curtainX }],
            }}
          />
        </View>
        {/* Пульсирующее кольцо и точка-«перо» — вне обрезки */}
        <Animated.View
          style={{
            position: "absolute",
            left: PAD - RING / 2,
            top: PAD - RING / 2,
            width: RING,
            height: RING,
            borderRadius: RING / 2,
            borderWidth: RING_BORDER,
            borderColor: colors.profit,
            opacity: ringOpacity,
            transform: [
              { translateX: dotX },
              { translateY: dotY },
              { scale: ringScale },
            ],
          }}
        />
        <Animated.View
          style={{
            position: "absolute",
            left: PAD - DOT / 2,
            top: PAD - DOT / 2,
            width: DOT,
            height: DOT,
            borderRadius: DOT / 2,
            backgroundColor: colors.profit,
            transform: [{ translateX: dotX }, { translateY: dotY }],
          }}
        />
      </Animated.View>
    </View>
  );
}
