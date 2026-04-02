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

export type GameState = {
  gameStatus: GameStatus;
  score: number;
  level: number;
  combo: number;
  currentPiece: Piece | null;
  currentPosition: { row: number; col: number } | null;
  nextPiece: Piece | null;
  board: Board;
  lastClear: { clearedRows: number[]; clearedCols: number[]; fallDistances: Record<string, number> } | null;
  elapsedSeconds: number;
};

export const BOARD_ROWS = 10;
export const BOARD_COLS = 8;
