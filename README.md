# 🌍 Roam — Autonomous AI Travel Agent

> Built with **Google Gemini 2.5 Flash**, **Google ADK (Agent Development Kit)**, and **Google Search Grounding** for the *Build with Gemini* hackathon.

![Roam Banner](https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80)

## 📌 Overview

**Roam** is an AI-powered autonomous travel agent designed to turn travel planning into an effortless, personalized, and visually engaging experience. Give Roam your destination, dates, budget, or a freeform natural language prompt like *"Plan a 4-day romantic foodie trip to Rome under $200/day"*, and Roam will handle the rest.

### ✨ Key Features

- 🤖 **Autonomous AI Reasoning**: Powered by Google's `gemini-2.5-flash` model and built on `google-adk`.
- 🔍 **Real-Time Google Search Grounding**: Uses live Google Search to discover real attractions, exact addresses, updated ratings, and price ranges.
- 💬 **Natural Language Trip Parser**: Type freeform prompts; Gemini automatically extracts destination, duration, budget, pace, and dietary constraints.
- 🎨 **Visual Place Photography**: Category-matched high-resolution travel photography thumbnail on every activity card.
- ⚡ **Dynamic Re-Planning**: Change your mind mid-trip (*"Make day 2 vegetarian only"* or *"Add a rooftop dining spot"*), and Roam instantly re-plans the itinerary on the fly.
- 🧠 **Persistent Traveler Preferences**: Remembers your dietary restrictions, preferred transport style, and travel pace across sessions.
- 🗺️ **One-Click Google Maps Integration**: Direct links for navigation to every destination.
- 🛠️ **Google ADK Web Inspector**: Live inspection of agent tool calls, reasoning traces, and state parameters via `adk web`.

---

## 🏗️ Architecture & Technology Stack

- **Agent Framework**: [Google ADK (Agent Development Kit)](https://google.github.io/adk-docs/) (`google.adk.agents.Agent`, `google.adk.apps.App`)
- **LLM**: Gemini 2.5 Flash (`gemini-2.5-flash`) via `google-genai` SDK
- **Backend API**: Python FastAPI + Uvicorn
- **Frontend UI**: Vanilla JavaScript, Modern CSS (Glassmorphism & HSL Color Tokens), HTML5
- **Database**: SQLite persistent storage
- **Deployment**: Google Cloud Run

---

## 🚀 Getting Started Locally

### Prerequisites

- Python 3.11+
- Google Cloud Project with Vertex AI / Gemini API access

### 1. Clone the repository
```bash
git clone https://github.com/SakshiMenghani/buildwithgemini-travel-agent.git
cd buildwithgemini-travel-agent
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set Environment Variables
```bash
export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
export GOOGLE_CLOUD_LOCATION="us-central1"
```

### 4. Run the Roam Web Application
```bash
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Open **`http://localhost:8000`** in your browser!

### 5. Run the Google ADK Developer Web UI
```bash
adk web --host 0.0.0.0 --port 8080 app/
```
Open **`http://localhost:8080`** to inspect the live agent tool call traces.

---

## ☁️ Cloud Deployment (Google Cloud Run)

Deploy directly to Google Cloud Run with one command:
```bash
gcloud run deploy roam-app \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 📄 License
MIT License. Created for the Build with Gemini Track 3.
