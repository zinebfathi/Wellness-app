import type { CyclePhase, Intensity, UserProfile, Workout } from "@/types";
import { workoutCatalog, type WorkoutTemplate } from "@/data/workoutCatalog";

// Phase → recommended tags (ordered by priority)
const PHASE_PRIORITY_TAGS: Record<CyclePhase, string[]> = {
  menstrual: ["breathwork", "walking", "mobility", "yoga", "pilates"],
  follicular: ["pilates", "barre", "strength", "running", "SoulCycle", "dance"],
  ovulatory: ["strength", "HIIT", "running", "SoulCycle", "Barry's", "cycling"],
  luteal: ["strength", "pilates", "yoga", "zone2", "barre", "walking"],
};

// Phase → disallowed tags (unless user strongly prefers them)
const PHASE_AVOID_TAGS: Record<CyclePhase, string[]> = {
  menstrual: ["HIIT", "Barry's", "crossfit"],
  follicular: [],
  ovulatory: [],
  luteal: [],
};

// Phase → default intensity cap
const PHASE_INTENSITY: Record<CyclePhase, Intensity> = {
  menstrual: "low",
  follicular: "medium",
  ovulatory: "high",
  luteal: "medium",
};

const INTENSITY_ORDER: Record<Intensity, number> = { low: 0, medium: 1, high: 2 };

function intensityCap(a: Intensity, b: Intensity): Intensity {
  return INTENSITY_ORDER[a] <= INTENSITY_ORDER[b] ? a : b;
}

/**
 * Generate a human-readable cycleFit explanation.
 */
function buildCycleFitReason(
  phase: CyclePhase,
  workout: WorkoutTemplate,
  cycleDay: number
): string {
  const phaseLabels: Record<CyclePhase, string> = {
    menstrual: "Menstrual",
    follicular: "Follicular",
    ovulatory: "Ovulatory",
    luteal: "Luteal",
  };
  const phaseLabel = phaseLabels[phase];

  const explanations: Record<CyclePhase, string> = {
    menstrual: `Day ${cycleDay} — ${phaseLabel} phase. Energy & oestrogen are low. ${workout.type} supports your body with gentle movement and recovery.`,
    follicular: `Day ${cycleDay} — ${phaseLabel} phase. Oestrogen is rising. ${workout.type} is ideal as your energy and strength are building.`,
    ovulatory: `Day ${cycleDay} — ${phaseLabel} phase. Peak oestrogen & testosterone. ${workout.type} matches your high-performance window.`,
    luteal: `Day ${cycleDay} — ${phaseLabel} phase. Progesterone is high. ${workout.type} keeps you moving while managing fatigue.`,
  };

  return explanations[phase];
}

/**
 * Build motivationFit string based on profile motivations.
 */
function buildMotivationFit(
  workout: WorkoutTemplate,
  motivations: string[]
): string {
  const motivationMap: Record<string, string[]> = {
    "feel strong": ["strength", "HIIT", "Barry's", "pilates", "barre"],
    "reduce stress": ["yoga", "breathwork", "walking", "mobility", "pilates"],
    "improve energy": ["running", "SoulCycle", "zone2", "dance", "cycling"],
    "track progress": ["strength", "running", "zone2"],
  };

  const matches = motivations.filter((m) => {
    const tags = motivationMap[m] ?? [];
    return workout.tags.some((t) => tags.includes(t));
  });

  if (matches.length === 0) return "Supports your overall wellness goals.";
  return `Aligns with: ${matches.join(", ")}.`;
}

/**
 * Select the best workout for a given cycle phase and user profile.
 * Returns null if no suitable workout is found.
 */
export function selectWorkout(
  phase: CyclePhase,
  cycleDay: number,
  profile: UserProfile,
  usedTypes: Set<string> = new Set()
): Workout | null {
  const priorityTags = PHASE_PRIORITY_TAGS[phase];
  const avoidTags = PHASE_AVOID_TAGS[phase];
  const maxIntensity = PHASE_INTENSITY[phase];

  // Filter catalog: remove disliked by user AND remove phase-avoid (unless liked)
  let candidates = workoutCatalog.filter((w) => {
    const isDislikedByUser = profile.workout_types_disliked.some((d) =>
      w.tags.includes(d.toLowerCase()) || w.type.toLowerCase().includes(d.toLowerCase())
    );
    if (isDislikedByUser) return false;

    const isPhaseAvoided = avoidTags.some((t) => w.tags.includes(t));
    const isExplicitlyLiked = profile.workout_types_liked.some(
      (l) => w.tags.includes(l.toLowerCase()) || w.type.toLowerCase().includes(l.toLowerCase())
    );
    if (isPhaseAvoided && !isExplicitlyLiked) return false;

    // Intensity cap
    if (INTENSITY_ORDER[w.intensity] > INTENSITY_ORDER[maxIntensity]) return false;

    // Skip types already used this week
    if (usedTypes.has(w.type)) return false;

    return true;
  });

  // Re-run without the used-types filter if we've exhausted options
  if (candidates.length === 0) {
    candidates = workoutCatalog.filter((w) => {
      const isDislikedByUser = profile.workout_types_disliked.some((d) =>
        w.tags.includes(d.toLowerCase()) || w.type.toLowerCase().includes(d.toLowerCase())
      );
      if (isDislikedByUser) return false;
      if (INTENSITY_ORDER[w.intensity] > INTENSITY_ORDER[maxIntensity]) return false;
      return true;
    });
  }

  if (candidates.length === 0) return null;

  // Sort by how many priority tags the workout matches
  const likedTypes = profile.workout_types_liked.map((l) => l.toLowerCase());

  candidates.sort((a, b) => {
    // Priority 1: matches user's liked types
    const aLiked = likedTypes.filter(
      (l) => a.tags.includes(l) || a.type.toLowerCase().includes(l)
    ).length;
    const bLiked = likedTypes.filter(
      (l) => b.tags.includes(l) || b.type.toLowerCase().includes(l)
    ).length;
    if (bLiked !== aLiked) return bLiked - aLiked;

    // Priority 2: matches phase priority tags
    const aScore = priorityTags.filter((t) => a.tags.includes(t)).length;
    const bScore = priorityTags.filter((t) => b.tags.includes(t)).length;
    return bScore - aScore;
  });

  const template = candidates[0];
  const finalIntensity = intensityCap(template.intensity, maxIntensity);

  return {
    id: `${template.type.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    type: template.type,
    intensity: finalIntensity,
    durationMinutes: template.durationMinutes,
    location: template.location,
    cost: template.cost,
    cycleFit: buildCycleFitReason(phase, template, cycleDay),
    motivationFit: buildMotivationFit(template, profile.motivation),
  };
}
