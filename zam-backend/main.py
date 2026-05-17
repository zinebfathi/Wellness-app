import json
import os
import logging
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from anthropic import Anthropic
import httpx

# Load environment variables
import pathlib
env_path = pathlib.Path(__file__).parent / ".env"
load_dotenv(env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="ZAM Onboarding Backend")

# Add CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Demo: hardcode Sara's profile ID
SARA_PROFILE_ID = "4abacc43-f9f7-436f-abf2-cb875c163df5"

if not all([ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("Missing required environment variables. Check .env file.")

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

# Request/Response models
class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class OnboardingRequest(BaseModel):
    message: str
    history: list[Message]
    session_id: str

class OnboardingResponse(BaseModel):
    reply: str
    profile_complete: bool
    profile: Optional[dict] = None
    user_id: Optional[str] = None

# System prompt for Claude
ONBOARDING_SYSTEM_PROMPT = """You are ZAM, a warm and intelligent women's health and fitness companion.

You are onboarding a new user through a natural conversation. Your goal is to learn enough about her to build a complete profile. Do not ask all questions at once. Ask one or two at a time. Be conversational, warm, and specific. When the user mentions something interesting, follow up on it before moving on.

You need to collect the following information through conversation:
- Her name
- Her age
- Her location (city and country)
- Her fitness goals (e.g. energy, strength, stress relief, consistency, weight loss)
- What workout types she likes and dislikes
- What motivates her in a workout (music, community, coach energy, anonymity, being outdoors, solo time, competition, etc.)
- How many times per week she wants to work out
- Her monthly fitness budget in USD
- What insights she wants to track (select from: cycle_symptoms, energy_levels, stress, athletic_performance, hormonal_cravings, sleep_quality, skin_and_bloating, work_performance, social_energy)
- Whether she uses a wearable and which one (Aura, Fitbit, Apple Watch, Garmin, none, etc.)
- Any existing memberships or subscriptions (Soul Cycle, Peloton, gym, etc.)
- Any medical notes relevant to fitness (optional, she can skip this)
- Her average cycle length if she knows it (optional, she can skip this)
- Did she notice anything in particular about her feelings during her cycle (or direct us to link to a cycle tracking app such as Flo)

Once you have collected all required fields (name, age, location, goals, workout preferences, motivation, frequency, budget, tracking preferences), respond with a JSON object in this exact format and nothing else:

PROFILE_COMPLETE:
{
  "reply": "A warm, brief closing message that tells her you have everything you need and you are building her first week now. Let her know her profile has been saved and she can review and update any of it at any time from her profile page. Do not list back what she told you. Do not summarise the fields. Just close the conversation warmly and move her forward.",
  "profile_complete": true,
  "profile": {
    "name": string,
    "age": integer,
    "location": string,
    "cycle_length_days": integer or null,
    "cycle_variability_days": null,
    "date_of_last_cycle": date or null,
    "budget_monthly_usd": integer,
    "workout_preferences": [array of strings],
    "motivation": [array of strings],
    "workout_types_liked": [array of strings],
    "workout_types_disliked": [array of strings],
    "frequency_per_week_goal": integer,
    "wearable": string or null,
    "tracking_preferences": [array of strings],
    "memberships": [array of strings],
    "medical_notes": string or null
  }
}

Until you have collected all required fields, respond with ONLY this JSON format (NO text before or after, NO markdown code blocks):
{"reply": "your warm conversational message here", "profile_complete": false, "profile": null}

CRITICAL: You MUST return valid JSON on every single response. Start with { and end with }. Never include text outside the JSON object."""

@app.post("/api/onboarding")
async def onboarding(request: OnboardingRequest) -> OnboardingResponse:
    """
    Multi-turn onboarding endpoint.

    Accepts user message + conversation history, calls Claude to continue the conversation,
    and returns a response. When enough information is collected, writes profile to Supabase.
    """
    try:
        # Convert history to Anthropic format
        messages = [{"role": msg.role, "content": msg.content} for msg in request.history]

        # Add the new user message
        messages.append({"role": "user", "content": request.message})

        # Call Claude API
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=ONBOARDING_SYSTEM_PROMPT,
            messages=messages,
        )

        # Extract Claude's response
        claude_response = response.content[0].text

        # Strip markdown code blocks if present
        if "```" in claude_response:
            parts = claude_response.split("```")
            claude_response = parts[1]
            if claude_response.startswith("json"):
                claude_response = claude_response[4:]
            claude_response = claude_response.strip()

        # Try to extract JSON if there's text before/after it
        if not claude_response.startswith("{"):
            # Look for JSON object in the response
            start_idx = claude_response.find("{")
            if start_idx != -1:
                claude_response = claude_response[start_idx:]

        if claude_response.endswith("}"):
            pass  # Good
        else:
            # Try to find the last closing brace
            last_brace = claude_response.rfind("}")
            if last_brace != -1:
                claude_response = claude_response[:last_brace+1]

        # Parse the JSON response from Claude
        try:
            parsed_response = json.loads(claude_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude's JSON response: {e}")
            logger.error(f"Claude response was: {claude_response[:300]}")
            return OnboardingResponse(
                reply="Something went wrong on my end. Could you repeat that?",
                profile_complete=False,
                profile=None,
            )

        # Extract fields from parsed response
        reply = parsed_response.get("reply", "")
        profile_complete = parsed_response.get("profile_complete", False)
        profile = parsed_response.get("profile")

        # If profile is complete, return Sara's profile (demo mode)
        user_id = None
        if profile_complete and profile:
            # Demo: Always use Sara's profile ID
            user_id = SARA_PROFILE_ID
            logger.info(f"Demo mode: Linking to Sara's profile {user_id}")

        return OnboardingResponse(
            reply=reply,
            profile_complete=profile_complete,
            profile=profile,
            user_id=user_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in onboarding endpoint: {e}")
        return OnboardingResponse(
            reply="Something went wrong on my end. Could you repeat that?",
            profile_complete=False,
            profile=None,
        )

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
