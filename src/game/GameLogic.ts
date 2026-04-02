import type { Board, Piece } from './GameState';
import { BOARD_ROWS, BOARD_COLS } from './GameState';
import { PIECE_DEFINITIONS, PIECE_TYPES, type PieceType } from './PieceDefinitions';

// ─── Board ─────────────────────────────────────────────────────────────────

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => ({ filled: false }))
  );
}

// ─── Bag Randomizer ────────────────────────────────────────────────────────

let bag: PieceType[] = [];

function refillBag(): void {
  bag = [...PIECE_TYPES].sort(() => Math.random() - 0.5);
}

export function resetBag(): void {
  bag = [];
}

export function createRandomPiece(): Piece {
  if (bag.length === 0) refillBag();
  const type = bag.pop()!;
  const def = PIECE_DEFINITIONS[type];
  return {
    id: `piece-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: def.type,
    color: def.color,
    shape: def.shape,
  };
}

// ─── Yerleştirme ───────────────────────────────────────────────────────────

export function canPlace(
  board: Board,
  piece: Piece,
  originRow: number,
  originCol: number,
): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] === 0) continue;
      const br = originRow + r;
      const bc = originCol + c;
      if (br < 0 || br >= BOARD_ROWS) return false;
      if (bc < 0 || bc >= BOARD_COLS) return false;
      if (board[br][bc].filled) return false;
    }
  }
  return true;
}

export function placePiece(
  board: Board,
  piece: Piece,
  originRow: number,
  originCol: number,
): Board {
  const next = board.map(row => row.map(cell => ({ ...cell })));
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] === 0) continue;
      next[originRow + r][originCol + c] = { filled: true, color: piece.color };
    }
  }
  return next;
}

// ─── Clear ─────────────────────────────────────────────────────────────────

export function getFullRows(board: Board): number[] {
  return board
    .map((row, r) => (row.every(cell => cell.filled) ? r : -1))
    .filter(r => r !== -1);
}

export function getFullCols(board: Board): number[] {
  return Array.from({ length: BOARD_COLS }, (_, c) => c).filter(c =>
    board.every(row => row[c].filled),
  );
}

export function clearLines(
  board: Board,
  fullRows: number[],
  fullCols: number[],
): Board {
  const rowSet = new Set(fullRows);
  const colSet = new Set(fullCols);
  return board.map((row, r) =>
    row.map((cell, c) => {
      if (rowSet.has(r) || colSet.has(c)) return { filled: false };
      return { ...cell };
    }),
  );
}

export type ClearResult = {
  board: Board;
  clearedRows: number[];
  clearedCols: number[];
  linesCleared: number;
  fallDistances: Record<string, number>; // "row-col" → kaç satır düştü
};

type GravityResult = { board: Board; fallDistances: Record<string, number> };

// Her sütunda dolu hücreleri alta paketler; kaç satır düştüğünü de döner
function applyGravity(board: Board): GravityResult {
  const result: Board = Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => ({ filled: false })),
  );
  const fallDistances: Record<string, number> = {};
  for (let c = 0; c < BOARD_COLS; c++) {
    const filled: Array<{ cell: { filled: true; color?: string }; preRow: number }> = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      if (board[r][c].filled) filled.push({ cell: { filled: true, color: board[r][c].color }, preRow: r });
    }
    const offset = BOARD_ROWS - filled.length;
    for (let i = 0; i < filled.length; i++) {
      const postRow = offset + i;
      result[postRow][c] = filled[i].cell;
      const dist = postRow - filled[i].preRow;
      if (dist > 0) fallDistances[`${postRow}-${c}`] = dist;
    }
  }
  return { board: result, fallDistances };
}

export function clearFullLines(board: Board): ClearResult {
  const clearedRows = getFullRows(board);
  const clearedCols = getFullCols(board);
  const linesCleared = clearedRows.length + clearedCols.length;
  if (linesCleared === 0) return { board, clearedRows: [], clearedCols: [], linesCleared: 0, fallDistances: {} };
  const cleared = clearLines(board, clearedRows, clearedCols);
  const { board: next, fallDistances } = applyGravity(cleared);
  return { board: next, clearedRows, clearedCols, linesCleared, fallDistances };
}

// ─── Skor ──────────────────────────────────────────────────────────────────

// Formül: (10 + 100 × linesCleared²) × comboÇarpanı × seviyeÇarpanı
export function calculateScore(
  linesCleared: number,
  level: number,
  combo: number,
): number {
  const BASE_PLACE = 10;
  const LINE_BONUS = linesCleared > 0 ? 100 * linesCleared * linesCleared : 0;
  const comboMultiplier = 1 + (combo - 1) * 0.5;
  const levelMultiplier = 1 + (level - 1) * 0.2;
  return Math.floor((BASE_PLACE + LINE_BONUS) * comboMultiplier * levelMultiplier);
}

export function shouldLevelUp(score: number, level: number): boolean {
  return score >= level * 500;
}

// ─── Game Over ─────────────────────────────────────────────────────────────

// Tüm 4 rotasyonu deneyerek herhangi bir konuma sığıyor mu kontrol eder
export function hasAnyValidPlacement(board: Board, piece: Piece): boolean {
  let shape = piece.shape;
  for (let rot = 0; rot < 4; rot++) {
    const rotated: Piece = { ...piece, shape };
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (canPlace(board, rotated, r, c)) return true;
      }
    }
    shape = rotateShape(shape);
  }
  return false;
}

// ─── Rotation ──────────────────────────────────────────────────────────────

// 90° saat yönünde: shape[r][c] → yeni[c][rows-1-r]
export function rotateShape(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c]),
  );
}

export function rotatePiece(piece: Piece): Piece {
  return { ...piece, shape: rotateShape(piece.shape) };
}
