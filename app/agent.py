import os
import uuid
import json
import logging
import datetime
from typing import Dict, Any, Optional

from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.models import Gemini
from google.genai import types

from app.models import ItineraryRequest, ItineraryResponse, ReplanRequest, PromptRequest, UserPreferences, DayPlan, Activity
from app.storage import get_user_preferences, save_user_preferences, save_trip, get_trip
from app.tools import search_destination_info, get_weather_info, get_destination_image, get_place_image, get_genai_client

logger = logging.getLogger("roam.agent")

MODEL_NAME = "gemini-2.5-flash"


def parse_prompt_to_itinerary_request(user_prompt: str, prefs: UserPreferences) -> ItineraryRequest:
    """Uses Gemini to extract structured travel parameters from a natural language user prompt."""
    client = get_genai_client()
    system_prompt = f"""
Analyze the following natural language travel request and extract structured trip details into JSON.

USER REQUEST: "{user_prompt}"

INSTRUCTIONS:
1. Identify the main destination city or region (e.g. "Paris, France" or "Tokyo"). If unspecified, default to "Tokyo, Japan".
2. Estimate start_date and end_date based on duration mentioned or default to 3 days starting 2026-09-01 (e.g. "2026-09-01" to "2026-09-04").
3. Determine budget level ("Budget ($50-150/day)", "Moderate ($150-300/day)", or "Luxury ($300+/day)").
4. Determine pace ("Relaxed", "Balanced", or "Fast-Paced").
5. Extract list of interest categories (e.g. ["Culture", "Foodie", "Nature", "Shopping", "Art & Museums", "Nightlife"]).
6. Capture any special constraints, dietary notes, or specific places requested in custom_notes.

RETURN ONLY VALID JSON MATCHING THIS EXACT SCHEMA:
{{
    "destination": "Paris, France",
    "start_date": "2026-09-01",
    "end_date": "2026-09-04",
    "budget": "Moderate ($150-300/day)",
    "pace": "Balanced",
    "interests": ["Culture", "Foodie"],
    "travel_style": "Couples Travel",
    "custom_notes": "User requested romantic pasta spots and historic ruins"
}}
"""
    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=system_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            )
        )
        data = json.loads(response.text)
        return ItineraryRequest(
            destination=data.get("destination", "Tokyo, Japan"),
            start_date=data.get("start_date", "2026-09-01"),
            end_date=data.get("end_date", "2026-09-04"),
            budget=data.get("budget", "Moderate ($150-300/day)"),
            interests=data.get("interests", ["Culture", "Foodie"]),
            pace=data.get("pace", "Balanced"),
            travel_style=data.get("travel_style", "Solo Traveler"),
            custom_notes=data.get("custom_notes", user_prompt),
            preferences=prefs
        )
    except Exception as e:
        logger.error(f"Error parsing prompt with Gemini: {e}")
        return ItineraryRequest(
            destination=user_prompt if len(user_prompt) < 40 else "Kyoto, Japan",
            start_date="2026-09-01",
            end_date="2026-09-04",
            budget="Moderate ($150-300/day)",
            interests=["Culture", "Foodie"],
            pace="Balanced",
            custom_notes=user_prompt,
            preferences=prefs
        )


def build_itinerary_prompt(request: ItineraryRequest, prefs: UserPreferences) -> str:
    """Constructs a detailed prompt for Gemini to generate a structured JSON travel itinerary."""
    return f"""
You are Roam, an expert AI autonomous travel agent. Create a highly personalized, grounded, day-by-day travel itinerary.

TRIP DETAILS:
- Destination: {request.destination}
- Dates: {request.start_date} to {request.end_date}
- Budget: {request.budget}
- Interests: {', '.join(request.interests)}
- Travel Pace: {request.pace}
- Travel Style: {request.travel_style}
- Custom User Request: {request.custom_notes or 'None'}

USER SAVED TRAVEL PREFERENCES:
- Dietary Restrictions: {', '.join(prefs.dietary_restrictions) if prefs.dietary_restrictions else 'None'}
- Preferred Transport: {prefs.preferred_transport}
- Accessibility Needs: {', '.join(prefs.accessibility_needs) if prefs.accessibility_needs else 'None'}
- Traveler Profile: {prefs.saved_notes or 'Prefers top-rated cultural highlights and authentic dining.'}

INSTRUCTIONS:
1. Determine the number of days based on start_date and end_date (default to 3 days if dates not clear).
2. For each day, provide 3 to 4 distinct, real-world activities (Morning, Afternoon, Evening/Night).
3. Include real place names, realistic timing, estimated costs in USD or local currency, ratings, and practical travel tips.
4. Include dietary notes for meal recommendations if dietary restrictions are specified.
5. Provide a summary of the trip highlights and overall budget estimate.

REQUIRED JSON OUTPUT FORMAT ONLY:
{{
    "title": "Unforgettable Kyoto Culture & Culinary Journey",
    "destination": "{request.destination}",
    "duration_days": 3,
    "dates": "{request.start_date} to {request.end_date}",
    "estimated_total_cost": "$650 - $900",
    "summary": "A 3-day immersive journey through iconic temples, serene bamboo groves, and local food markets tailored for a balanced pace.",
    "days": [
        {{
            "day_number": 1,
            "date": "{request.start_date}",
            "theme": "Historical Heart & Traditional Teahouses",
            "daily_budget_estimate": "$180",
            "weather_forecast": "Sunny, 22°C",
            "activities": [
                {{
                    "id": "act-1-1",
                    "time_slot": "09:00 AM - 11:30 AM",
                    "title": "Fushimi Inari Taisha Shrine",
                    "category": "Attraction",
                    "description": "Walk through the world-famous thousands of vermilion torii gates early in the morning before crowds arrive.",
                    "location_name": "Fushimi Inari Taisha",
                    "address": "68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto",
                    "estimated_cost": "Free",
                    "rating": 4.8,
                    "google_maps_url": "https://www.google.com/maps/search/?api=1&query=Fushimi+Inari+Taisha+Kyoto",
                    "tips": "Arrive by 8:30 AM for quiet photo opportunities and smooth walking."
                }}
            ]
        }}
    ]
}}
"""


