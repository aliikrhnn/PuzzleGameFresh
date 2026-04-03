import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Board, FallingObstacle, Piece } from '../game/GameState';
import { BOARD_COLS, BOARD_ROWS } from '../game/GameState';

type Props = {
  board: Board;
  clearedRows?: number[];
  clearedCols?: number[];
  clearFlash?: Animated.Value;
  fallingPiece?: { piece: Piece; row: number; col: number };
  fallDistances?: Record<string, number>;
  dragPreview?: { piece: Piece; row: number; col: number; isValid: boolean };
  fallingObstacle?: FallingObstacle | null;
};

const GAP = 3;

export function Grid({
  board,
  clearedRows = [],
  clearedCols = [],
  clearFlash,
  fallingPiece,
  fallDistances,
  dragPreview,
  fallingObstacle,
}: Props) {
  const { width } = useWindowDimensions();
  const PADDING = 32;
  const cellSize = Math.floor((width - PADDING - GAP * (BOARD_COLS - 1)) / BOARD_COLS);
  const gridWidth = cellSize * BOARD_COLS + GAP * (BOARD_COLS - 1);
  const step = cellSize + GAP;

  // ── Gravity animasyonu ─────────────────────────────────────────────────────
  const fallAnims = useRef(
    Array.from({ length: BOARD_ROWS * BOARD_COLS }, () => new Animated.Value(0)),
  ).current;

  // Render öncesi offset set et — 1-frame flash'i önler
  useLayoutEffect(() => {
    if (!fallDistances || Object.keys(fallDistances).length === 0) return;
    for (const [key, dist] of Object.entries(fallDistances)) {
      const [r, c] = key.split('-').map(Number);
      fallAnims[r * BOARD_COLS + c].setValue(-dist * step);
    }
  }, [fallDistances]);

  // Render sonrası animasyonu başlat
  useEffect(() => {
    if (!fallDistances || Object.keys(fallDistances).length === 0) return;
    const anims: Animated.CompositeAnimation[] = [];
    for (const [key] of Object.entries(fallDistances)) {
      const [r, c] = key.split('-').map(Number);
      anims.push(
        Animated.timing(fallAnims[r * BOARD_COLS + c], {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      );
    }
    Animated.parallel(anims).start();
  }, [fallDistances]);

  // ── Aktif parça smooth düşüş ───────────────────────────────────────────────
  const animY = useRef(new Animated.Value(0)).current;
  const animX = useRef(new Animated.Value(0)).current;
  const prevPieceId = useRef<string | undefined>(undefined);
  const prevRow = useRef(0);

  const fpRow = fallingPiece?.row ?? -1;
  const fpCol = fallingPiece?.col ?? -1;
  const fpId  = fallingPiece?.piece.id ?? '';

  useEffect(() => {
    if (fpRow < 0 || !fpId) return;
    const targetY = fpRow * step;
    const targetX = fpCol * step;

    if (fpId !== prevPieceId.current) {
      // Yeni parça: anında konumlan
      animY.setValue(targetY);
      animX.setValue(targetX);
    } else if (fpRow === prevRow.current + 1) {
      // Otomatik 1-satır düşüş: her seferinde logik başlangıç noktasından animate et
      animY.setValue((fpRow - 1) * step);
      Animated.timing(animY, {
        toValue: targetY,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      animX.setValue(targetX);
    } else {
      // Hard drop / rotation kick / manuel: anında
      animY.setValue(targetY);
      animX.setValue(targetX);
    }

    prevPieceId.current = fpId;
    prevRow.current = fpRow;
  }, [fpRow, fpCol, fpId]);

  // ── Engel bloğu smooth düşüş ───────────────────────────────────────────────
  const obstacleAnimY = useRef(new Animated.Value(0)).current;
  const prevObstacleRow = useRef(-1);

  const obsRow = fallingObstacle?.row ?? -1;
  const obsCol = fallingObstacle?.col ?? -1;

  useEffect(() => {
    if (obsRow < 0) {
      prevObstacleRow.current = -1;
      return;
    }
    const targetY = obsRow * step;

    if (prevObstacleRow.current < 0) {
      // Yeni obstacle: üstten snap
      obstacleAnimY.setValue(0);
    } else if (obsRow === prevObstacleRow.current + 1) {
      // 1 satır düşüş: animate
      obstacleAnimY.setValue((obsRow - 1) * step);
      Animated.timing(obstacleAnimY, {
        toValue: targetY,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      obstacleAnimY.setValue(targetY);
    }

    prevObstacleRow.current = obsRow;
  }, [obsRow]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const rowSet = new Set(clearedRows);
  const colSet = new Set(clearedCols);

  return (
    <View style={[styles.grid, { width: gridWidth }]}>
      {/* Kilitli board hücreleri */}
      {board.map((row, r) =>
        row.map((cell, c) => {
          const isClearing = rowSet.has(r) || colSet.has(c);
          const fallAnim = fallAnims[r * BOARD_COLS + c];

          return (
            <Animated.View
              key={`${r}-${c}`}
              style={[
                styles.cell,
                { width: cellSize, height: cellSize },
                cell.filled
                  ? { backgroundColor: cell.color ?? '#a78bfa' }
                  : styles.cellEmpty,
                { transform: [{ translateY: fallAnim }] },
              ]}
            >
              {cell.filled ? (
                <>
                  <View style={styles.cellHighlight} />
                  <View style={styles.cellSheen} />
                </>
              ) : (
                <View style={styles.cellInner} />
              )}
              {isClearing && clearFlash ? (
                <Animated.View
                  style={[StyleSheet.absoluteFill, styles.flashOverlay, { opacity: clearFlash }]}
                />
              ) : null}
            </Animated.View>
          );
        }),
      )}

      {/* Drag preview ghost — geçerli: yeşil, geçersiz: kırmızı */}
      {dragPreview && dragPreview.piece.shape.map((shapeRow, r) =>
        shapeRow.map((v, c) => {
          if (!v) return null;
          const { row: pr, col: pc, isValid } = dragPreview;
          return (
            <View
              key={`ghost-${r}-${c}`}
              style={{
                position: 'absolute',
                top: (pr + r) * step,
                left: (pc + c) * step,
                width: cellSize,
                height: cellSize,
                borderRadius: 4,
                backgroundColor: isValid ? 'rgba(74,222,128,0.22)' : 'rgba(248,113,113,0.22)',
                borderWidth: 1.5,
                borderColor: isValid ? '#4ade80' : '#f87171',
              }}
            />
          );
        })
      )}

      {/* Düşen engel bloğu */}
      {fallingObstacle && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: obsCol * step,
            width: cellSize,
            height: cellSize,
            backgroundColor: fallingObstacle.color,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            transform: [{ translateY: obstacleAnimY }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.6,
            shadowRadius: 4,
            elevation: 6,
          }}
        >
          {/* Çizgi desen — obstacle olduğu okunabilsin */}
          <View style={styles.obstacleStripe} />
        </Animated.View>
      )}

      {/* Aktif parça overlay */}
      {fallingPiece && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: animX }, { translateY: animY }] },
          ]}
        >
          {fallingPiece.piece.shape.map((shapeRow, r) =>
            shapeRow.map((v, c) => {
              if (!v) return null;
              return (
                <View
                  key={`${r}-${c}`}
                  style={[
                    styles.pieceCell,
                    {
                      width: cellSize,
                      height: cellSize,
                      top: r * step,
                      left: c * step,
                      backgroundColor: fallingPiece.piece.color,
                      shadowColor: fallingPiece.piece.color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.75,
                      shadowRadius: 6,
                      elevation: 7,
                    },
                  ]}
                >
                  <View style={styles.pieceCellHighlight} />
                  <View style={styles.cellSheen} />
                </View>
              );
            }),
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  cellEmpty: {
    backgroundColor: '#0a0a16',
    borderWidth: 0.5,
    borderColor: '#16162a',
  },
  cellInner: {
    flex: 1,
    margin: 2,
    borderRadius: 2,
    backgroundColor: '#0d0d1f',
  },
  cellHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '40%',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.17)',
  },
  cellSheen: {
    position: 'absolute',
    bottom: 0,
    left: 1,
    right: 1,
    height: '30%',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  pieceCell: {
    position: 'absolute',
    borderRadius: 4,
    overflow: 'hidden',
  },
  pieceCellHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '45%',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  flashOverlay: {
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  obstacleStripe: {
    position: 'absolute',
    top: '30%',
    left: 2,
    right: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
