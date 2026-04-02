import type { GameState } from './GameState';
import { BOARD_COLS } from './GameState';
import {
  createEmptyBoard,
  createRandomPiece,
  resetBag,
  canPlace,
  placePiece,
  clearFullLines,
  calculateScore,
  shouldLevelUp,
  rotatePiece,
} from './GameLogic';
import { HighScoreStorage } from './HighScoreStorage';

// Otomatik düşme aralığı (ms) — seviye ve geçen süreye göre hızlanır
function dropInterval(level: number, seconds: number): number {
  const timeTier = Math.floor(seconds / 20); // her 20 saniyede +1 tier
  return Math.max(100, 800 - (level - 1) * 60 - timeTier * 25);
}

// Parçanın board'a ortalanmış başlangıç sütunu
function spawnCol(shape: number[][]): number {
  return Math.floor((BOARD_COLS - shape[0].length) / 2);
}

function makeInitialState(): GameState {
  return {
    gameStatus: 'idle',
    score: 0,
    level: 1,
    combo: 0,
    currentPiece: null,
    currentPosition: null,
    nextPiece: null,
    board: createEmptyBoard(),
    lastClear: null,
    elapsedSeconds: 0,
  };
}

let state: GameState = makeInitialState();
let highScore: number | null = null;
let dropTimer: ReturnType<typeof setInterval> | null = null;
let timeTimer: ReturnType<typeof setInterval> | null = null;

type Listener = (s: GameState) => void;
const listeners = new Set<Listener>();

function notify() {
  const pos = state.currentPosition;
  listeners.forEach(fn =>
    fn({ ...state, currentPosition: pos ? { ...pos } : null }),
  );
}

function clearTimer() {
  if (dropTimer !== null) {
    clearInterval(dropTimer);
    dropTimer = null;
  }
  if (timeTimer !== null) {
    clearInterval(timeTimer);
    timeTimer = null;
  }
}

function startTimer() {
  clearTimer();
  dropTimer = setInterval(stepDown, dropInterval(state.level, state.elapsedSeconds));
  timeTimer = setInterval(tickTime, 1000);
}

function tickTime() {
  if (state.gameStatus !== 'playing') return;
  const prevTier = Math.floor(state.elapsedSeconds / 20);
  state.elapsedSeconds += 1;
  const newTier = Math.floor(state.elapsedSeconds / 20);
  // Tempo tier değiştiyse drop hızını güncelle
  if (newTier !== prevTier) {
    if (dropTimer !== null) {
      clearInterval(dropTimer);
    }
    dropTimer = setInterval(stepDown, dropInterval(state.level, state.elapsedSeconds));
  }
  notify();
}

function updateHighScore(score: number) {
  if (highScore === null || score > highScore) {
    highScore = score;
    HighScoreStorage.save(score);
  }
}

// Aktif parçayı board'a sabitler, satırları temizler, skoru günceller
function lockPiece() {
  const { currentPiece, currentPosition, board, level } = state;
  if (!currentPiece || !currentPosition) return;

  const placed = placePiece(board, currentPiece, currentPosition.row, currentPosition.col);
  const { board: cleared, linesCleared, clearedRows, clearedCols, fallDistances } = clearFullLines(placed);

  state.board = cleared;
  state.lastClear = linesCleared > 0 ? { clearedRows, clearedCols, fallDistances } : null;
  state.combo = linesCleared > 0 ? state.combo + 1 : 0;
  state.score += calculateScore(linesCleared, level, Math.max(state.combo, 1));
  if (shouldLevelUp(state.score, state.level)) {
    state.level += 1;
    if (dropTimer !== null) clearInterval(dropTimer);
    dropTimer = setInterval(stepDown, dropInterval(state.level, state.elapsedSeconds)); // yeni seviye hızıyla
  }
}

// Sıradaki parçayı tepeden spawn eder; yer yoksa false döner (game over)
function spawnNext(): boolean {
  const piece = state.nextPiece!;
  const col = spawnCol(piece.shape);
  if (!canPlace(state.board, piece, 0, col)) return false;
  state.currentPiece = piece;
  state.currentPosition = { row: 0, col };
  state.nextPiece = createRandomPiece();
  return true;
}

