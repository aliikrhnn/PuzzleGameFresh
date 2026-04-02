import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'puzzle_high_score';

export const HighScoreStorage = {
  async load(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(KEY);
      const n = val ? parseInt(val, 10) : 0;
      return isNaN(n) ? 0 : n;
    } catch {
      return 0;
    }
  },

  async save(score: number): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY, String(score));
    } catch {
      // sessizce geç — oyun akışı bozulmasın
    }
  },
};
