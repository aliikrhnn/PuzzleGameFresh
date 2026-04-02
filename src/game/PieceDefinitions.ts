export type PieceType = 'square' | 'L' | 'T' | 'line-h' | 'line-v';

export type PieceDefinition = {
  type: PieceType;
  color: string;
  shape: number[][];
};

export const PIECE_DEFINITIONS: Record<PieceType, PieceDefinition> = {
  square: {
    type: 'square',
    color: '#fbbf24',
    shape: [[1,1],[1,1]],
  },
  L: {
    type: 'L',
    color: '#a78bfa',
    shape: [[1,0],[1,0],[1,1]],
  },
  T: {
    type: 'T',
    color: '#34d399',
    shape: [[1,1,1],[0,1,0]],
  },
  'line-h': {
    type: 'line-h',
    color: '#60a5fa',
    shape: [[1,1,1,1]],
  },
  'line-v': {
    type: 'line-v',
    color: '#f472b6',
    shape: [[1],[1],[1],[1]],
  },
};

export const PIECE_TYPES = Object.keys(PIECE_DEFINITIONS) as PieceType[];
