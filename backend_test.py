#!/usr/bin/env python3
"""
Backend API Tests for Jamaican Racing Game
Tests all endpoints with realistic Jamaican-themed data
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Get backend URL from environment
BACKEND_URL = "https://jamaican-kart.preview.emergentagent.com/api"

class JamaicanRacingGameTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.created_player_id = None
        self.created_session_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def test_health_check(self):
        """Test GET /api/ - Health check"""
        try:
            response = requests.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Jamaican Racing Game API" in data["message"]:
                    self.log_test("Health Check", True, f"API is running: {data['message']}")
                    return True
                else:
                    self.log_test("Health Check", False, "Unexpected response format", data)
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"Connection error: {str(e)}")
            return False

    def test_get_tracks(self):
        """Test GET /api/tracks - Get available racing tracks"""
        try:
            response = requests.get(f"{self.base_url}/tracks")
            if response.status_code == 200:
                tracks = response.json()
                if isinstance(tracks, list) and len(tracks) > 0:
                    # Check for Jamaican-themed tracks
                    jamaican_tracks = []
                    for track in tracks:
                        if any(keyword in track.get("display_name", "").lower() 
                              for keyword in ["blue mountain", "kingston", "jamaica"]):
                            jamaican_tracks.append(track["display_name"])
                    
                    if jamaican_tracks:
                        self.log_test("Get Tracks", True, 
                                    f"Found {len(tracks)} tracks including Jamaican locations: {', '.join(jamaican_tracks)}")
                        return True
                    else:
                        self.log_test("Get Tracks", False, 
                                    "No Jamaican-themed tracks found", tracks)
                        return False
                else:
                    self.log_test("Get Tracks", False, "No tracks returned", tracks)
                    return False
            else:
                self.log_test("Get Tracks", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Tracks", False, f"Request error: {str(e)}")
            return False

    def test_create_player(self):
        """Test POST /api/players - Create a new player"""
        try:
            player_data = {
                "name": "General Da Jamaican Boy"
            }
            response = requests.post(f"{self.base_url}/players", json=player_data)
            if response.status_code == 200:
                player = response.json()
                if "id" in player and "name" in player and player["name"] == "General Da Jamaican Boy":
                    self.created_player_id = player["id"]
                    self.log_test("Create Player", True, 
                                f"Created player '{player['name']}' with ID: {player['id']}")
                    return True
                else:
                    self.log_test("Create Player", False, "Invalid player response format", player)
                    return False
            else:
                self.log_test("Create Player", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Create Player", False, f"Request error: {str(e)}")
            return False

    def test_get_player(self):
        """Test GET /api/players/{player_id} - Get player by ID"""
        if not self.created_player_id:
            self.log_test("Get Player", False, "No player ID available (create player test failed)")
            return False
            
        try:
            response = requests.get(f"{self.base_url}/players/{self.created_player_id}")
            if response.status_code == 200:
                player = response.json()
                if player["id"] == self.created_player_id and player["name"] == "General Da Jamaican Boy":
                    self.log_test("Get Player", True, 
                                f"Retrieved player: {player['name']} (High Score: {player.get('high_score', 0)})")
                    return True
                else:
                    self.log_test("Get Player", False, "Player data mismatch", player)
                    return False
            else:
                self.log_test("Get Player", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Player", False, f"Request error: {str(e)}")
            return False

    def test_create_game_session(self):
        """Test POST /api/game-sessions - Create game session"""
        if not self.created_player_id:
            self.log_test("Create Game Session", False, "No player ID available")
            return False
            
        try:
            session_data = {
                "player_id": self.created_player_id,
                "track_name": "jamaica_country",  # Blue Mountain Trail
                "character_type": "on_foot"
            }
            response = requests.post(f"{self.base_url}/game-sessions", json=session_data)
            if response.status_code == 200:
                session = response.json()
                if "id" in session and session["track_name"] == "jamaica_country":
                    self.created_session_id = session["id"]
                    self.log_test("Create Game Session", True, 
                                f"Started game session on Blue Mountain Trail (ID: {session['id']})")
                    return True
                else:
                    self.log_test("Create Game Session", False, "Invalid session response", session)
                    return False
            else:
                self.log_test("Create Game Session", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Create Game Session", False, f"Request error: {str(e)}")
            return False

    def test_update_game_session(self):
        """Test PUT /api/game-sessions/{session_id} - Update game session with score"""
        if not self.created_session_id:
            self.log_test("Update Game Session", False, "No session ID available")
            return False
            
        try:
            update_data = {
                "score": 1500,
                "distance": 2.5,
                "time_played": 120,
                "completed": True
            }
            response = requests.put(f"{self.base_url}/game-sessions/{self.created_session_id}", json=update_data)
            if response.status_code == 200:
                session = response.json()
                if session["score"] == 1500 and session["completed"]:
                    self.log_test("Update Game Session", True, 
                                f"Updated session with score: {session['score']}, completed: {session['completed']}")
                    return True
                else:
                    self.log_test("Update Game Session", False, "Score/completion not updated properly", session)
                    return False
            else:
                self.log_test("Update Game Session", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Update Game Session", False, f"Request error: {str(e)}")
            return False

    def test_dialogue_generation(self):
        """Test POST /api/dialogue - Generate Jamaican patois dialogue"""
        test_contexts = [
            {"context": "start", "track_name": "jamaica_country"},
            {"context": "victory", "track_name": "kingston_city"},
            {"context": "defeat", "track_name": "jamaica_country"},
            {"context": "powerup", "track_name": "kingston_city"}
        ]
        
        all_passed = True
        dialogue_results = []
        
        for test_case in test_contexts:
            try:
                dialogue_data = {
                    "context": test_case["context"],
                    "track_name": test_case["track_name"],
                    "player_name": "General Da Jamaican Boy"
                }
                response = requests.post(f"{self.base_url}/dialogue", json=dialogue_data)
                if response.status_code == 200:
                    dialogue = response.json()
                    if "dialogue" in dialogue and "translation" in dialogue:
                        dialogue_results.append(f"{test_case['context']}: '{dialogue['dialogue']}' ({dialogue['translation']})")
                    else:
                        all_passed = False
                        dialogue_results.append(f"{test_case['context']}: Invalid response format")
                else:
                    all_passed = False
                    dialogue_results.append(f"{test_case['context']}: HTTP {response.status_code}")
            except Exception as e:
                all_passed = False
                dialogue_results.append(f"{test_case['context']}: Error - {str(e)}")
        
        if all_passed:
            self.log_test("Dialogue Generation", True, 
                        f"Generated dialogue for all contexts:\n   " + "\n   ".join(dialogue_results))
        else:
            self.log_test("Dialogue Generation", False, 
                        f"Some dialogue generation failed:\n   " + "\n   ".join(dialogue_results))
        
        return all_passed

    def test_leaderboard(self):
        """Test GET /api/leaderboard - Get top players"""
        try:
            response = requests.get(f"{self.base_url}/leaderboard")
            if response.status_code == 200:
                leaderboard = response.json()
                if isinstance(leaderboard, list):
                    if len(leaderboard) > 0:
                        # Check if our player is in the leaderboard
                        our_player = None
                        for player in leaderboard:
                            if player.get("name") == "General Da Jamaican Boy":
                                our_player = player
                                break
                        
                        if our_player:
                            self.log_test("Leaderboard", True, 
                                        f"Leaderboard working with {len(leaderboard)} players. Our player has high score: {our_player.get('high_score', 0)}")
                        else:
                            self.log_test("Leaderboard", True, 
                                        f"Leaderboard working with {len(leaderboard)} players (our player not yet in top scores)")
                    else:
                        self.log_test("Leaderboard", True, "Leaderboard is empty but working")
                    return True
                else:
                    self.log_test("Leaderboard", False, "Invalid leaderboard format", leaderboard)
                    return False
            else:
                self.log_test("Leaderboard", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Leaderboard", False, f"Request error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🏁 Starting Jamaican Racing Game Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Run tests in logical order
        tests = [
            self.test_health_check,
            self.test_get_tracks,
            self.test_create_player,
            self.test_get_player,
            self.test_create_game_session,
            self.test_update_game_session,
            self.test_dialogue_generation,
            self.test_leaderboard
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
        
        print("=" * 60)
        print(f"🏆 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! The Jamaican Racing Game API is working perfectly!")
        else:
            print("⚠️  Some tests failed. Check the details above.")
            
        return passed == total

if __name__ == "__main__":
    tester = JamaicanRacingGameTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)