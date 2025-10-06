import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GROUND_HEIGHT = 100;
const JAMAICAN_COLORS = {
  green: '#009B3A',
  yellow: '#FED100',
  black: '#000000',
  gold: '#FFD700',
  red: '#DC143C'
};

// Game Types
interface Player {
  id: string;
  name: string;
  high_score: number;
}

interface GameSession {
  id: string;
  player_id: string;
  track_name: string;
  score: number;
  distance: number;
  character_type: string;
}

interface Track {
  id: string;
  name: string;
  display_name: string;
  location_type: string;
  character_type: string;
  difficulty: string;
  background_theme: string;
}

interface JamaicanDialogue {
  dialogue: string;
  translation: string;
}

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 'http://localhost:8001';

export default function JamaicanRacingGame() {
  // Game State
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver'>('menu');
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [availableTracks, setAvailableTracks] = useState<Track[]>([]);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [dialogue, setDialogue] = useState<JamaicanDialogue | null>(null);
  const [isJumping, setIsJumping] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Game initialization flag
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeGame();
  }, []);

  // Force initialization after timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isInitialized) {
        console.log("Forcing initialization with fallback data");
        setCurrentPlayer({ id: 'temp', name: 'General Da Jamaican Boy', high_score: 0 });
        setAvailableTracks([{
          id: 'track_001',
          name: 'jamaica_country',
          display_name: 'Blue Mountain Trail',
          location_type: 'country',
          character_type: 'on_foot',
          difficulty: 'easy',
          background_theme: 'rural_mountains'
        }]);
        setCurrentTrack({
          id: 'track_001',
          name: 'jamaica_country',
          display_name: 'Blue Mountain Trail',
          location_type: 'country',
          character_type: 'on_foot',
          difficulty: 'easy',
          background_theme: 'rural_mountains'
        });
        setIsInitialized(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isInitialized]);

  const initializeGame = async () => {
    try {
      // Create default player
      const playerResponse = await fetch(`${BACKEND_URL}/api/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'General Da Jamaican Boy' })
      });
      const player = await playerResponse.json();
      setCurrentPlayer(player);

      // Get available tracks
      const tracksResponse = await fetch(`${BACKEND_URL}/api/tracks`);
      const tracks = await tracksResponse.json();
      setAvailableTracks(tracks);
      setCurrentTrack(tracks[0]); // Default to first track

      // Get welcome dialogue
      const dialogueResponse = await fetch(`${BACKEND_URL}/api/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: 'start',
          track_name: tracks[0]?.name || 'jamaica_country',
          player_name: 'General Da Jamaican Boy'
        })
      });
      const dialogueData = await dialogueResponse.json();
      setDialogue(dialogueData);
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize game:', error);
      // Set fallback data
      setDialogue({
        dialogue: "Ready fi run through Jamaica, General?",
        translation: "Ready to run through Jamaica, General?"
      });
      setCurrentPlayer({ id: 'temp', name: 'General Da Jamaican Boy', high_score: 0 });
      setAvailableTracks([{
        id: 'track_001',
        name: 'jamaica_country',
        display_name: 'Blue Mountain Trail',
        location_type: 'country',
        character_type: 'on_foot',
        difficulty: 'easy',
        background_theme: 'rural_mountains'
      }]);
      setIsInitialized(true);
    }
  };

  const startGame = async () => {
    if (!currentPlayer || !currentTrack) return;
    
    try {
      // Create game session
      const sessionResponse = await fetch(`${BACKEND_URL}/api/game-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: currentPlayer.id,
          track_name: currentTrack.name,
          character_type: currentTrack.character_type
        })
      });
      const session = await sessionResponse.json();
      setGameSession(session);
      
      // Reset game state
      setScore(0);
      setDistance(0);
      
      setGameState('playing');
      setIsRunning(true);
      
    } catch (error) {
      console.error('Failed to start game:', error);
      // Continue with offline mode
      setGameState('playing');
      setIsRunning(true);
    }
  };

  const jumpCharacter = () => {
    if (isJumping || gameState !== 'playing') return;
    
    setIsJumping(true);
    setScore(prev => prev + 50); // Add points for jumping
    
    setTimeout(() => {
      setIsJumping(false);
    }, 600); // Jump animation duration
  };

  const pauseGame = () => {
    setGameState('paused');
    setIsRunning(false);
  };

  const resumeGame = () => {
    setGameState('playing');
    setIsRunning(true);
  };

  const endGame = async () => {
    setGameState('gameOver');
    setIsRunning(false);
    
    if (!gameSession) return;
    
    try {
      // Update game session with final score
      await fetch(`${BACKEND_URL}/api/game-sessions/${gameSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: score,
          distance: distance,
          time_played: Math.floor(distance / 10),
          completed: true
        })
      });
      
      // Get victory/defeat dialogue
      const context = score > 500 ? 'victory' : 'defeat';
      const dialogueResponse = await fetch(`${BACKEND_URL}/api/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: context,
          track_name: currentTrack?.name || 'jamaica_country',
          player_name: currentPlayer?.name || 'General Da Jamaican Boy'
        })
      });
      const dialogueData = await dialogueResponse.json();
      setDialogue(dialogueData);
      
    } catch (error) {
      console.error('Failed to end game:', error);
    }
  };

  const resetGame = () => {
    setGameState('menu');
    setGameSession(null);
    setScore(0);
    setDistance(0);
  };

  // Auto increment score when playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === 'playing' && isRunning) {
      interval = setInterval(() => {
        setDistance(prev => prev + 1);
        setScore(prev => prev + 10);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState, isRunning]);

  // Auto end game after some time for demo
  useEffect(() => {
    if (distance > 200 && gameState === 'playing') {
      endGame();
    }
  }, [distance, gameState]);

  const renderBackground = () => {
    const bgColor = currentTrack?.background_theme === 'urban_streets' 
      ? '#87CEEB' 
      : '#98FB98';
      
    return (
      <View style={[styles.background, { backgroundColor: bgColor }]}>
        {/* Mountains/Buildings */}
        <View style={styles.scenery}>
          <Ionicons name="triangle" size={80} color="#228B22" style={{ opacity: 0.7 }} />
          <Ionicons name="triangle" size={60} color="#32CD32" style={{ opacity: 0.5 }} />
          <Ionicons name="triangle" size={100} color="#006400" style={{ opacity: 0.6 }} />
        </View>
        
        {/* Ground */}
        <View style={styles.ground}>
          <View style={styles.groundPattern} />
        </View>
      </View>
    );
  };

  const renderCharacter = () => {
    const characterIcon = currentTrack?.character_type === 'vehicle' ? 'car-sport' : 'walk';
    const characterBottom = isJumping ? GROUND_HEIGHT + 60 : GROUND_HEIGHT + 10;
    
    return (
      <View style={[styles.character, { bottom: characterBottom }]}>
        <Ionicons 
          name={characterIcon} 
          size={40} 
          color={JAMAICAN_COLORS.gold}
        />
      </View>
    );
  };

  const renderGameUI = () => (
    <View style={styles.gameUI}>
      <View style={styles.topUI}>
        <Text style={styles.scoreText}>Score: {score}</Text>
        <Text style={styles.distanceText}>Distance: {Math.floor(distance / 10)}m</Text>
        <TouchableOpacity onPress={pauseGame} style={styles.pauseButton}>
          <Ionicons name="pause" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      {dialogue && (
        <View style={styles.dialogueBox}>
          <Text style={styles.dialoguePatois}>{dialogue.dialogue}</Text>
          <Text style={styles.dialogueTranslation}>{dialogue.translation}</Text>
        </View>
      )}
    </View>
  );

  const renderMenu = () => (
    <ScrollView contentContainerStyle={styles.menuContainer}>
      <View style={styles.titleContainer}>
        <Text style={styles.gameTitle}>JAMAICAN</Text>
        <Text style={styles.gameTitle}>RACING</Text>
        <Text style={styles.subtitle}>feat. General Da Jamaican Boy</Text>
      </View>
      
      {dialogue && (
        <View style={styles.welcomeBox}>
          <Text style={styles.dialoguePatois}>{dialogue.dialogue}</Text>
          <Text style={styles.dialogueTranslation}>{dialogue.translation}</Text>
        </View>
      )}
      
      <View style={styles.trackSelection}>
        <Text style={styles.trackTitle}>Select Track:</Text>
        {availableTracks.map((track) => (
          <TouchableOpacity
            key={track.id}
            style={[
              styles.trackButton,
              currentTrack?.id === track.id && styles.selectedTrack
            ]}
            onPress={() => setCurrentTrack(track)}
          >
            <Ionicons 
              name={track.character_type === 'vehicle' ? 'car-sport' : 'walk'} 
              size={20} 
              color="white" 
            />
            <Text style={styles.trackButtonText}>{track.display_name}</Text>
            <Text style={styles.trackDifficulty}>{track.difficulty}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity style={styles.startButton} onPress={startGame}>
        <Text style={styles.startButtonText}>START RACE</Text>
        <Ionicons name="play" size={20} color="white" />
      </TouchableOpacity>
      
      {currentPlayer && (
        <Text style={styles.highScore}>
          High Score: {currentPlayer.high_score}
        </Text>
      )}
    </ScrollView>
  );

  const renderPauseMenu = () => (
    <View style={styles.pauseOverlay}>
      <View style={styles.pauseMenu}>
        <Text style={styles.pauseTitle}>Game Paused</Text>
        <TouchableOpacity style={styles.menuButton} onPress={resumeGame}>
          <Text style={styles.menuButtonText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={resetGame}>
          <Text style={styles.menuButtonText}>Main Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGameOver = () => (
    <View style={styles.gameOverOverlay}>
      <View style={styles.gameOverMenu}>
        <Text style={styles.gameOverTitle}>Race Finished!</Text>
        <Text style={styles.finalScore}>Final Score: {score}</Text>
        <Text style={styles.finalDistance}>Distance: {Math.floor(distance / 10)}m</Text>
        
        {dialogue && (
          <View style={styles.gameOverDialogue}>
            <Text style={styles.dialoguePatois}>{dialogue.dialogue}</Text>
            <Text style={styles.dialogueTranslation}>{dialogue.translation}</Text>
          </View>
        )}
        
        <TouchableOpacity style={styles.menuButton} onPress={startGame}>
          <Text style={styles.menuButtonText}>Race Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={resetGame}>
          <Text style={styles.menuButtonText}>Main Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Jamaican Racing Game...</Text>
        <Text style={styles.loadingSubtext}>Preparing the Blue Mountains...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={JAMAICAN_COLORS.green} />
      
      {/* Game Background */}
      {renderBackground()}
      
      {/* Character */}
      {(gameState === 'playing' || gameState === 'paused') && renderCharacter()}
      
      {/* Game Controls */}
      {gameState === 'playing' && (
        <TouchableOpacity 
          style={styles.jumpArea} 
          onPress={jumpCharacter}
          activeOpacity={0.7}
        >
          <Text style={styles.jumpHint}>TAP TO JUMP</Text>
        </TouchableOpacity>
      )}
      
      {/* UI Overlays */}
      {gameState === 'menu' && renderMenu()}
      {gameState === 'playing' && renderGameUI()}
      {gameState === 'paused' && renderPauseMenu()}
      {gameState === 'gameOver' && renderGameOver()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: JAMAICAN_COLORS.green,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: JAMAICAN_COLORS.green,
  },
  loadingText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  loadingSubtext: {
    color: JAMAICAN_COLORS.gold,
    fontSize: 16,
    fontStyle: 'italic',
  },
  background: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    top: 0,
    left: 0,
  },
  scenery: {
    position: 'absolute',
    bottom: GROUND_HEIGHT + 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: GROUND_HEIGHT,
    backgroundColor: JAMAICAN_COLORS.yellow,
  },
  groundPattern: {
    flex: 1,
    backgroundColor: '#8B4513',
    opacity: 0.3,
  },
  character: {
    position: 'absolute',
    left: 50,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: JAMAICAN_COLORS.red,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    zIndex: 10,
  },
  jumpArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jumpHint: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 10,
    borderRadius: 10,
  },
  gameUI: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topUI: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scoreText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  distanceText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pauseButton: {
    backgroundColor: JAMAICAN_COLORS.red,
    padding: 10,
    borderRadius: 20,
  },
  dialogueBox: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: JAMAICAN_COLORS.gold,
  },
  dialoguePatois: {
    color: JAMAICAN_COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  dialogueTranslation: {
    color: 'white',
    fontSize: 14,
    fontStyle: 'italic',
  },
  menuContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  gameTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: JAMAICAN_COLORS.gold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    fontStyle: 'italic',
    marginTop: 10,
  },
  welcomeBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
    borderWidth: 2,
    borderColor: JAMAICAN_COLORS.gold,
  },
  trackSelection: {
    width: '100%',
    marginBottom: 30,
  },
  trackTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  trackButton: {
    backgroundColor: JAMAICAN_COLORS.black,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    opacity: 0.8,
  },
  selectedTrack: {
    backgroundColor: JAMAICAN_COLORS.red,
    opacity: 1,
  },
  trackButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
    flex: 1,
  },
  trackDifficulty: {
    color: JAMAICAN_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: JAMAICAN_COLORS.red,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 20,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  highScore: {
    color: 'white',
    fontSize: 16,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  pauseMenu: {
    backgroundColor: JAMAICAN_COLORS.green,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: JAMAICAN_COLORS.gold,
  },
  pauseTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  menuButton: {
    backgroundColor: JAMAICAN_COLORS.red,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
    marginBottom: 10,
  },
  menuButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  gameOverMenu: {
    backgroundColor: JAMAICAN_COLORS.green,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: JAMAICAN_COLORS.gold,
    maxWidth: SCREEN_WIDTH - 40,
  },
  gameOverTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  finalScore: {
    color: JAMAICAN_COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  finalDistance: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  gameOverDialogue: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: JAMAICAN_COLORS.gold,
  },
});