// Bir adım aşağı; blokluysa kilitle ve yeni parça spawn et
function stepDown() {
  const { currentPiece, currentPosition, board, gameStatus } = state;
  if (gameStatus !== 'playing' || !currentPiece || !currentPosition) return;

  const nextRow = currentPosition.row + 1;
  if (canPlace(board, currentPiece, nextRow, currentPosition.col)) {
    state.currentPosition = { row: nextRow, col: currentPosition.col };
    notify();
  } else {
    lockPiece();
    const ok = spawnNext();
    if (!ok) {
      clearTimer();
      updateHighScore(state.score);
      state.gameStatus = 'gameover';
    }
    notify();
  }
}

export const GameManager = {
  getState(): GameState {
    const pos = state.currentPosition;
    return { ...state, currentPosition: pos ? { ...pos } : null };
  },

  getHighScore(): number | null {
    return highScore;
  },

  async loadHighScore(): Promise<void> {
    highScore = await HighScoreStorage.load();
    notify();
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  start() {
    clearTimer();
    resetBag();
    const first = createRandomPiece();
    const second = createRandomPiece();
    state = {
      gameStatus: 'playing',
      score: 0,
      level: 1,
      combo: 0,
      currentPiece: first,
      currentPosition: { row: 0, col: spawnCol(first.shape) },
      nextPiece: second,
      board: createEmptyBoard(),
      lastClear: null,
      elapsedSeconds: 0,
    };
    startTimer();
    notify();
  },

  togglePause() {
    if (state.gameStatus === 'playing') {
      state.gameStatus = 'paused';
      clearTimer();
    } else if (state.gameStatus === 'paused') {
      state.gameStatus = 'playing';
      startTimer();
    }
    notify();
  },

  end() {
    clearTimer();
    updateHighScore(state.score);
    state.gameStatus = 'gameover';
    notify();
  },

  moveLeft() {
    const { currentPiece, currentPosition, board, gameStatus } = state;
    if (gameStatus !== 'playing' || !currentPiece || !currentPosition) return;
    const newCol = currentPosition.col - 1;
    if (canPlace(board, currentPiece, currentPosition.row, newCol)) {
      state.currentPosition = { row: currentPosition.row, col: newCol };
      notify();
    }
  },

  moveRight() {
    const { currentPiece, currentPosition, board, gameStatus } = state;
    if (gameStatus !== 'playing' || !currentPiece || !currentPosition) return;
    const newCol = currentPosition.col + 1;
    if (canPlace(board, currentPiece, currentPosition.row, newCol)) {
      state.currentPosition = { row: currentPosition.row, col: newCol };
      notify();
    }
  },

  softDrop() {
    if (state.gameStatus !== 'playing') return;
    const { currentPiece, currentPosition, board } = state;
    // Parça aşağı hareket edebiliyorsa +1 skor bonusu (stepDown'dan önce)
    if (currentPiece && currentPosition &&
        canPlace(board, currentPiece, currentPosition.row + 1, currentPosition.col)) {
      state.score += 1;
    }
    stepDown();
  },

  hardDrop() {
    const { currentPiece, currentPosition, board, gameStatus } = state;
    if (gameStatus !== 'playing' || !currentPiece || !currentPosition) return;
    let row = currentPosition.row;
    while (canPlace(board, currentPiece, row + 1, currentPosition.col)) {
      row++;
    }
    state.currentPosition = { row, col: currentPosition.col };
    stepDown(); // en alt konumda çağrıldığında kilitleme tetiklenir
  },

  rotateCurrent(): boolean {
    const { currentPiece, currentPosition, board, gameStatus } = state;
    if (gameStatus !== 'playing' || !currentPiece || !currentPosition) return false;
    const rotated = rotatePiece(currentPiece);
    // Önce yerinde dene, ardından wall-kick (±1, ±2 sütun)
    for (const kick of [0, -1, 1, -2, 2]) {
      const newCol = currentPosition.col + kick;
      if (canPlace(board, rotated, currentPosition.row, newCol)) {
        state.currentPiece = rotated;
        state.currentPosition = { ...currentPosition, col: newCol };
        notify();
        return true;
      }
    }
    return false;
  },
};