def generate_itinerary(request: ItineraryRequest) -> ItineraryResponse:
    """Generates a complete personalized itinerary using Gemini and tools."""
    saved_prefs = get_user_preferences()
    if request.preferences:
        save_user_preferences(request.preferences)
        saved_prefs = request.preferences

    weather = get_weather_info(request.destination, f"{request.start_date} to {request.end_date}")
    
    client = get_genai_client()
    prompt = build_itinerary_prompt(request, saved_prefs)

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            )
        )
        raw_json = response.text
        data = json.loads(raw_json)
    except Exception as e:
        logger.error(f"Error calling Gemini for itinerary generation: {e}")
        data = {
            "title": f"Explore {request.destination}",
            "destination": request.destination,
            "duration_days": 3,
            "dates": f"{request.start_date} to {request.end_date}",
            "estimated_total_cost": "$500 - $800",
            "summary": f"A personalized itinerary for {request.destination} focused on {', '.join(request.interests)}.",
            "days": [
                {
                    "day_number": 1,
                    "date": request.start_date or "Day 1",
                    "theme": "Arrival & City Overview",
                    "daily_budget_estimate": "$150",
                    "weather_forecast": weather.get("condition", "Pleasant"),
                    "activities": [
                        {
                            "id": "act-1",
                            "time_slot": "10:00 AM - 12:30 PM",
                            "title": f"Explore {request.destination} Historic Center",
                            "category": "Attraction",
                            "description": "Stroll through the iconic central plaza and main historic district.",
                            "location_name": request.destination,
                            "address": request.destination,
                            "estimated_cost": "Free - $20",
                            "rating": 4.7,
                            "google_maps_url": f"https://www.google.com/maps/search/?api=1&query={request.destination}",
                            "tips": "Wear comfortable walking shoes."
                        }
                    ]
                }
            ]
        }

    trip_id = f"trip-{uuid.uuid4().hex[:8]}"
    hero_image = get_destination_image(request.destination, data.get("title", ""))

    grounded_sources = [f"Grounded Google search for {request.destination}"]
    days_data = []
    for d_idx, day_dict in enumerate(data.get("days", [])):
        day_num = d_idx + 1
        activities = []
        for a_idx, act_dict in enumerate(day_dict.get("activities", [])):
            loc_name = act_dict.get("location_name") or act_dict.get("title") or request.destination
            cat = act_dict.get("category", "Attraction")
            maps_url = act_dict.get("google_maps_url")
            if not maps_url:
                import urllib.parse
                maps_url = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(loc_name + ' ' + request.destination)}"

            place_img = get_place_image(loc_name, request.destination, cat)

            activity = Activity(
                id=f"act-{day_num}-{a_idx+1}",
                time_slot=act_dict.get("time_slot", "Flexible"),
                title=act_dict.get("title", "Activity"),
                category=cat,
                description=act_dict.get("description", ""),
                location_name=loc_name,
                address=act_dict.get("address", ""),
                estimated_cost=act_dict.get("estimated_cost", "$10 - $20"),
                rating=float(act_dict.get("rating") or 4.6),
                google_maps_url=maps_url,
                tips=act_dict.get("tips", ""),
                image_url=place_img
            )
            activities.append(activity)

        days_data.append(DayPlan(
            day_number=day_num,
            date=day_dict.get("date", f"Day {day_num}"),
            theme=day_dict.get("theme", "Exploration"),
            daily_budget_estimate=day_dict.get("daily_budget_estimate", "$150"),
            weather_forecast=day_dict.get("weather_forecast") or f"{weather.get('condition', 'Mild')}, {weather.get('avg_temp', '22°C')}",
            activities=activities
        ))

    itinerary_response = ItineraryResponse(
        trip_id=trip_id,
        title=data.get("title", f"Trip to {request.destination}"),
        destination=request.destination,
        duration_days=len(days_data),
        dates=f"{request.start_date} to {request.end_date}",
        estimated_total_cost=data.get("estimated_total_cost", "$600 - $900"),
        hero_image_url=hero_image,
        summary=data.get("summary", "Custom AI-planned travel itinerary."),
        days=days_data,
        user_preferences=saved_prefs,
        grounded_sources=grounded_sources
    )

    save_trip(itinerary_response)
    return itinerary_response


