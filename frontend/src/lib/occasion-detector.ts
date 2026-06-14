/**
 * Proactive Occasion Detection
 * 
 * Scans user text input in real-time and suggests relevant occasion templates
 * when keyword signals are detected. Lightweight, client-side only.
 */

import { occasions } from "./mock/needspeak";

export interface OccasionSuggestion {
  /** Occasion ID from the templates */
  id: string;
  /** Display name */
  name: string;
  /** Emoji */
  emoji: string;
  /** The template prompt */
  prompt: string;
  /** Matched keyword(s) that triggered this */
  matchedKeywords: string[];
  /** Confidence level */
  confidence: "high" | "medium";
}

/**
 * Keyword map: input keywords → occasion IDs
 * Each entry maps trigger words to their most relevant occasion template.
 * Uses word-boundary matching to avoid false positives.
 */
const OCCASION_KEYWORDS: Array<{
  keywords: string[];
  occasionId: string;
  confidence: "high" | "medium";
}> = [
  // IPL / Cricket
  {
    keywords: ["ipl", "cricket", "match", "watch party", "finals", "t20"],
    occasionId: "ipl",
    confidence: "high",
  },
  // Birthday
  {
    keywords: ["birthday", "bday", "b'day", "cake", "candle"],
    occasionId: "birthday",
    confidence: "high",
  },
  // Weekly groceries
  {
    keywords: ["weekly", "grocery", "groceries", "staples", "ration", "monthly"],
    occasionId: "weekly",
    confidence: "medium",
  },
  // Hostel
  {
    keywords: ["hostel", "dorm", "pg", "mess", "student room"],
    occasionId: "hostel",
    confidence: "high",
  },
  // Travel
  {
    keywords: ["travel", "trip", "journey", "vacation", "holiday", "trek", "camping"],
    occasionId: "travel",
    confidence: "high",
  },
  // Festival / Diwali
  {
    keywords: ["diwali", "holi", "navratri", "dussehra", "festival", "puja", "pooja", "eid", "christmas"],
    occasionId: "festival",
    confidence: "high",
  },
  // Picnic
  {
    keywords: ["picnic", "outing", "park", "outdoor", "bbq", "barbecue"],
    occasionId: "picnic",
    confidence: "high",
  },
  // Baby shower
  {
    keywords: ["baby shower", "baby", "expecting", "newborn", "godh bharai"],
    occasionId: "baby-shower",
    confidence: "medium",
  },
  // Exam prep
  {
    keywords: ["exam", "study", "revision", "late night", "all-nighter"],
    occasionId: "exam-prep",
    confidence: "medium",
  },
  // Party (generic → IPL or birthday depending on context)
  {
    keywords: ["party", "get-together", "gathering", "hangout", "friends coming"],
    occasionId: "ipl",
    confidence: "medium",
  },
];

/**
 * Detect if the user's typed text matches any occasion template.
 * Returns a suggestion or null.
 * 
 * Only triggers after 3+ words to avoid false positives on partial typing.
 */
export function detectOccasion(inputText: string): OccasionSuggestion | null {
  if (!inputText || inputText.trim().length < 5) return null;

  const text = inputText.toLowerCase().trim();
  const wordCount = text.split(/\s+/).length;

  // Don't trigger on very short inputs (< 3 words) — too noisy
  if (wordCount < 2) return null;

  let bestMatch: { occasionId: string; matchedKeywords: string[]; confidence: "high" | "medium" } | null = null;

  for (const entry of OCCASION_KEYWORDS) {
    const matched: string[] = [];

    for (const keyword of entry.keywords) {
      // For multi-word keywords, check direct inclusion
      if (keyword.includes(" ")) {
        if (text.includes(keyword)) {
          matched.push(keyword);
        }
      } else {
        // Single-word: use word boundary
        const regex = new RegExp(`\\b${keyword}\\b`, "i");
        if (regex.test(text)) {
          matched.push(keyword);
        }
      }
    }

    if (matched.length > 0) {
      // Prefer high confidence matches, or more keyword matches
      if (
        !bestMatch ||
        entry.confidence === "high" && bestMatch.confidence === "medium" ||
        (entry.confidence === bestMatch.confidence && matched.length > bestMatch.matchedKeywords.length)
      ) {
        bestMatch = {
          occasionId: entry.occasionId,
          matchedKeywords: matched,
          confidence: entry.confidence,
        };
      }
    }
  }

  if (!bestMatch) return null;

  // Find the occasion template
  const occasion = occasions.find((o) => o.id === bestMatch!.occasionId);
  if (!occasion) return null;

  return {
    id: occasion.id,
    name: occasion.name,
    emoji: occasion.emoji,
    prompt: occasion.prompt,
    matchedKeywords: bestMatch.matchedKeywords,
    confidence: bestMatch.confidence,
  };
}
