import { Platform, Vibration } from 'react-native';

// Vibration.vibrate pattern'i: [gecikme, titreşim, duraklama, titreşim, ...]
// Android: pattern tam desteklenir
// iOS: pattern desteği sınırlı — sadece ilk değer (ms) kullanılır, güvenli

function safe(fn: () => void): void {
  try { fn(); } catch {}
}

// Kısa yardımcı: iOS'ta sadece sabit süre, Android'de pattern
function vibrate(androidPattern: number[], iosDuration: number): void {
  if (Platform.OS === 'android') {
    safe(() => Vibration.vibrate(androidPattern));
  } else {
    safe(() => Vibration.vibrate(iosDuration));
  }
}

export const Haptics = {
  // Parçayı elde aldın — çok hafif, "tuttu" hissi
  pickup(): void {
    safe(() => Vibration.vibrate(8));
  },

  // Başarılı yerleşim — tok çift darbe
  place(): void {
    vibrate([0, 14, 8, 24], 20);
  },

  // Geçersiz bırakma — iki zayıf "hayır" titreşimi
  invalid(): void {
    vibrate([0, 14, 10, 14], 18);
  },

  // Clear — combo'ya göre güçlenen üç farklı pattern
  clear(combo: number): void {
    if (combo >= 3) {
      // Üçlü yükselen darbe — güç hissi
      vibrate([0, 60, 22, 80, 18, 55], 80);
    } else if (combo >= 2) {
      // Çiftli vurgu
      vibrate([0, 42, 18, 55], 55);
    } else {
      // Hafif-güçlü sıralı darbe
      vibrate([0, 28, 12, 40], 38);
    }
  },

  // Obstacle board'a iner — ağır thud + kısa yankı
  obstacleImpact(): void {
    vibrate([0, 48, 14, 22], 45);
  },

  // Game over — ağır, yavaşlayan pattern
  gameOver(): void {
    vibrate([0, 80, 35, 90, 28, 65], 80);
  },
};
