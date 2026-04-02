import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ScoreBoard } from '../components/ScoreBoard';
import { GameManager } from '../game/GameManager';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [highScore, setHighScore] = useState<number | null>(GameManager.getHighScore());

  // loadHighScore tamamlanınca notify → subscriber günceller
  React.useEffect(() => {
    return GameManager.subscribe(() => setHighScore(GameManager.getHighScore()));
  }, []);

  // Oyundan geri dönünce de güncel değeri al
  useFocusEffect(
    React.useCallback(() => {
      setHighScore(GameManager.getHighScore());
    }, []),
  );

  const handleStart = () => {
    GameManager.start();
    navigation.navigate('Game');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Puzzlr</Text>
        <ScoreBoard highScore={highScore} />
        <TouchableOpacity style={styles.button} onPress={handleStart} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Başlat</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#a78bfa',
    letterSpacing: 2,
  },
  button: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 56,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
