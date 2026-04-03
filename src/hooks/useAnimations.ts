import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { Haptics } from '../utils/haptics';

export const ANIMATIONS_ENABLED = true;

export function useAnimations() {
  // Placement snap (orphan değildi — artık board transform'a bağlanıyor)
  const placeFeedback = useRef(new Animated.Value(1)).current;
  // Per-cell clear flash (Grid'e geçiyor)
  const clearFlash    = useRef(new Animated.Value(0)).current;
  // Board-level clear glow (purple overlay)
  const clearGlow     = useRef(new Animated.Value(0)).current;
  // Game over shake
  const gameOverShake = useRef(new Animated.Value(0)).current;
  // Obstacle landing thud (translateY)
  const obstacleImpact = useRef(new Animated.Value(0)).current;
  // Danger pulse
  const dangerPulse   = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dangerLoop    = useRef<any>(null);

  // Combo efektleri
  const comboScale        = useRef(new Animated.Value(1)).current;
  const comboShake        = useRef(new Animated.Value(0)).current;
  const comboBadgeOpacity = useRef(new Animated.Value(0)).current;
  const comboBadgeScale   = useRef(new Animated.Value(1)).current;

  // ── Placement snap ──────────────────────────────────────────────────────
  const animatePlace = useCallback(() => {
    if (!ANIMATIONS_ENABLED) return;
    Haptics.place();
    // Scale snap: board kısa bir pulse verir
    Animated.sequence([
      Animated.timing(placeFeedback, { toValue: 1.032, duration: 55, useNativeDriver: true }),
      Animated.timing(placeFeedback, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [placeFeedback]);

  // ── Clear efekti — combo seviyesine göre büyür ──────────────────────────
  const animateClear = useCallback((combo: number) => {
    if (!ANIMATIONS_ENABLED) return;

    // Per-cell flash — hızlı flash-in, yumuşak fade (her seviyede)
    clearFlash.setValue(0);
    Animated.sequence([
      Animated.timing(clearFlash, { toValue: 1, duration: 48, useNativeDriver: true }),
      Animated.timing(clearFlash, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    // Badge state'i sıfırla — önceki combo değeri kalmasın
    comboBadgeOpacity.setValue(0);

    if (combo >= 3) {
      // ── Combo 3+: maksimum etki ────────────────────────────────────────────
      Haptics.clear(3);

      // Bright purple burst
      clearGlow.setValue(0);
      Animated.sequence([
        Animated.timing(clearGlow, { toValue: 0.56, duration: 48, useNativeDriver: true }),
        Animated.timing(clearGlow, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]).start();

      // Güçlü shake — daha büyük amplitüd, daha fazla osilaston
      comboShake.setValue(0);
      Animated.sequence([
        Animated.timing(comboShake, { toValue: 14,  duration: 36, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: -13, duration: 36, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: 9,   duration: 32, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: -7,  duration: 32, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: 3,   duration: 26, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: 0,   duration: 22, useNativeDriver: true }),
      ]).start();

      // Scale overshoot: 1→1.08→0.93→1.02→1.0 — spring gibi tok hissettiriyor
      comboScale.setValue(1);
      Animated.sequence([
        Animated.timing(comboScale, { toValue: 1.08,  duration: 62, useNativeDriver: true }),
        Animated.timing(comboScale, { toValue: 0.93,  duration: 68, useNativeDriver: true }),
        Animated.timing(comboScale, { toValue: 1.02,  duration: 58, useNativeDriver: true }),
        Animated.timing(comboScale, { toValue: 1.0,   duration: 75, useNativeDriver: true }),
      ]).start();

      // Badge: büyük pop entrance — overshoot + bounce + uzun bekle
      comboBadgeScale.setValue(0.35);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(comboBadgeOpacity, { toValue: 1,    duration: 52, useNativeDriver: true }),
          Animated.timing(comboBadgeScale,   { toValue: 1.28, duration: 52, useNativeDriver: true }),
        ]),
        Animated.timing(comboBadgeScale, { toValue: 0.94, duration: 62, useNativeDriver: true }),
        Animated.timing(comboBadgeScale, { toValue: 1.0,  duration: 52, useNativeDriver: true }),
        Animated.delay(780),
        Animated.timing(comboBadgeOpacity, { toValue: 0, duration: 230, useNativeDriver: true }),
      ]).start();

    } else if (combo >= 2) {
      // ── Combo 2: belirgin patlama ──────────────────────────────────────────
      Haptics.clear(2);

      clearGlow.setValue(0);
      Animated.sequence([
        Animated.timing(clearGlow, { toValue: 0.34, duration: 50, useNativeDriver: true }),
        Animated.timing(clearGlow, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      // Scale overshoot: 1→1.048→0.975→1.0
      comboScale.setValue(1);
      Animated.sequence([
        Animated.timing(comboScale, { toValue: 1.048,  duration: 58, useNativeDriver: true }),
        Animated.timing(comboScale, { toValue: 0.975,  duration: 65, useNativeDriver: true }),
        Animated.timing(comboScale, { toValue: 1.0,    duration: 68, useNativeDriver: true }),
      ]).start();

      // Badge: net pop entrance
      comboBadgeScale.setValue(0.6);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(comboBadgeOpacity, { toValue: 1,    duration: 62, useNativeDriver: true }),
          Animated.timing(comboBadgeScale,   { toValue: 1.12, duration: 62, useNativeDriver: true }),
        ]),
        Animated.timing(comboBadgeScale, { toValue: 1.0, duration: 75, useNativeDriver: true }),
        Animated.delay(540),
        Animated.timing(comboBadgeOpacity, { toValue: 0, duration: 210, useNativeDriver: true }),
      ]).start();

    } else {
      // ── Combo 1: hafif ama net clear hissi ────────────────────────────────
      Haptics.clear(1);

      clearGlow.setValue(0);
      Animated.sequence([
        Animated.timing(clearGlow, { toValue: 0.15, duration: 50, useNativeDriver: true }),
        Animated.timing(clearGlow, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();

      // Micro scale pulse — combo=1'de de bir şeyler hissettiriyor
      comboScale.setValue(1);
      Animated.sequence([
        Animated.timing(comboScale, { toValue: 1.018, duration: 48, useNativeDriver: true }),
        Animated.timing(comboScale, { toValue: 1.0,   duration: 105, useNativeDriver: true }),
      ]).start();

      // Badge: sade fade-in
      comboBadgeScale.setValue(0.88);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(comboBadgeOpacity, { toValue: 0.65, duration: 68, useNativeDriver: true }),
          Animated.timing(comboBadgeScale,   { toValue: 1.0,  duration: 68, useNativeDriver: true }),
        ]),
        Animated.delay(330),
        Animated.timing(comboBadgeOpacity, { toValue: 0, duration: 175, useNativeDriver: true }),
      ]).start();
    }
  }, [clearFlash, clearGlow, comboScale, comboShake, comboBadgeOpacity, comboBadgeScale]);

  // ── Obstacle landing thud ────────────────────────────────────────────────
  const animateObstacleLand = useCallback(() => {
    if (!ANIMATIONS_ENABLED) return;
    Haptics.obstacleImpact();
    Animated.sequence([
      Animated.timing(obstacleImpact, { toValue: 5, duration: 55, useNativeDriver: true }),
      Animated.timing(obstacleImpact, { toValue: -2, duration: 50, useNativeDriver: true }),
      Animated.timing(obstacleImpact, { toValue: 0, duration: 65, useNativeDriver: true }),
    ]).start();
  }, [obstacleImpact]);

  // ── Danger loop ──────────────────────────────────────────────────────────
  const startDanger = useCallback(() => {
    if (!ANIMATIONS_ENABLED) return;
    dangerLoop.current?.stop();
    dangerLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(dangerPulse, { toValue: 0.22, duration: 450, useNativeDriver: true }),
        Animated.timing(dangerPulse, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    );
    dangerLoop.current.start();
  }, [dangerPulse]);

  const stopDanger = useCallback(() => {
    dangerLoop.current?.stop();
    dangerLoop.current = null;
    dangerPulse.setValue(0);
  }, [dangerPulse]);

  // ── Game over ────────────────────────────────────────────────────────────
  const animateGameOver = useCallback(() => {
    if (!ANIMATIONS_ENABLED) return;
    Haptics.gameOver();
    Animated.sequence([
      Animated.timing(gameOverShake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(gameOverShake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(gameOverShake, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(gameOverShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [gameOverShake]);

  return {
    placeFeedback,
    clearFlash,
    clearGlow,
    gameOverShake,
    obstacleImpact,
    comboScale,
    comboShake,
    comboBadgeOpacity,
    comboBadgeScale,
    dangerPulse,
    animatePlace,
    animateClear,
    animateObstacleLand,
    animateGameOver,
    startDanger,
    stopDanger,
  };
}
