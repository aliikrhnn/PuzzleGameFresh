import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Board, Piece } from '../game/GameState';
import { BOARD_COLS, BOARD_ROWS } from '../game/GameState';

type Props = {
  board: Board;
  clearedRows?: number[];
  clearedCols?: number[];
  clearFlash?: Animated.Value;
  fallingPiece?: { piece: Piece; row: number; col: number };
  fallDistances?: Record<string, number>;
};

export function Grid({
  board,
  clearedRows = [],
  clearedCols = [],
  clearFlash,
  fallingPiece,
  fallDistances,
}: Props) {
  const { width } = useWindowDimensions();

  const PADDING = 32;
  const GAP = 3;
  const cellSize = Math.floor((width - PADDING - GAP * (BOARD_COLS - 1)) / BOARD_COLS);
  const gridWidth = cellSize * BOARD_COLS + GAP * (BOARD_COLS - 1);

  // 80 adet Animated.Value — her hücre için birer translateY (mount'ta bir kez oluşur)
  const fallAnims = useRef(
    Array.from({ length: BOARD_ROWS * BOARD_COLS }, () => new Animated.Value(0)),
  ).current;

  // Gravity animasyonunu tetikle
  useEffect(() => {
    if (!fallDistances || Object.keys(fallDistances).length === 0) return;
    const anims: Animated.CompositeAnimation[] = [];
    for (const [key, dist] of Object.entries(fallDistances)) {
      const [r, c] = key.split('-').map(Number);
      const anim = fallAnims[r * BOARD_COLS + c];
      anim.setValue(-dist * (cellSize + GAP)); // başlangıç: yukarıda
      anims.push(
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      );
    }
    Animated.parallel(anims).start();
  }, [fallDistances]); // cellSize orientation değişiminde farklı olabilir ama bu nadir

  const rowSet = new Set(clearedRows);
  const colSet = new Set(clearedCols);

  // Düşen parçanın kapladığı hücreler
  const fallingCells = new Set<string>();
  if (fallingPiece) {
    const { piece, row: pr, col: pc } = fallingPiece;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] !== 0) {
          fallingCells.add(`${pr + r}-${pc + c}`);
        }
      }
    }
  }

  return (
    <View style={[styles.grid, { width: gridWidth }]}>
      {board.map((row, r) =>
        row.map((cell, c) => {
          const isClearing = rowSet.has(r) || colSet.has(c);
          const isFalling = fallingCells.has(`${r}-${c}`);
          const fallAnim = fallAnims[r * BOARD_COLS + c];

          const cellStyle = [
            styles.cell,
            { width: cellSize, height: cellSize },
            cell.filled
              ? { backgroundColor: cell.color ?? '#a78bfa' }
              : isFalling
              ? { backgroundColor: fallingPiece!.piece.color, opacity: 0.9 }
              : styles.cellEmpty,
          ];

          const flashOverlay =
            isClearing && clearFlash ? (
              <Animated.View
                style={[StyleSheet.absoluteFill, styles.flashOverlay, { opacity: clearFlash }]}
              />
            ) : null;

          return (
            <Animated.View
              key={`${r}-${c}`}
              style={[cellStyle, { transform: [{ translateY: fallAnim }] }]}
            >
              {flashOverlay}
            </Animated.View>
          );
        }),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  cell: {
    borderRadius: 3,
  },
  cellEmpty: {
    backgroundColor: '#0d0d1a',
    borderWidth: 0.5,
    borderColor: '#1a1a2e',
  },
  flashOverlay: {
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
});
