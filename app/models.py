from typing import List, Optional
from pydantic import BaseModel, Field


class UserPreferences(BaseModel):
    user_name: str = Field(default="Sakshi", description="Traveler's name")
    user_avatar: str = Field(default="avatar_1", description="Selected avatar icon/preset")
    personality_type: str = Field(default="Culture Enthusiast & Foodie Explorer", description="Extracted traveler personality archetype")
    dietary_restrictions: List[str] = Field(default_factory=list, description="e.g. ['Vegetarian', 'Gluten-Free']")
    travel_pace: str = Field(default="Balanced", description="Relaxed, Balanced, or Fast-Paced")
    budget_level: str = Field(default="Moderate", description="Budget, Moderate, Luxury")
    interests: List[str] = Field(default_factory=list, description="e.g. ['Culture', 'Foodie', 'Nature', 'Shopping']")
    preferred_transport: str = Field(default="Public Transit / Walking", description="Walking, Public Transit, Taxi, Car Rental")
    accessibility_needs: List[str] = Field(default_factory=list, description="e.g. ['Wheelchair accessible', 'Avoid staircases']")
    saved_notes: Optional[str] = Field(default="", description="General notes or rules for future itineraries")
    past_destinations: List[str] = Field(default_factory=list, description="History of past planned destinations (e.g. ['NYC', 'Paris'])")


class ItineraryRequest(BaseModel):
    destination: str
    start_date: Optional[str] = "2026-09-01"
    end_date: Optional[str] = "2026-09-04"
    budget: Optional[str] = "Moderate ($150-300/day)"
    interests: List[str] = Field(default_factory=lambda: ["Culture", "Foodie", "Sightseeing"])
    pace: Optional[str] = "Balanced"
    travel_style: Optional[str] = "Solo Traveler"
    custom_notes: Optional[str] = ""
    preferences: Optional[UserPreferences] = None


class PromptRequest(BaseModel):
    prompt: str = Field(description="Freeform travel request, e.g. '5 days in Rome with my partner focusing on pasta, historic ruins, and a relaxed pace in October'")
    preferences: Optional[UserPreferences] = None


class Activity(BaseModel):
    id: Optional[str] = None
    time_slot: str = Field(description="e.g. '09:00 AM - 11:30 AM' or 'Morning'")
    title: str = Field(description="Name of the attraction, restaurant, or activity")
    category: str = Field(description="Attraction, Restaurant, Cafe, Shopping, Relaxation, Transport")
    description: str = Field(description="Detailed overview of what to do and why it fits preferences")
    location_name: str = Field(description="Exact place name")
    address: Optional[str] = ""
    estimated_cost: Optional[str] = "$15 - $25"
    rating: Optional[float] = 4.7
    google_maps_url: Optional[str] = ""
    tips: Optional[str] = "e.g. Book tickets online in advance"
    image_url: Optional[str] = Field(default=None, description="Image URL of the location or activity")


class DayPlan(BaseModel):
    day_number: int
    date: str
    theme: str = Field(description="Main focus for the day, e.g. 'Historical Old Town & Culinary Delights'")
    activities: List[Activity]
    daily_budget_estimate: Optional[str] = "$120"
    weather_forecast: Optional[str] = "Sunny, 22°C"


class ItineraryResponse(BaseModel):
    trip_id: str
    title: str
    destination: str
    duration_days: int
    dates: str
    estimated_total_cost: str
    hero_image_url: Optional[str] = None
    summary: str
    days: List[DayPlan]
    user_preferences: UserPreferences
    grounded_sources: List[str] = Field(default_factory=list)


class ReplanRequest(BaseModel):
    trip_id: str
    user_prompt: str = Field(description="e.g. 'Day 2 will be raining, swap outdoor activities for indoor museums'")
    current_itinerary: ItineraryResponse
    updated_preferences: Optional[UserPreferences] = None
