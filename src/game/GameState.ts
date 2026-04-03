import type { PieceType } from './PieceDefinitions';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'gameover';

export type Piece = {
  id: string;
  type: PieceType;
  color: string;
  shape: number[][];
};

export type Cell = {
  filled: boolean;
  color?: string;
};

export type Board = Cell[][];

export type FallingObstacle = {
  col: number;
  row: number;
  color: string;
};

export type GameState = {
  gameStatus: GameStatus;
  score: number;
  level: number;
  combo: number;
  piecePool: Piece[];         // her zaman 3 parça
  selectedPieceIndex: number; // 0 | 1 | 2 — aktif/sürüklenen slot
  board: Board;
  lastClear: { clearedRows: number[]; clearedCols: number[]; fallDistances: Record<string, number> } | null;
  elapsedSeconds: number;
  fallingObstacle: FallingObstacle | null;
};

export const BOARD_ROWS = 10;
export const BOARD_COLS = 8;
