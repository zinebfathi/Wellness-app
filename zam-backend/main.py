import json
import os
import logging
from typing import Optional
from datetime import datetime, date as date_type
from math import floor

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

# Global variable for science prompt (loaded at startup)
SCIENCE_PROMPT = ""

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_cycle_position(last_period_start: date_type, cycle_length_days: int, today: date_type) -> dict:
    """
    Calculate menstrual cycle position given last period start and cycle length.

    Returns:
        {
            "cycle_day": int (1-based),
            "phase": str,
            "days_until_next_phase": int
        }
    """
    days_since_start = (today - last_period_start).days
    cycle_day = (days_since_start % cycle_length_days) + 1

    # Scale standard 28-day boundaries to user's actual cycle length
    scale = cycle_length_days / 28.0

    # Standard boundaries (28-day cycle)
    menstrual_end = floor(5 * scale)
    follicular_end = floor(13 * scale)
    ovulation_end = floor(16 * scale)

    # Determine phase and days until next phase
    if cycle_day <= menstrual_end:
        phase = "menstrual"
        days_until_next = menstrual_end - cycle_day + 1
    elif cycle_day <= follicular_end:
        phase = "follicular"
        days_until_next = follicular_end - cycle_day + 1
    elif cycle_day <= ovulation_end:
        phase = "ovulation"
        days_until_next = ovulation_end - cycle_day + 1
    else:
        phase = "luteal"
        days_until_next = cycle_length_days - cycle_day + 1

    return {
        "cycle_day": cycle_day,
        "phase": phase,
        "days_until_next_phase": days_until_next
    }


def get_workout_intensity(workout_type: str) -> dict:
    """
    Map workout type to intensity level.

    Returns:
        {
            "intensity": str ("high", "medium", or "low"),
            "unknown_intensity": bool
        }
    """
    workout_lower = workout_type.lower().strip()

    high_intensity = [
        "soul cycle", "barry's bootcamp", "hiit", "crossfit", "boxing",
        "spinning", "boot camp"
    ]

    medium_intensity = [
        "peloton", "pilates", "yoga flow", "dance cardio", "outdoor run",
        "swim", "weight training", "barre"
    ]

    low_intensity = [
        "walk", "stretching", "restorative yoga", "foam rolling",
        "gentle yoga", "mobility"
    ]

    # Check high intensity
    for workout in high_intensity:
        if workout in workout_lower:
            return {"intensity": "high", "unknown_intensity": False}

    # Check medium intensity
    for workout in medium_intensity:
        if workout in workout_lower:
            return {"intensity": "medium", "unknown_intensity": False}

    # Check low intensity
    for workout in low_intensity:
        if workout in workout_lower:
            return {"intensity": "low", "unknown_intensity": False}

    # Unknown: default to medium and flag it
    return {"intensity": "medium", "unknown_intensity": True}


def load_science_prompt():
    """Load science prompt from Supabase womens_health_research table."""
    global SCIENCE_PROMPT
    try:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        }

        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/womens_health_research",
            headers=headers,
            timeout=10.0,
        )

        if response.status_code == 200:
            rows = response.json()
            science_text = ""
            for row in rows:
                section = row.get("section", "").upper()
                content = row.get("content", "")
                science_text += f"\n\n=== {section} ===\n{content}"
            SCIENCE_PROMPT = science_text
            logger.info(f"Loaded science prompt with {len(rows)} sections")
        else:
            logger.warning(f"Could not load science prompt: {response.status_code}")
            SCIENCE_PROMPT = ""
    except Exception as e:
        logger.warning(f"Error loading science prompt: {e}")
        SCIENCE_PROMPT = ""


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

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

class WorkoutMessageRequest(BaseModel):
    user_id: str
    date: str  # ISO format e.g. "2026-05-17"

class WorkoutCTA(BaseModel):
    label: str
    style: str  # "primary" or "secondary"
    action: str

class WorkoutMessageResponse(BaseModel):
    screen: str
    determination: str
    message: str
    science_reason: str
    workout_guidance: str
    rest_benefit: Optional[str] = None
    ctas: list[WorkoutCTA]
    context: dict

class DailyCheckRequest(BaseModel):
    user_id: str
    date: str  # ISO format

class DailyCheckResponse(BaseModel):
    workout_scheduled: bool
    reason: Optional[str] = None
    message: Optional[str] = None
    screen: str
    already_confirmed: Optional[bool] = None
    workout: Optional[dict] = None

