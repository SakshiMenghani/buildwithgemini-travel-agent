import json
import sqlite3
import os
from typing import Optional, Dict, Any, List
from app.models import UserPreferences, ItineraryResponse

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "roam_data.db")

def init_db():
    """Initializes SQLite database for user preferences and trip histories."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Table for storing user preferences
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS preferences (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Table for storing trip itineraries
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            trip_id TEXT PRIMARY KEY,
            destination TEXT NOT NULL,
            data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize DB on module import
init_db()


def save_user_preferences(prefs: UserPreferences, user_id: str = "default_user") -> UserPreferences:
    """Saves or updates user travel preferences in persistent storage."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO preferences (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        (user_id, prefs.model_dump_json())
    )
    conn.commit()
    conn.close()
    return prefs


def get_user_preferences(user_id: str = "default_user") -> UserPreferences:
    """Retrieves saved user preferences or returns default preferences."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM preferences WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row[0]:
        try:
            data = json.loads(row[0])
            return UserPreferences(**data)
        except Exception:
            pass
            
    # Default preferences if none saved
    return UserPreferences(
        user_name="Sakshi",
        user_avatar="avatar_1",
        personality_type="Culture Enthusiast & Foodie Explorer",
        dietary_restrictions=["None"],
        travel_pace="Balanced",
        budget_level="Moderate",
        interests=["Culture", "Foodie", "Sightseeing"],
        preferred_transport="Public Transit / Walking",
        accessibility_needs=[],
        saved_notes="Prefers authentic local dining and highly rated cultural landmarks.",
        past_destinations=[]
    )


def save_trip(itinerary: ItineraryResponse, user_id: str = "default_user"):
    """Saves a trip itinerary to persistent storage and updates user past destinations memory."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO trips (trip_id, destination, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        (itinerary.trip_id, itinerary.destination, itinerary.model_dump_json())
    )
    conn.commit()
    conn.close()

    # Update user memory with this new destination
    try:
        prefs = get_user_preferences(user_id)
        if itinerary.destination not in prefs.past_destinations:
            prefs.past_destinations.append(itinerary.destination)
            save_user_preferences(prefs, user_id)
    except Exception as e:
        print(f"Error updating user trip memory: {e}")


def get_trip(trip_id: str) -> Optional[ItineraryResponse]:
    """Retrieves a saved trip itinerary by ID."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM trips WHERE trip_id = ?", (trip_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row[0]:
        try:
            data = json.loads(row[0])
            return ItineraryResponse(**data)
        except Exception:
            pass
    return None
