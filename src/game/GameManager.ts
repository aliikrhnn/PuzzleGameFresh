import type { GameState } from './GameState';
import { BOARD_COLS, BOARD_ROWS } from './GameState';
import {
  createEmptyBoard,
  createRandomPiece,
  resetBag,
  canPlace,
  placePiece,
  clearFullLines,
  calculateScore,
  shouldLevelUp,
  hasAnyValidPlacement,
} from './GameLogic';
import { HighScoreStorage } from './HighScoreStorage';

// ── Zorluk formülleri ──────────────────────────────────────────────────────
// Obstacle spawn aralığı (ms): başlangıç 9s, level/zaman ile 3s'ye iner
function obstacleSpawnDelay(level: number, seconds: number): number {
  const timeTier = Math.floor(seconds / 30); // her 30s bir tier
  return Math.max(3000, 9000 - (level - 1) * 700 - timeTier * 350);
}

// Obstacle düşüş hızı (ms/satır): başlangıç 380ms, level ile 120ms'ye iner
function obstacleDropSpeed(level: number): number {
  return Math.max(120, 380 - (level - 1) * 25);
}

const OBSTACLE_COLOR = '#4a4a6a'; // muted purple-gray, piece renklerinden farklı

// ── State & Timer'lar ──────────────────────────────────────────────────────
let state: GameState = makeInitialState();
let highScore: number | null = null;
let timeTimer: ReturnType<typeof setInterval> | null = null;
let obstacleSpawnTimer: ReturnType<typeof setTimeout> | null = null;
let obstacleMoveTimer: ReturnType<typeof setInterval> | null = null;

type Listener = (s: GameState) => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => fn({ ...state, piecePool: [...state.piecePool] }));
}

function clearAllTimers() {
  if (timeTimer !== null) { clearInterval(timeTimer); timeTimer = null; }
  if (obstacleSpawnTimer !== null) { clearTimeout(obstacleSpawnTimer); obstacleSpawnTimer = null; }
  if (obstacleMoveTimer !== null) { clearInterval(obstacleMoveTimer); obstacleMoveTimer = null; }
}

function makeInitialState(): GameState {
  return {
    gameStatus: 'idle',
    score: 0,
    level: 1,
    combo: 0,
    piecePool: [],
    selectedPieceIndex: 0,
    board: createEmptyBoard(),
    lastClear: null,
    elapsedSeconds: 0,
    fallingObstacle: null,
  };
}

function tickTime() {
  if (state.gameStatus !== 'playing') return;
  state.elapsedSeconds += 1;
  notify();
}

function updateHighScore(score: number) {
  if (highScore === null || score > highScore) {
    highScore = score;
    HighScoreStorage.save(score);
  }
}

// ── Obstacle sistemi ───────────────────────────────────────────────────────

// Bir sonraki obstacle'ı zamanla (mevcut seviye/süreye göre)
function scheduleNextObstacle() {
  if (obstacleSpawnTimer !== null) clearTimeout(obstacleSpawnTimer);
  obstacleSpawnTimer = setTimeout(() => {
    obstacleSpawnTimer = null;
    spawnObstacle();
  }, obstacleSpawnDelay(state.level, state.elapsedSeconds));
}

// Rastgele sütunda obstacle spawn et
function spawnObstacle() {
  if (state.gameStatus !== 'playing') return;
  if (state.fallingObstacle) return; // zaten aktif bir obstacle var

  // Uygun sütun bul (üstü boş olan sütunlar arasından rastgele)
  const freeCols: number[] = [];
  for (let c = 0; c < BOARD_COLS; c++) {
    if (!state.board[0][c].filled) freeCols.push(c);
  }
  if (freeCols.length === 0) {
    // Üst sıra tamamen dolu — yakında game over zaten, spawn etme
    scheduleNextObstacle();
    return;
  }

  const col = freeCols[Math.floor(Math.random() * freeCols.length)];
  state.fallingObstacle = { col, row: 0, color: OBSTACLE_COLOR };

  // Düşüş timer'ını başlat
  if (obstacleMoveTimer !== null) clearInterval(obstacleMoveTimer);
  obstacleMoveTimer = setInterval(moveObstacleDown, obstacleDropSpeed(state.level));

  notify();
}

// Obstacle'ı 1 satır aşağı taşı
function moveObstacleDown() {
  if (!state.fallingObstacle || state.gameStatus !== 'playing') return;

  const { col, row } = state.fallingObstacle;
  const nextRow = row + 1;

  if (nextRow < BOARD_ROWS && !state.board[nextRow][col].filled) {
    state.fallingObstacle = { ...state.fallingObstacle, row: nextRow };
    notify();
  } else {
    landObstacle();
  }
}