# ============================================================================
# ONBOARDING SYSTEM PROMPT
# ============================================================================

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

# ============================================================================
# ENDPOINTS
# ============================================================================

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


@app.post("/api/workout-message")
async def workout_message(request: WorkoutMessageRequest) -> WorkoutMessageResponse:
    """
    Workout message endpoint: assembles context and calls Claude to generate
    a personalized workout recommendation for the day.
    """
    try:
        # Parse the date
        try:
            today = datetime.fromisoformat(request.date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DD).")

        user_id = request.user_id
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        }

        # STEP 1: Pull user profile from Supabase profiles table
        profile_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}",
            headers=headers,
            timeout=10.0,
        )

        if profile_response.status_code != 200 or not profile_response.json():
            raise HTTPException(status_code=404, detail="User profile not found.")

        profile = profile_response.json()[0]

        # STEP 2: Calculate cycle position
        cycle_info = None
        if profile.get("last_period_start_date") and profile.get("cycle_length_days"):
            try:
                last_period = datetime.fromisoformat(profile["last_period_start_date"]).date()
                cycle_info = calculate_cycle_position(
                    last_period_start=last_period,
                    cycle_length_days=profile["cycle_length_days"],
                    today=today
                )
            except Exception as e:
                logger.warning(f"Could not calculate cycle position: {e}")

        # STEP 3: Pull today's readiness from daily_state
        daily_state_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/daily_state?user_id=eq.{user_id}&date=eq.{request.date}",
            headers=headers,
            timeout=10.0,
        )

        if daily_state_response.status_code != 200 or not daily_state_response.json():
            raise HTTPException(status_code=404, detail="No readiness data found for this date.")

        daily_state = daily_state_response.json()[0]

        # STEP 4: Pull today's scheduled workout from weekly_plans
        weekly_plans_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/weekly_plans?user_id=eq.{user_id}",
            headers=headers,
            timeout=10.0,
        )

        if weekly_plans_response.status_code != 200 or not weekly_plans_response.json():
            raise HTTPException(status_code=404, detail="No weekly plan found for user.")

        weekly_plan = weekly_plans_response.json()[0]
        plan_array = weekly_plan.get("plan", [])

        # Find workout for today
        workout = None
        for item in plan_array:
            if item.get("date") == request.date:
                workout = item
                break

        if not workout:
            raise HTTPException(status_code=404, detail="No workout scheduled for this date.")

        # STEP 5: Calculate workout intensity
        intensity_info = get_workout_intensity(workout.get("type", ""))

        # STEP 6: Assemble full context object
        context = {
            "user": {
                "name": profile.get("name", ""),
                "workout_preferences": profile.get("workout_preferences", []),
                "motivation": profile.get("motivation", []),
                "tracking_preferences": profile.get("tracking_preferences", []),
            },
            "today": {
                "date": request.date,
                "readiness_score": daily_state.get("readiness_score"),
                "sleep_hours": daily_state.get("sleep_hours"),
                "hrv_ms": daily_state.get("hrv_ms"),
                "resting_hr": daily_state.get("resting_hr"),
                "stress_level": daily_state.get("stress_level"),
                "body_temperature_offset": daily_state.get("body_temperature_offset"),
                "tags": daily_state.get("tags", []),
            },
            "cycle": {
                "cycle_day": cycle_info["cycle_day"] if cycle_info else None,
                "phase": cycle_info["phase"] if cycle_info else "unknown",
                "days_until_next_phase": cycle_info["days_until_next_phase"] if cycle_info else None,
                "cycle_length_days": profile.get("cycle_length_days"),
            },
            "workout": {
                "type": workout.get("type"),
                "time": workout.get("time"),
                "studio": workout.get("studio"),
                "format": workout.get("format"),
                "cost_usd": workout.get("cost_usd"),
                "intensity": intensity_info["intensity"],
                "unknown_intensity": intensity_info["unknown_intensity"],
            },
        }

        # STEP 7: Call Claude
        system_prompt = f"""{SCIENCE_PROMPT}

You are Flowra, a women's health and fitness companion. You have been
given a full picture of where this user is today: her readiness data
from her wearable, her position in her menstrual cycle calculated from
her last period start date and average cycle length, and her scheduled
workout including its intensity level.

Your job is to reason across all of these inputs together — not
independently — and decide what to tell her about today's workout.

This is multi-factor reasoning. No single input makes the decision.
A high readiness score does not automatically mean push hard if she
is in late luteal phase. A luteal phase does not automatically mean
rest if her readiness is strong and it is early luteal. A high intensity
workout does not automatically mean reduce effort if she is in follicular
phase with high readiness. You are weighing all factors together.

Use the science provided to explain your reasoning. Always name the
specific hormone and mechanism. Always reference her actual numbers.
Always reference her specific workout type — not a generic workout.

DECISION FRAMEWORK:
Consider these factors together:
1. Readiness score (0–100 from wearable)
2. HRV relative to what is typical (high HRV = recovered, low = fatigued)
3. Cycle phase and day within that phase (early luteal is different
   from late luteal)
4. Days until next phase (day 27 of luteal is different from day 17)
5. Workout intensity (high intensity demands more from the body)
6. Stress level and tags from today
7. Sleep hours last night
8. Body temperature offset (positive offset = luteal/menstrual signal)

After reasoning across all factors, make one of three determinations:

DETERMINATION A — GO:
Conditions support doing this workout at full or near-full intensity.
Message is motivational, specific to the workout, references the science
for why today is a strong day.

DETERMINATION B — MODIFY:
Conditions support doing this workout but with specific adjustments.
Message names exactly what to adjust for this specific workout type.
For cycling: resistance. For weights: load percentage. For HIIT:
interval length or rounds. Not generic. Specific.
Message includes psychological safety — lower output today is
physiologically expected, not a personal failure.

DETERMINATION C — REST:
Conditions across multiple factors point toward rest being the
genuinely better choice for her long-term performance and wellbeing.
Only reach this determination when readiness is low AND phase is
late luteal or menstrual AND intensity is high. Not for any single
factor alone.
Message leads with permission and science — explain what rest does
for her performance next week. Offer two gentle movement alternatives.
Never guilt. Never comparison.

SCREEN FIELD:
Based on your determination return one of:
  "green"  for DETERMINATION A
  "amber"  for DETERMINATION B
  "red"    for DETERMINATION C

The frontend uses this field to decide which screen layout to render.
It does not make this decision itself.

OUTPUT FORMAT:
Return valid JSON only. No prose outside the JSON. No markdown.
No explanation of your reasoning outside the JSON fields.

{{
  "screen": "green" or "amber" or "red",
  "determination": "go" or "modify" or "rest",
  "message": string,           // main message to the user, 2–3 sentences,
                               // warm and specific to her situation
  "science_reason": string,    // one sentence naming the hormone and
                               // mechanism behind your determination
  "workout_guidance": string,  // specific guidance for THIS workout type
                               // today. Not generic. References the actual
                               // activity by name.
  "rest_benefit": string or null,  // only populated for red determination:
                               // one sentence on what rest does for her
                               // performance next week
  "ctas": [                    // you decide how many and what they say
                               // based on determination:
                               // green: one primary CTA
                               // amber: one primary + two secondary
                               // red: one primary rest CTA + two gentle
                               //      movement alternatives
      {{
        "label": string,
        "style": "primary" or "secondary",
        "action": string       // snake_case identifier
      }}
  ]
}}
"""

        user_message = f"Today is {request.date}. {context['user']['name']} has {workout.get('type')} scheduled at {workout.get('time')}. Generate her workout day message."

        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        claude_response = response.content[0].text

        # Try to extract JSON
        if not claude_response.startswith("{"):
            start_idx = claude_response.find("{")
            if start_idx != -1:
                claude_response = claude_response[start_idx:]

        if not claude_response.endswith("}"):
            last_brace = claude_response.rfind("}")
            if last_brace != -1:
                claude_response = claude_response[:last_brace+1]

        # Parse response
        try:
            parsed = json.loads(claude_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude's JSON: {e}")
            raise HTTPException(
                status_code=500,
                detail="Recommendation engine error. Please try again."
            )

        # Build response with context
        return WorkoutMessageResponse(
            screen=parsed.get("screen", "amber"),
            determination=parsed.get("determination", "modify"),
            message=parsed.get("message", ""),
            science_reason=parsed.get("science_reason", ""),
            workout_guidance=parsed.get("workout_guidance", ""),
            rest_benefit=parsed.get("rest_benefit"),
            ctas=[WorkoutCTA(**cta) for cta in parsed.get("ctas", [])],
            context={
                "readiness_score": daily_state.get("readiness_score"),
                "phase": cycle_info["phase"] if cycle_info else "unknown",
                "cycle_day": cycle_info["cycle_day"] if cycle_info else None,
                "days_until_next_phase": cycle_info["days_until_next_phase"] if cycle_info else None,
                "workout_type": workout.get("type"),
                "workout_intensity": intensity_info["intensity"],
                "sleep_hours": daily_state.get("sleep_hours"),
                "stress_level": daily_state.get("stress_level"),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in workout-message endpoint: {e}")
        raise HTTPException(status_code=500, detail="Recommendation engine error. Please try again.")


@app.post("/api/daily-check")
async def daily_check(request: DailyCheckRequest) -> DailyCheckResponse:
    """
    Daily check endpoint: entry point that checks if there's a workout scheduled,
    handles travel days and rest days, and calls /api/workout-message if needed.
    """
    try:
        # Parse the date
        try:
            today = datetime.fromisoformat(request.date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DD).")

        user_id = request.user_id
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        }

        # STEP 1: Check if travel day
        calendar_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/calendar?user_id=eq.{user_id}&date=eq.{request.date}",
            headers=headers,
            timeout=10.0,
        )

        if calendar_response.status_code == 200 and calendar_response.json():
            calendar_entry = calendar_response.json()[0]
            if calendar_entry.get("travel_day"):
                return DailyCheckResponse(
                    workout_scheduled=False,
                    reason="travel_day",
                    message="You are travelling today. Your plan is paused. Have a good trip.",
                    screen="travel",
                )

        # STEP 2: Check if workout is scheduled for today
        weekly_plans_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/weekly_plans?user_id=eq.{user_id}",
            headers=headers,
            timeout=10.0,
        )

        if weekly_plans_response.status_code != 200 or not weekly_plans_response.json():
            return DailyCheckResponse(
                workout_scheduled=False,
                reason="rest_day",
                message="No workout scheduled today. Enjoy your rest day.",
                screen="rest_day",
            )

        weekly_plan = weekly_plans_response.json()[0]
        plan_array = weekly_plan.get("plan", [])

        # Find workout for today
        workout = None
        for item in plan_array:
            if item.get("date") == request.date:
                workout = item
                break

        if not workout:
            return DailyCheckResponse(
                workout_scheduled=False,
                reason="rest_day",
                message="No workout scheduled today. Enjoy your rest day.",
                screen="rest_day",
            )

        # STEP 3: Check if already confirmed
        if workout.get("confirmed"):
            user_name = ""
            profile_response = httpx.get(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}",
                headers=headers,
                timeout=10.0,
            )
            if profile_response.status_code == 200 and profile_response.json():
                user_name = profile_response.json()[0].get("name", "")

            return DailyCheckResponse(
                workout_scheduled=True,
                already_confirmed=True,
                workout=workout,
                screen="already_confirmed",
                message=f"You already confirmed your {workout.get('type')} today. You are all set.",
            )

        # STEP 4: Workout exists and not confirmed - call /api/workout-message
        # Check if readiness data exists
        daily_state_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/daily_state?user_id=eq.{user_id}&date=eq.{request.date}",
            headers=headers,
            timeout=10.0,
        )

        if daily_state_response.status_code != 200 or not daily_state_response.json():
            return DailyCheckResponse(
                workout_scheduled=True,
                reason="no_readiness_data",
                message="No readiness data for today. Please sync your wearable.",
                screen="no_readiness_data",
            )

        # STEP 5: Call the workout-message endpoint
        workout_msg_response = await workout_message(
            WorkoutMessageRequest(user_id=user_id, date=request.date)
        )

        # Return the full workout message response
        # Convert it back to a dict for the response
        return DailyCheckResponse(
            workout_scheduled=True,
            workout=workout,
            screen=workout_msg_response.screen,
            message=workout_msg_response.message,
            # Include the full response details in a separate field if needed
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in daily-check endpoint: {e}")
        raise HTTPException(status_code=500, detail="Daily check error. Please try again.")


@app.post("/api/refresh-science")
async def refresh_science():
    """Reload science prompt from Supabase without restarting the server."""
    try:
        load_science_prompt()
        return {"status": "ok", "message": "Science prompt refreshed"}
    except Exception as e:
        logger.error(f"Error refreshing science prompt: {e}")
        raise HTTPException(status_code=500, detail="Error refreshing science prompt")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


# ============================================================================
# STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Load science prompt on startup."""
    load_science_prompt()
    logger.info("ZAM backend started. Science prompt loaded.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