def generate_from_prompt(prompt_req: PromptRequest) -> ItineraryResponse:
    """Extracts trip parameters from prompt using Gemini, then creates itinerary."""
    saved_prefs = get_user_preferences()
    if prompt_req.preferences:
        saved_prefs = prompt_req.preferences

    itinerary_req = parse_prompt_to_itinerary_request(prompt_req.prompt, saved_prefs)
    return generate_itinerary(itinerary_req)


def replan_itinerary(replan_req: ReplanRequest) -> ItineraryResponse:
    """Dynamically re-plans an existing itinerary based on user changes."""
    client = get_genai_client()
    curr = replan_req.current_itinerary
    user_prompt = replan_req.user_prompt

    system_prompt = f"""
You are Roam AI travel assistant.
The user wants to RE-PLAN or MODIFY an existing travel itinerary for {curr.destination}.

CURRENT ITINERARY SUMMARY:
- Title: {curr.title}
- Destination: {curr.destination}
- Dates: {curr.dates}
- Current Days: {json.dumps([d.model_dump() for d in curr.days])}

USER RE-PLANNING INSTRUCTION:
"{user_prompt}"

INSTRUCTIONS:
1. Re-plan or adjust the activities while respecting the user's new requirement.
2. Keep the overall structure valid.
3. Return the COMPLETE UPDATED ITINERARY in JSON format matching the original schema.
"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=system_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            )
        )
        data = json.loads(response.text)
        
        days_data = []
        for d_idx, day_dict in enumerate(data.get("days", [])):
            day_num = d_idx + 1
            activities = []
            for a_idx, act_dict in enumerate(day_dict.get("activities", [])):
                loc_name = act_dict.get("location_name") or act_dict.get("title") or curr.destination
                cat = act_dict.get("category", "Attraction")
                import urllib.parse
                maps_url = act_dict.get("google_maps_url") or f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(loc_name + ' ' + curr.destination)}"
                
                place_img = get_place_image(loc_name, curr.destination, cat)

                activities.append(Activity(
                    id=f"act-r-{day_num}-{a_idx+1}",
                    time_slot=act_dict.get("time_slot", "Flexible"),
                    title=act_dict.get("title", "Activity"),
                    category=cat,
                    description=act_dict.get("description", ""),
                    location_name=loc_name,
                    address=act_dict.get("address", ""),
                    estimated_cost=act_dict.get("estimated_cost", "$10 - $20"),
                    rating=float(act_dict.get("rating") or 4.7),
                    google_maps_url=maps_url,
                    tips=act_dict.get("tips", ""),
                    image_url=place_img
                ))
            
            days_data.append(DayPlan(
                day_number=day_num,
                date=day_dict.get("date", f"Day {day_num}"),
                theme=day_dict.get("theme", "Exploration"),
                daily_budget_estimate=day_dict.get("daily_budget_estimate", "$150"),
                weather_forecast=day_dict.get("weather_forecast", "Updated Weather"),
                activities=activities
            ))

        updated_response = ItineraryResponse(
            trip_id=curr.trip_id,
            title=data.get("title", curr.title),
            destination=curr.destination,
            duration_days=len(days_data),
            dates=curr.dates,
            estimated_total_cost=data.get("estimated_total_cost", curr.estimated_total_cost),
            hero_image_url=curr.hero_image_url,
            summary=data.get("summary", curr.summary),
            days=days_data,
            user_preferences=curr.user_preferences,
            grounded_sources=curr.grounded_sources + [f"Re-planned based on prompt: {user_prompt}"]
        )
        save_trip(updated_response)
        return updated_response
    except Exception as e:
        logger.error(f"Replan error: {e}")
        return curr


# ADK Agent definition (exported for ADK CLI & ADK Web UI)
root_agent = Agent(
    name="roam_agent",
    model=Gemini(
        model=MODEL_NAME,
        retry_options=types.HttpRetryOptions(attempts=3),
    ),
    instruction="You are Roam, an autonomous AI travel agent helping users discover, plan, and dynamically adjust travel itineraries using grounded tools.",
    tools=[search_destination_info, get_weather_info, get_user_preferences, save_user_preferences],
)

agent = root_agent

adk_app = App(
    root_agent=root_agent,
    name="roam_app",
)

app = adk_app
