import { NextResponse } from "next/server";
import Groq from "groq-sdk";

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
}

const THEME_PROMPTS = {
  sprint_fun: "fun, lighthearted retrospective ice-breaker questions about software sprints, team dynamics, and developer life",
  team_bonding: "warm team bonding questions that help teammates learn something new about each other — hobbies, preferences, dreams, fun facts",
  creative_thinking: "creative and imaginative hypothetical questions that spark lateral thinking — 'what if' scenarios, superpowers, time travel, inventions",
  gratitude: "appreciation and gratitude-focused questions — recognizing others, celebrating small wins, thankful moments",
  energy_check: "mood and energy check-in questions — how people are feeling, what recharges them, stress relievers, weekend highlights",
  random_fun: "completely random, quirky, and hilarious questions — unpopular opinions, weird hypotheticals, absurd choices",
  movie_music: "pop culture questions related to movies, music, TV shows, books, and games — connecting work to entertainment",
  food_travel: "food and travel themed questions — dream vacations, favorite cuisines, cooking disasters, bucket list places",
};

const FALLBACK_QUESTIONS = [
  "If your last sprint were a movie, what genre would it be?",
  "What superpower would have made this sprint easier?",
  "Describe your sprint in exactly three emojis.",
  "If our team were a band, what instrument would you play?",
  "What song best describes how this sprint went?",
];

export async function POST(req) {
  try {
    const { count = 5, theme = "sprint_fun" } = await req.json();
    const themeDesc = THEME_PROMPTS[theme] || THEME_PROMPTS.sprint_fun;
    const safeCount = Math.min(Math.max(count, 1), 15);

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ questions: FALLBACK_QUESTIONS.slice(0, safeCount), source: "fallback" });
    }

    const chatCompletion = await getGroq().chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a fun, creative retrospective facilitator. Generate exactly ${safeCount} unique ice-breaker questions. The theme is: ${themeDesc}. Rules: 1) Each question must be concise (under 25 words). 2) Questions should be fun and engaging. 3) No numbering, no bullet points. 4) Return ONLY a JSON array of strings, nothing else. Example: ["question1", "question2"]`,
        },
        {
          role: "user",
          content: `Generate ${safeCount} ice-breaker questions for a sprint retrospective with the theme: "${theme.replace(/_/g, " ")}". Return only a JSON array.`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.9,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const raw = chatCompletion.choices[0]?.message?.content;
    const parsed = JSON.parse(raw);
    const questions = Array.isArray(parsed) ? parsed : parsed.questions || parsed.items || Object.values(parsed)[0];

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Invalid AI response format");
    }

    return NextResponse.json({ questions: questions.slice(0, safeCount), source: "groq" });
  } catch (err) {
    console.error("Ice-breaker generation failed:", err);
    return NextResponse.json({ questions: FALLBACK_QUESTIONS, source: "fallback" });
  }
}
