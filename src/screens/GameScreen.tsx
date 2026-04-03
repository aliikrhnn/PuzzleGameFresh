import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GameManager } from '../game/GameManager';
import type { GameState } from '../game/GameState';
import { BOARD_COLS, BOARD_ROWS } from '../game/GameState';
import { canPlace } from '../game/GameLogic';
import { Grid } from '../components/Grid';
import { useAnimations } from '../hooks/useAnimations';
import { TutorialOverlay, TUTORIAL_KEY } from './TutorialScreen';
import { Haptics } from '../utils/haptics';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

const GAP = 3;

export function GameScreen({ navigation }: Props) {
  const [gs, setGs] = useState<GameState>(GameManager.getState());
  const [clearedRows, setClearedRows] = useState<number[]>([]);
  const [clearedCols, setClearedCols] = useState<number[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const prevStatus = useRef(gs.gameStatus);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const activeDragIndexRef = useRef<number | null>(null);

  const [previewPos, setPreviewPos] = useState<{
    row: number; col: number; isValid: boolean;
  } | null>(null);
  const previewPosRef = useRef<{ row: number; col: number; isValid: boolean } | null>(null);
  const gridMeasures = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const gridContainerRef = useRef<View>(null);

  // gs için stable ref (PanResponder closure'larında stale olmasın)
  const gsRef = useRef(gs);
  useEffect(() => { gsRef.current = gs; }, [gs]);

  // cellSize — Grid ile aynı formül
  const { width: screenWidth } = useWindowDimensions();
  const PADDING = 32;
  const cellSize = Math.floor((screenWidth - PADDING - GAP * (BOARD_COLS - 1)) / BOARD_COLS);
  const step = cellSize + GAP;
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // ── Animasyonlar ────────────────────────────────────────────────────────────
  const {
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
  } = useAnimations();

  // Drag animasyonu (seçili parça parmağı takip eder)
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // ── Grid ölçümü ─────────────────────────────────────────────────────────────
  const measureGrid = useCallback(() => {
    setTimeout(() => {
      gridContainerRef.current?.measureInWindow((x, y, w, h) => {
        gridMeasures.current = { x, y, width: w, height: h };
      });
    }, 150);
  }, []);

  // ── PanResponder fabrikası (slot başına bir tane, bir kez oluşturulur) ──────
  const panResponders = useRef(
    [0, 1, 2].map(slotIndex =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          gsRef.current.gameStatus === 'playing' &&
          !!gsRef.current.piecePool[slotIndex],
        onMoveShouldSetPanResponder: () =>
          gsRef.current.gameStatus === 'playing' &&
          !!gsRef.current.piecePool[slotIndex],

        onPanResponderGrant: () => {
          pan.setValue({ x: 0, y: 0 });
          activeDragIndexRef.current = slotIndex;
          setActiveDragIndex(slotIndex);
          GameManager.selectPiece(slotIndex);
          Haptics.pickup();
        },

        onPanResponderMove: (_, gestureState) => {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });

          const grid = gridMeasures.current;
          const piece = gsRef.current.piecePool[slotIndex];
          if (!grid || !piece) return;

          const s = stepRef.current;
          const pCols = piece.shape[0].length;
          const pRows = piece.shape.length;
          // boardWrap borderWidth (1px) hücre başlangıcını kaydırır
          const relX = gestureState.moveX - grid.x - 1;
          const relY = gestureState.moveY - grid.y - 1;

          // Parçanın görsel merkezini parmağa hizala.
          // Gerçek görsel genişlik = pCols*step - GAP (son sütunun sağında gap yok)
          const rawCol = Math.floor((relX - (pCols * s - GAP) / 2) / s);
          const rawRow = Math.floor((relY - (pRows * s - GAP) / 2) / s);

          const inGrid =
            relX > -pCols * s && relX < grid.width + pCols * s &&
            relY > -pRows * s && relY < grid.height + pRows * s;

          if (!inGrid) {
            if (previewPosRef.current) { previewPosRef.current = null; setPreviewPos(null); }
            return;
          }

          const col = Math.max(0, Math.min(BOARD_COLS - pCols, rawCol));
          const row = Math.max(0, Math.min(BOARD_ROWS - pRows, rawRow));

          const prev = previewPosRef.current;
          if (!prev || prev.row !== row || prev.col !== col) {
            const isValid = canPlace(gsRef.current.board, piece, row, col);
            const next = { row, col, isValid };
            previewPosRef.current = next;
            setPreviewPos(next);
          }
        },

        onPanResponderRelease: () => {
          const prev = previewPosRef.current;
          previewPosRef.current = null;
          setPreviewPos(null);
          activeDragIndexRef.current = null;
          setActiveDragIndex(null);

          if (prev?.isValid) {
            const placed = GameManager.placeAt(prev.row, prev.col);
            if (placed) {
              pan.setValue({ x: 0, y: 0 });
              animatePlace();
              return;
            }
          }
          // Geçersiz: negatif feedback + yay ile geri dön
          Haptics.invalid();
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            tension: 150,
            friction: 8,
          }).start();
        },

        onPanResponderTerminate: () => {
          previewPosRef.current = null;
          setPreviewPos(null);
          activeDragIndexRef.current = null;
          setActiveDragIndex(null);
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    ),
  ).current;

  // ── İlk açılış tutorial kontrolü ────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(TUTORIAL_KEY)
      .then(seen => { if (!seen) setShowTutorial(true); })
      .catch(() => {});
  }, []);

  // ── Subscriber ──────────────────────────────────────────────────────────────
  useEffect(() => GameManager.subscribe(setGs), []);

  useEffect(() => {
    return () => {
      const s = GameManager.getState();
      if (s.gameStatus === 'playing' || s.gameStatus === 'paused') GameManager.end();
    };
  }, []);

  // Game over animasyonu
  useEffect(() => {
    if (gs.gameStatus === 'gameover' && prevStatus.current !== 'gameover') animateGameOver();
    prevStatus.current = gs.gameStatus;
  }, [gs.gameStatus]);

  // Clear sonrası flash + falling
  useEffect(() => {
    if (!gs.lastClear) return;
    const { clearedRows: rows, clearedCols: cols } = gs.lastClear;
    setClearedRows(rows);
    setClearedCols(cols);
    animateClear(gs.combo);
    const t = setTimeout(() => { setClearedRows([]); setClearedCols([]); }, 300);
    return () => clearTimeout(t);
  }, [gs.lastClear]);

  // Obstacle landing tespiti: fallingObstacle non-null → null geçişi
  const prevObstacleRef = useRef(gs.fallingObstacle);
  useEffect(() => {
    const wasActive = prevObstacleRef.current !== null;
    prevObstacleRef.current = gs.fallingObstacle;
    if (wasActive && gs.fallingObstacle === null && gs.gameStatus === 'playing') {
      animateObstacleLand();
    }
  }, [gs.fallingObstacle]);

  // Tehlike (üst 3 satır dolu)
  const isDanger = gs.board.slice(0, 3).some(row => row.some(cell => cell.filled));
  useEffect(() => {
    if (isDanger && gs.gameStatus === 'playing') startDanger();
    else stopDanger();
  }, [isDanger, gs.gameStatus]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const isGameOver = gs.gameStatus === 'gameover';
  const isPaused = gs.gameStatus === 'paused';

  // Sürüklenen parça grid'e ghost önizleme için
  const activePiece = activeDragIndex !== null ? gs.piecePool[activeDragIndex] : null;
  const dragPreview = previewPos && activePiece
    ? { piece: activePiece, ...previewPos }
    : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      {showTutorial && <TutorialOverlay onDone={() => setShowTutorial(false)} />}
      <View style={styles.container}>

        {/* ── Üst bar ── */}
        <View style={styles.topBar}>
          <StatCard label="SKOR" value={gs.score} accent />
          <StatCard label="SEVİYE" value={gs.level} />
          <StatCard label="COMBO" value={gs.combo} hot={gs.combo >= 3} />
          <StatCard label="SÜRE" value={gs.elapsedSeconds} formatter={formatTime} />
        </View>

        {/* ── Board ── */}
        <View
          ref={gridContainerRef}
          style={styles.boardWrap}
          onLayout={measureGrid}
        >
          <Animated.View
            style={{
              transform: [
                { translateX: gameOverShake },
                { translateX: comboShake },
                { translateY: obstacleImpact },
                { scale: placeFeedback },
                { scale: comboScale },
              ],
            }}
          >
            <Grid
              board={gs.board}
              clearedRows={clearedRows}
              clearedCols={clearedCols}
              clearFlash={clearFlash}
              fallDistances={gs.lastClear?.fallDistances}
              dragPreview={dragPreview}
              fallingObstacle={gs.fallingObstacle}
            />
          </Animated.View>

          {/* Clear glow — board-level purple flash */}
          <Animated.View
            pointerEvents="none"
            style={[styles.clearGlowOverlay, { opacity: clearGlow }]}
          />

          {/* Danger overlay */}
          <Animated.View
            pointerEvents="none"
            style={[styles.dangerOverlay, { opacity: dangerPulse }]}
          />

          {/* Combo badge */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.comboBadge,
              { opacity: comboBadgeOpacity, transform: [{ scale: comboBadgeScale }] },
            ]}
          >
            <View style={[styles.comboBadgePill, gs.combo >= 3 && styles.comboBadgePillHot]}>
              <Text style={[styles.comboBadgeText, gs.combo >= 3 && styles.comboBadgeTextHot]}>
                {gs.combo <= 1 ? 'CLEARED' : `×${gs.combo} COMBO`}
              </Text>
            </View>
          </Animated.View>

          {/* Game over overlay */}
          {isGameOver && (
            <View style={styles.overlay}>
              <Text style={styles.overlayTitle}>GAME OVER</Text>
              <Text style={styles.overlayScore}>{gs.score.toLocaleString()}</Text>
              <Text style={styles.overlayHigh}>
                En iyi · {GameManager.getHighScore()?.toLocaleString() ?? '—'}
              </Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => GameManager.start()}>
                <Text style={styles.btnPrimaryText}>Tekrar Oyna</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.btnGhost}>Ana Menü</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pause overlay */}
          {isPaused && (
            <View style={styles.overlay}>
              <Text style={styles.pauseTitle}>DURAKLADI</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => GameManager.togglePause()}>
                <Text style={styles.btnPrimaryText}>Devam Et</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Parça Tepsisi ── */}
        {!isGameOver && (
          <View style={styles.tray}>

            {/* Döndür (seçili parçayı) */}
            <TouchableOpacity style={styles.trayBtn} onPress={() => GameManager.rotateCurrent()}>
              <Text style={styles.trayBtnText}>↻</Text>
            </TouchableOpacity>

            {/* 3 sürüklenebilir parça */}
            <View style={styles.trayPieces}>
              {gs.piecePool.map((piece, slotIndex) => {
                const isDraggingThis = activeDragIndex === slotIndex;
                const isSelected = gs.selectedPieceIndex === slotIndex;
                const pCols = piece.shape[0].length;
                const pRows = piece.shape.length;
                const pW = pCols * step - GAP;
                const pH = pRows * step - GAP;

                return (
                  <Animated.View
                    key={piece.id}
                    {...panResponders[slotIndex].panHandlers}
                    style={[
                      styles.traySlot,
                      isSelected && !isDraggingThis && styles.traySlotSelected,
                      {
                        width: pW,
                        height: pH,
                        opacity: activeDragIndex !== null && !isDraggingThis ? 0.45 : 1,
                        transform: isDraggingThis
                          ? [{ translateX: pan.x }, { translateY: pan.y }]
                          : [],
                      },
                    ]}
                  >
                    {piece.shape.map((row, r) =>
                      row.map((cell, c) => {
                        if (!cell) return null;
                        return (
                          <View
                            key={`${r}-${c}`}
                            style={{
                              position: 'absolute',
                              top: r * step,
                              left: c * step,
                              width: cellSize,
                              height: cellSize,
                              backgroundColor: piece.color,
                              borderRadius: 4,
                              shadowColor: piece.color,
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: isDraggingThis ? 0.75 : isSelected ? 0.55 : 0.3,
                              shadowRadius: isDraggingThis ? 8 : 4,
                              elevation: isDraggingThis ? 10 : isSelected ? 6 : 3,
                            }}
                          />
                        );
                      })
                    )}
                  </Animated.View>
                );
              })}
            </View>

            {/* Duraklat / Bitir */}
            <View style={styles.trayActions}>
              <TouchableOpacity style={styles.trayBtn} onPress={() => GameManager.togglePause()}>
                <Text style={styles.trayBtnText}>{isPaused ? '▶' : '⏸'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.trayBtn, styles.trayBtnDanger]}
                onPress={() => GameManager.end()}
              >
                <Text style={[styles.trayBtnText, { color: '#ef4444' }]}>✕</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StatCard({
  label,
  value,
  accent,
  hot,
  formatter,
}: {
  label: string;
  value: number;
  accent?: boolean;
  hot?: boolean;
  formatter?: (v: number) => string;
}) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent, hot && styles.statCardHot]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, accent && styles.statValueAccent, hot && styles.statValueHot]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatter ? formatter(value) : value.toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a14' },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },

  /* Üst bar — yatay sıra */
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#13131f',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#1e1e2e',
    alignItems: 'center',
  },
  statCardAccent: { borderColor: '#4c1d95', backgroundColor: '#12052e' },
  statCardHot: { borderColor: '#92400e', backgroundColor: '#1c0a00' },
  statLabel: { color: '#555', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  statValue: { color: '#c4b5fd', fontSize: 16, fontWeight: '700', marginTop: 1 },
  statValueAccent: { color: '#a78bfa', fontSize: 20 },
  statValueHot: { color: '#fb923c' },

  /* Board */
  boardWrap: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#1e1e2e' },

  /* Clear glow */
  clearGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    backgroundColor: '#a855f7', // purple-500
  },

  /* Danger */
  dangerOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: '#ef4444',
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.10)',
  },

  /* Combo badge */
  comboBadge: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  comboBadgePill: {
    backgroundColor: 'rgba(12,4,30,0.90)',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: '#7c3aed',
  },
  comboBadgePillHot: { borderColor: '#f59e0b', backgroundColor: 'rgba(30,10,0,0.90)' },
  comboBadgeText: {
    color: '#c4b5fd',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    textShadowColor: '#7c3aed',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  comboBadgeTextHot: { color: '#fbbf24', textShadowColor: '#f59e0b' },

  /* Overlays */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,20,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  overlayTitle: { color: '#f87171', fontSize: 28, fontWeight: '800', letterSpacing: 3 },
  pauseTitle: { color: '#a78bfa', fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  overlayScore: { color: '#f0f0f0', fontSize: 40, fontWeight: '700', lineHeight: 44 },
  overlayHigh: { color: '#555', fontSize: 13, marginBottom: 12 },
  btnPrimary: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhost: { color: '#444', fontSize: 14, paddingVertical: 8 },

  /* Parça tepsisi */
  tray: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  trayPieces: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  traySlot: {
    position: 'relative',
  },
  traySlotSelected: {
    // Seçili parça: hafif parlak çerçeve efekti
    borderRadius: 6,
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  trayBtn: {
    backgroundColor: '#13131f',
    borderWidth: 1,
    borderColor: '#2a1a4e',
    borderRadius: 10,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayBtnDanger: { borderColor: '#4a1a1a' },
  trayBtnText: { color: '#a78bfa', fontSize: 22, fontWeight: '700' },
  trayActions: { gap: 8, alignItems: 'center' },
});
