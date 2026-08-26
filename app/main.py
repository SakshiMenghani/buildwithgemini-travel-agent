import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

from app.models import ItineraryRequest, ItineraryResponse, ReplanRequest, PromptRequest, UserPreferences
from app.storage import get_user_preferences, save_user_preferences, get_trip
from app.agent import generate_itinerary, replan_itinerary, generate_from_prompt
from app.tools import get_destination_image, search_destination_info

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roam.main")

app = FastAPI(
    title="Roam - AI Autonomous Travel Agent",
    description="Powered by Google Gemini & ADK",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

os.makedirs(STATIC_DIR, exist_ok=True)

# API Endpoints
@app.get("/api/health")
def health_check():
    return {"status": "ok", "agent": "Roam AI Travel Agent", "version": "1.0.0"}


@app.get("/api/preferences", response_model=UserPreferences)
def fetch_preferences():
    """Returns saved user travel preferences."""
    return get_user_preferences()


@app.post("/api/preferences", response_model=UserPreferences)
def update_preferences(prefs: UserPreferences):
    """Updates user travel preferences in persistent memory."""
    return save_user_preferences(prefs)


@app.post("/api/itinerary/generate", response_model=ItineraryResponse)
def create_itinerary_endpoint(req: ItineraryRequest):
    """Generates a complete personalized travel itinerary using Gemini & grounded search."""
    try:
        return generate_itinerary(req)
    except Exception as e:
        logger.error(f"Failed to generate itinerary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/itinerary/from-prompt", response_model=ItineraryResponse)
def create_itinerary_from_prompt_endpoint(req: PromptRequest):
    """Extracts parameters from a freeform natural language prompt using Gemini and creates itinerary."""
    try:
        return generate_from_prompt(req)
    except Exception as e:
        logger.error(f"Failed to generate itinerary from prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/itinerary/replan", response_model=ItineraryResponse)
def replan_itinerary_endpoint(req: ReplanRequest):
    """Dynamically updates an existing itinerary based on user input or changed circumstances."""
    try:
        return replan_itinerary(req)
    except Exception as e:
        logger.error(f"Failed to replan itinerary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/trip/{trip_id}", response_model=ItineraryResponse)
def get_saved_trip(trip_id: str):
    """Retrieves a previously generated trip by ID."""
    trip = get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@app.get("/api/generate-image")
def generate_image_endpoint(destination: str, prompt: str = ""):
    """Generates visual travel artwork for destination."""
    image_url = get_destination_image(destination, prompt)
    return {"image_url": image_url}


@app.get("/api/search-places")
def search_places_endpoint(destination: str, query: str):
    """Live grounded place search using Gemini search grounding."""
    results = search_destination_info(destination, query)
    return {"destination": destination, "query": query, "results": results}


# Mount Static Files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.api_route("/", methods=["GET", "HEAD"])
def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Roam Backend API active. Static frontend missing."}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
