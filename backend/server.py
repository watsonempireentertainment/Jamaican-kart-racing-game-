from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
# Temporarily comment out LLM import until env issue is resolved
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False
    print("Warning: emergentintegrations not available, using fallback dialogue")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Game Models
class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    high_score: int = 0
    total_games: int = 0
    unlocked_tracks: List[str] = Field(default_factory=lambda: ["jamaica_country"])
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GameSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    track_name: str
    score: int = 0
    distance: float = 0.0
    time_played: int = 0  # seconds
    character_type: str  # "on_foot" or "vehicle"
    completed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Track(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    display_name: str
    location_type: str  # "country", "city", "town"
    character_type: str  # "on_foot", "vehicle"
    difficulty: str  # "easy", "medium", "hard"
    background_theme: str
    unlock_requirement: int = 0  # score needed to unlock
    is_unlocked: bool = True

class JamaicanDialogue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    context: str  # "victory", "defeat", "start", "powerup"
    dialogue: str
    translation: str
    track_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Input Models
class PlayerCreate(BaseModel):
    name: str

class GameSessionCreate(BaseModel):
    player_id: str
    track_name: str
    character_type: str

class GameSessionUpdate(BaseModel):
    score: int
    distance: float
    time_played: int
    completed: bool = False

class DialogueRequest(BaseModel):
    context: str
    track_name: str
    player_name: Optional[str] = "General Da Jamaican Boy"

# Initialize LLM Chat
async def get_jamaican_dialogue(context: str, track_name: str, player_name: str = "General Da Jamaican Boy") -> Dict[str, str]:
    """Generate authentic Jamaican patois dialogue using LLM or fallback"""
    
    # Fallback phrases (used when LLM is not available)
    fallback_phrases = {
        "victory": {"patois": "Big up yuhself! Yuh run like lightning!", "translation": "Congratulations! You ran like lightning!"},
        "defeat": {"patois": "Nuh worry, bredrin. Try again!", "translation": "Don't worry, friend. Try again!"},
        "start": {"patois": "Ready fi run through Jamaica, General?", "translation": "Ready to run through Jamaica, General?"},
        "powerup": {"patois": "Bless up! Power boost time!", "translation": "Blessed up! Power boost time!"}
    }
    
    if not LLM_AVAILABLE:
        return fallback_phrases.get(context, {"patois": "Irie vibes, bredrin!", "translation": "Good vibes, friend!"})
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"jamaican_game_{context}_{track_name}",
            system_message="""You are a Jamaican cultural expert who creates authentic patois dialogue for a racing game. 
            Create realistic Jamaican patois expressions that are respectful and culturally accurate. 
            Always provide both the patois version and an English translation.
            The main character is 'General Da Jamaican Boy' - a heroic figure representing Jamaican culture and spirit."""
        ).with_model("openai", "gpt-4o-mini")

        location_context = {
            "jamaica_country": "rural Jamaica with beautiful Blue Mountains, sugar cane fields, and traditional villages",
            "kingston_city": "bustling Kingston with vibrant street culture, markets, and urban energy",
            "montego_bay": "tourist area with beaches, resorts, and tropical vibes"
        }

        prompt = f"""Generate a short Jamaican patois phrase for a racing game.

Context: {context}
Location: {track_name} - {location_context.get(track_name, 'beautiful Jamaica')}
Character: {player_name}

Requirements:
- Keep it authentic but family-friendly
- Make it energetic and encouraging for a racing game
- Include cultural pride and positivity
- 1-2 sentences maximum

Please respond in this exact format:
PATOIS: [authentic patois phrase]
TRANSLATION: [English translation]"""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        lines = response.strip().split('\n')
        patois = ""
        translation = ""
        
        for line in lines:
            if line.startswith('PATOIS:'):
                patois = line.replace('PATOIS:', '').strip()
            elif line.startswith('TRANSLATION:'):
                translation = line.replace('TRANSLATION:', '').strip()
        
        return {
            "patois": patois or "Run fast, mi bredrin!",
            "translation": translation or "Run fast, my friend!"
        }
    except Exception as e:
        logging.error(f"Error generating Jamaican dialogue: {e}")
        return fallback_phrases.get(context, {"patois": "Irie vibes, bredrin!", "translation": "Good vibes, friend!"})

# Game Routes
@api_router.post("/players", response_model=Player)
async def create_player(player_data: PlayerCreate):
    """Create a new player"""
    player = Player(name=player_data.name)
    await db.players.insert_one(player.dict())
    return player

@api_router.get("/players/{player_id}", response_model=Player)
async def get_player(player_id: str):
    """Get player by ID"""
    player = await db.players.find_one({"id": player_id})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return Player(**player)

@api_router.get("/tracks", response_model=List[Track])
async def get_tracks():
    """Get all available tracks"""
    tracks = [
        Track(
            id="track_001",
            name="jamaica_country",
            display_name="Blue Mountain Trail",
            location_type="country",
            character_type="on_foot",
            difficulty="easy",
            background_theme="rural_mountains",
            unlock_requirement=0,
            is_unlocked=True
        ),
        Track(
            id="track_002", 
            name="kingston_city",
            display_name="Kingston Street Race",
            location_type="city",
            character_type="vehicle",
            difficulty="medium",
            background_theme="urban_streets",
            unlock_requirement=1000,
            is_unlocked=False
        )
    ]
    return tracks

@api_router.post("/game-sessions", response_model=GameSession)
async def create_game_session(session_data: GameSessionCreate):
    """Start a new game session"""
    session = GameSession(**session_data.dict())
    await db.game_sessions.insert_one(session.dict())
    return session

@api_router.put("/game-sessions/{session_id}", response_model=GameSession)
async def update_game_session(session_id: str, update_data: GameSessionUpdate):
    """Update game session with score and completion status"""
    session = await db.game_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    # Update session
    update_dict = update_data.dict()
    await db.game_sessions.update_one(
        {"id": session_id},
        {"$set": update_dict}
    )
    
    # Update player high score if needed
    if update_data.completed and update_data.score > 0:
        player = await db.players.find_one({"id": session["player_id"]})
        if player and update_data.score > player.get("high_score", 0):
            await db.players.update_one(
                {"id": session["player_id"]},
                {
                    "$set": {"high_score": update_data.score},
                    "$inc": {"total_games": 1}
                }
            )
    
    # Get updated session
    updated_session = await db.game_sessions.find_one({"id": session_id})
    return GameSession(**updated_session)

@api_router.post("/dialogue", response_model=JamaicanDialogue)
async def generate_dialogue(request: DialogueRequest):
    """Generate Jamaican patois dialogue for game contexts"""
    dialogue_data = await get_jamaican_dialogue(
        request.context, 
        request.track_name, 
        request.player_name or "General Da Jamaican Boy"
    )
    
    dialogue = JamaicanDialogue(
        context=request.context,
        dialogue=dialogue_data["patois"],
        translation=dialogue_data["translation"],
        track_name=request.track_name
    )
    
    # Save to database
    await db.dialogues.insert_one(dialogue.dict())
    return dialogue

@api_router.get("/leaderboard", response_model=List[Player])
async def get_leaderboard(limit: int = 10):
    """Get top players by high score"""
    players = await db.players.find().sort("high_score", -1).limit(limit).to_list(limit)
    return [Player(**player) for player in players]

# Health check
@api_router.get("/")
async def root():
    return {"message": "Jamaican Racing Game API", "status": "running"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()