// Obstacle board'a merge olur
function landObstacle() {
  if (!state.fallingObstacle) return;
  const { col, row, color } = state.fallingObstacle;

  if (obstacleMoveTimer !== null) { clearInterval(obstacleMoveTimer); obstacleMoveTimer = null; }

  // Obstacle'ı board'a ekle
  const withObstacle = state.board.map((boardRow, r) =>
    boardRow.map((cell, c) => {
      if (r === row && c === col) return { filled: true as const, color };
      return cell;
    }),
  );

  // Aynı clear + gravity pipeline'ını kullan (obstacle hücreleri de dahil)
  const { board: cleared, linesCleared, clearedRows, clearedCols, fallDistances } = clearFullLines(withObstacle);
  state.board = cleared;
  state.fallingObstacle = null;

  // Clear oldu: animasyon tetikle; skor/combo dokunma
  if (linesCleared > 0) {
    state.lastClear = { clearedRows, clearedCols, fallDistances };
  }

  if (!state.piecePool.some(p => hasAnyValidPlacement(state.board, p))) {
    clearAllTimers();
    updateHighScore(state.score);
    state.gameStatus = 'gameover';
    notify();
    return;
  }

  notify();
  scheduleNextObstacle();
}

// ── Public API ─────────────────────────────────────────────────────────────
export const GameManager = {
  getState(): GameState {
    return { ...state, piecePool: [...state.piecePool] };
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
    clearAllTimers();
    resetBag();
    state = {
      gameStatus: 'playing',
      score: 0,
      level: 1,
      combo: 0,
      piecePool: [createRandomPiece(), createRandomPiece(), createRandomPiece()],
      selectedPieceIndex: 0,
      board: createEmptyBoard(),
      lastClear: null,
      elapsedSeconds: 0,
      fallingObstacle: null,
    };
    timeTimer = setInterval(tickTime, 1000);
    // İlk obstacle 6 saniye sonra — oyuncuya ısınma süresi
    obstacleSpawnTimer = setTimeout(() => {
      obstacleSpawnTimer = null;
      spawnObstacle();
    }, 6000);
    notify();
  },

  togglePause() {
    if (state.gameStatus === 'playing') {
      state.gameStatus = 'paused';
      clearAllTimers();
    } else if (state.gameStatus === 'paused') {
      state.gameStatus = 'playing';
      timeTimer = setInterval(tickTime, 1000);
      // Obstacle varsa düşüşüne devam et, yoksa spawn zamanla
      if (state.fallingObstacle) {
        obstacleMoveTimer = setInterval(moveObstacleDown, obstacleDropSpeed(state.level));
      } else {
        scheduleNextObstacle();
      }
    }
    notify();
  },

  end() {
    clearAllTimers();
    updateHighScore(state.score);
    state.gameStatus = 'gameover';
    state.fallingObstacle = null;
    notify();
  },


  selectPiece(index: number) {
    if (state.gameStatus !== 'playing') return;
    if (index < 0 || index >= state.piecePool.length) return;
    if (state.selectedPieceIndex === index) return;
    state.selectedPieceIndex = index;
    notify();
  },

  placeAt(row: number, col: number): boolean {
    const { piecePool, selectedPieceIndex, board, gameStatus } = state;
    if (gameStatus !== 'playing') return false;
    const piece = piecePool[selectedPieceIndex];
    if (!piece) return false;
    if (!canPlace(board, piece, row, col)) return false;

    const placed = placePiece(board, piece, row, col);
    const { board: cleared, linesCleared, clearedRows, clearedCols, fallDistances } = clearFullLines(placed);

    state.board = cleared;
    state.lastClear = linesCleared > 0 ? { clearedRows, clearedCols, fallDistances } : null;
    state.combo = linesCleared > 0 ? state.combo + 1 : 0;
    state.score += calculateScore(linesCleared, state.level, Math.max(state.combo, 1));
    if (shouldLevelUp(state.score, state.level)) state.level += 1;

    const newPool = [...piecePool];
    newPool[selectedPieceIndex] = createRandomPiece();
    state.piecePool = newPool;
    state.selectedPieceIndex = (selectedPieceIndex + 1) % 3;

    if (!state.piecePool.some(p => hasAnyValidPlacement(state.board, p))) {
      clearAllTimers();
      updateHighScore(state.score);
      state.gameStatus = 'gameover';
      state.fallingObstacle = null;
    }

    notify();
    return true;
  },
};
