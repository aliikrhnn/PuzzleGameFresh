import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GameManager } from '../game/GameManager';
import type { GameState } from '../game/GameState';
import { Grid } from '../components/Grid';
import { PiecePreviewRows } from '../components/PiecePreview';
import { useAnimations } from '../hooks/useAnimations';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

export function GameScreen({ navigation }: Props) {
  const [gs, setGs] = useState<GameState>(GameManager.getState());
  const [clearedRows, setClearedRows] = useState<number[]>([]);
  const [clearedCols, setClearedCols] = useState<number[]>([]);
  const prevStatus = useRef(gs.gameStatus);
  const prevPieceId = useRef(gs.currentPiece?.id);

  const {
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
  } = useAnimations();

  // GameManager'a abone ol
  useEffect(() => GameManager.subscribe(setGs), []);

  // Ekran unmount olunca zamanlayıcıyı durdur
  useEffect(() => {
    return () => {
      const s = GameManager.getState();
      if (s.gameStatus === 'playing' || s.gameStatus === 'paused') {
        GameManager.end();
      }
    };
  }, []);

  // Game over animasyonu
  useEffect(() => {
    if (gs.gameStatus === 'gameover' && prevStatus.current !== 'gameover') {
      animateGameOver();
    }
    prevStatus.current = gs.gameStatus;
  }, [gs.gameStatus]);

  // Parça kilitlenince (yeni parça spawn) — place animasyonu
  useEffect(() => {
    if (gs.currentPiece?.id && gs.currentPiece.id !== prevPieceId.current) {
      prevPieceId.current = gs.currentPiece.id;
      if (gs.gameStatus === 'playing') animatePlace();
    }
  }, [gs.currentPiece?.id]);

  // Satır/sütun temizlenince flash animasyonu
  useEffect(() => {
    if (!gs.lastClear) return;
    const { clearedRows: rows, clearedCols: cols } = gs.lastClear;
    setClearedRows(rows);
    setClearedCols(cols);
    animateClear(gs.combo);
    const t = setTimeout(() => {
      setClearedRows([]);
      setClearedCols([]);
    }, 300);
    return () => clearTimeout(t);
  }, [gs.lastClear]);

  // Üst 3 satırda dolu hücre varsa tehlike
  const isDanger = gs.board.slice(0, 3).some(row => row.some(cell => cell.filled));

  useEffect(() => {
    if (isDanger && gs.gameStatus === 'playing') startDanger();
    else stopDanger();
  }, [isDanger, gs.gameStatus]);

  const isGameOver = gs.gameStatus === 'gameover';
  const isPaused = gs.gameStatus === 'paused';

  const fallingPiece =
    gs.currentPiece && gs.currentPosition
      ? { piece: gs.currentPiece, row: gs.currentPosition.row, col: gs.currentPosition.col }
      : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Üst bar ── */}
        <View style={styles.topBar}>
          <View style={styles.statsGroup}>
            <StatCard label="SKOR" value={gs.score} accent />
            <View style={styles.statRow}>
              <StatCard label="SEVİYE" value={gs.level} />
              <StatCard label="COMBO" value={gs.combo} hot={gs.combo >= 3} />
            </View>
            <View style={styles.statRow}>
              <StatCard label="SÜRE" value={gs.elapsedSeconds} formatter={formatTime} />
            </View>
          </View>
          <View style={styles.nextBox}>
            <Text style={styles.nextLabel}>SIRADAKI</Text>
            {gs.nextPiece && <PiecePreviewRows piece={gs.nextPiece} label="" />}
          </View>
        </View>

        {/* ── Board ── */}
        <View style={styles.boardWrap}>
          <Animated.View
            style={{
              transform: [
                { translateX: gameOverShake },
                { translateX: comboShake },
                { scale: comboScale },
              ],
            }}
          >
            <Grid
              board={gs.board}
              clearedRows={clearedRows}
              clearedCols={clearedCols}
              clearFlash={clearFlash}
              fallingPiece={isGameOver ? undefined : fallingPiece}
              fallDistances={gs.lastClear?.fallDistances}
            />
          </Animated.View>

          {/* Danger overlay — board dolmaya yaklaşınca kırmızı nabız */}
          <Animated.View
            pointerEvents="none"
            style={[styles.dangerOverlay, { opacity: dangerPulse }]}
          />

          {/* Combo badge — opacity ile kontrol edilir, her zaman mount */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.comboBadge,
              { opacity: comboBadgeOpacity, transform: [{ scale: comboBadgeScale }] },
            ]}
          >
            <View style={[styles.comboBadgePill, gs.combo >= 3 && styles.comboBadgePillHot]}>
              <Text
                style={[
                  styles.comboBadgeText,
                  gs.combo >= 3 && styles.comboBadgeTextHot,
                ]}
              >
                ×{gs.combo} COMBO
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
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => GameManager.togglePause()}
              >
                <Text style={styles.btnPrimaryText}>Devam Et</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Kontroller ── */}
        {!isGameOver && (
          <View style={styles.controls}>
            {/* Yön + döndür */}
            <View style={styles.ctrlRow}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => GameManager.moveLeft()}>
                <Text style={styles.ctrlText}>◀</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctrlBtn}
                onPress={() => GameManager.rotateCurrent()}
              >
                <Text style={styles.ctrlText}>↻</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => GameManager.moveRight()}>
                <Text style={styles.ctrlText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Hard drop */}
            <View style={styles.ctrlRow}>
              <Animated.View style={{ transform: [{ scale: placeFeedback }] }}>
                <TouchableOpacity
                  style={[styles.ctrlBtn, styles.ctrlBtnWide]}
                  onPress={() => GameManager.hardDrop()}
                >
                  <Text style={styles.ctrlText}>⬇⬇ BIRAK</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Duraklat / Bitir */}
            <View style={styles.ctrlRow}>
              <TouchableOpacity
                style={styles.btnEnd}
                onPress={() => GameManager.togglePause()}
              >
                <Text style={styles.btnEndText}>{isPaused ? 'Devam' : 'Duraklat'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnEnd, styles.btnEndDanger]}
                onPress={() => GameManager.end()}
              >
                <Text style={styles.btnEndText}>Bitir</Text>
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
        style={[
          styles.statValue,
          accent && styles.statValueAccent,
          hot && styles.statValueHot,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatter ? formatter(value) : value.toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },

  /* Üst bar */
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statsGroup: { gap: 6, flex: 1, marginRight: 12 },
  statRow: { flexDirection: 'row', gap: 6 },
  statCard: {
    backgroundColor: '#13131f',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#1e1e2e',
    maxWidth: 120,
    minWidth: 56,
  },
  statCardAccent: { borderColor: '#4c1d95', backgroundColor: '#12052e' },
  statCardHot: { borderColor: '#92400e', backgroundColor: '#1c0a00' },
  statLabel: { color: '#555', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  statValue: { color: '#c4b5fd', fontSize: 18, fontWeight: '700', marginTop: 1 },
  statValueAccent: { color: '#a78bfa', fontSize: 24 },
  statValueHot: { color: '#fb923c' },

  /* Next piece */
  nextBox: {
    backgroundColor: '#13131f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e1e2e',
    padding: 8,
    alignItems: 'center',
    minWidth: 80,
    gap: 4,
  },
  nextLabel: { color: '#555', fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  /* Board */
  boardWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },

  /* Danger overlay */
  dangerOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: '#ef4444',
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.10)',
  },

  /* Combo badge */
  comboBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboBadgePill: {
    backgroundColor: 'rgba(12,4,30,0.90)',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: '#7c3aed',
  },
  comboBadgePillHot: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(30,10,0,0.90)',
  },
  comboBadgeText: {
    color: '#c4b5fd',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    textShadowColor: '#7c3aed',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  comboBadgeTextHot: {
    color: '#fbbf24',
    textShadowColor: '#f59e0b',
  },

  /* Overlays */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,20,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  overlayTitle: {
    color: '#f87171',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 3,
  },
  pauseTitle: {
    color: '#a78bfa',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  overlayScore: {
    color: '#f0f0f0',
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
  },
  overlayHigh: { color: '#555', fontSize: 13, marginBottom: 12 },

  /* Butonlar */
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

  /* Kontroller */
  controls: { width: '100%', gap: 8 },
  ctrlRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  ctrlBtn: {
    backgroundColor: '#13131f',
    borderWidth: 1,
    borderColor: '#2a1a4e',
    borderRadius: 10,
    width: 68,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnWide: { width: 160 },
  ctrlText: { color: '#a78bfa', fontSize: 20, fontWeight: '700' },
  btnEnd: {
    borderWidth: 1,
    borderColor: '#2a1a4e',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  btnEndDanger: { borderColor: '#4a1a1a' },
  btnEndText: { color: '#6d28d9', fontSize: 14, fontWeight: '600' },
});
