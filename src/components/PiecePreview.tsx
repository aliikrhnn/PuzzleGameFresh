import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Piece } from '../game/GameState';

type Props = {
  piece: Piece | null;
  label?: string;
};

const CELL = 18;
const GAP = 2;

export function PiecePreviewRows({ piece, label = 'Sıradaki' }: Props) {
  if (!piece) return null;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {piece.shape.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => (
            <View
              key={c}
              style={[
                styles.cell,
                cell === 1 ? { backgroundColor: piece.color } : styles.cellEmpty,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: '#888',
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
  cellEmpty: {
    backgroundColor: 'transparent',
  },
});
