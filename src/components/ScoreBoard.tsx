import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  highScore?: number | null;
};

export function ScoreBoard({ highScore }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>En Yüksek Skor</Text>
      <Text style={styles.value}>
        {highScore == null ? '—' : highScore.toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#444',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    color: '#f0f0f0',
    fontSize: 22,
    fontWeight: '700',
  },
});
