import { useRef, useCallback } from 'react';
import { Animated, Vibration } from 'react-native';

// Tüm efektleri buradan kapat
export const ANIMATIONS_ENABLED = true;

export function useAnimations() {
  const placeFeedback = useRef(new Animated.Value(1)).current;
  const clearFlash = useRef(new Animated.Value(0)).current;
  const gameOverShake = useRef(new Animated.Value(0)).current;
  // Tehlike (board dolmaya yaklaşınca) pulse
  const dangerPulse = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dangerLoop = useRef<any>(null);

  // Combo efektleri
  const comboScale = useRef(new Animated.Value(1)).current;
  const comboShake = useRef(new Animated.Value(0)).current;
  const comboBadgeOpacity = useRef(new Animated.Value(0)).current;
  const comboBadgeScale = useRef(new Animated.Value(1)).current;

  // Parça yerleşti: hafif scale pulse
  const animatePlace = useCallback(() => {
    if (!ANIMATIONS_ENABLED) return;
    try { Vibration.vibrate(18); } catch { /* izin yoksa sessizce devam */ }
    Animated.sequence([
      Animated.timing(placeFeedback, { toValue: 1.04, duration: 60, useNativeDriver: true }),
      Animated.timing(placeFeedback, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [placeFeedback]);

  // Satır/sütun temizlendi — combo seviyesine göre güçlenen efekt
  const animateClear = useCallback((combo: number) => {
    if (!ANIMATIONS_ENABLED) return;

    // Her seviyede: clearFlash
    Animated.sequence([
      Animated.timing(clearFlash, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(clearFlash, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    if (combo >= 3) {
      // Seviye 3+: sarsıntı + büyük patlama + güçlü badge + agresif vibrasyon
      try { Vibration.vibrate([0, 50, 30, 60, 20, 50]); } catch {}
      Animated.sequence([
        Animated.timing(comboShake, { toValue: 10, duration: 40, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: -10, duration: 40, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: 6, duration: 35, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: -6, duration: 35, useNativeDriver: true }),
        Animated.timing(comboShake, { toValue: 0, duration: 30, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(comboScale, { toValue: 1.05, duration: 80, useNativeDriver: true }),
        Animated.timing(comboScale, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
      comboBadgeScale.setValue(0.5);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(comboBadgeOpacity, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(comboBadgeScale, { toValue: 1.2, duration: 70, useNativeDriver: true }),
        ]),
        Animated.timing(comboBadgeScale, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.delay(650),
        Animated.timing(comboBadgeOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

    } else if (combo >= 2) {
      // Seviye 2: orta scale pulse + badge fade + orta vibrasyon
      try { Vibration.vibrate([0, 35, 25, 35]); } catch {}
      Animated.sequence([
        Animated.timing(comboScale, { toValue: 1.025, duration: 70, useNativeDriver: true }),
        Animated.timing(comboScale, { toValue: 1, duration: 130, useNativeDriver: true }),
      ]).start();
      comboBadgeScale.setValue(0.8);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(comboBadgeOpacity, { toValue: 0.9, duration: 80, useNativeDriver: true }),
          Animated.timing(comboBadgeScale, { toValue: 1, duration: 80, useNativeDriver: true }),
        ]),
        Animated.delay(500),
        Animated.timing(comboBadgeOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

    } else {
      // Seviye 1: sadece flash + hafif vibrasyon
      try { Vibration.vibrate(35); } catch {}
    }
  }, [clearFlash, comboScale, comboShake, comboBadgeOpacity, comboBadgeScale]);

  // Tehlike başlat / durdur
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

  // Game over: sağ-sol shake
  const animateGameOver = useCallback(() => {
    if (!ANIMATIONS_ENABLED) return;
    try { Vibration.vibrate([0, 60, 40, 60]); } catch { /* izin yoksa sessizce devam */ }
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
    gameOverShake,
    comboScale,
    comboShake,
    comboBadgeOpacity,
    comboBadgeScale,
    dangerPulse,
    animatePlace,
    animateClear,
    animateGameOver,
    startDanger,
    stopDanger,
  };
}
