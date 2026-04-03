import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// v2 key — yeni drag modunu ilk kez gören herkese göster
export const TUTORIAL_KEY = 'tutorial_seen_v2';

const STEPS = [
  {
    symbol: '✋',
    title: 'Sürükle & Bırak',
    body: 'Parçayı grid üzerine sürükle.\nYeşil alan = geçerli yer.',
  },
  {
    symbol: '☰',
    title: '3 Parça, Sen Seç',
    body: 'Tepsideki 3 parçadan istediğini seç.\n↻ ile döndür.',
  },
  {
    symbol: '▣',
    title: 'Doldur & Temizle',
    body: 'Satır veya sütun dolarsa temizlenir.\nCombo yap, puan topla.',
  },
];

type Props = {
  onDone: () => void;
};

export function TutorialOverlay({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    AsyncStorage.setItem(TUTORIAL_KEY, '1').catch(() => {});
    onDone();
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>

        {/* Adım göstergesi */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.symbol}>{current.symbol}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>

        <TouchableOpacity
          style={styles.btn}
          activeOpacity={0.8}
          onPress={isLast ? finish : () => setStep(s => s + 1)}
        >
          <Text style={styles.btnText}>{isLast ? 'Anladım' : 'İleri'}</Text>
        </TouchableOpacity>

        {!isLast && (
          <TouchableOpacity onPress={finish} style={styles.skipWrap}>
            <Text style={styles.skip}>Atla</Text>
          </TouchableOpacity>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,14,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    width: '82%',
    backgroundColor: '#13131f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a1a4e',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2a1a4e' },
  dotActive: { backgroundColor: '#7c3aed', width: 20 },
  symbol: { fontSize: 38, marginBottom: 2 },
  title: { fontSize: 18, fontWeight: '700', color: '#e2e2f0', letterSpacing: 0.4 },
  body: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipWrap: { paddingVertical: 6 },
  skip: { color: '#333', fontSize: 13 },
});
