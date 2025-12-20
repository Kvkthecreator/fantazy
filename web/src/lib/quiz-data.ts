/**
 * Quiz Mode Data - "What's Your Red Flag?"
 * Per QUIZ_MODE_SPEC.md
 */

import type { QuizQuestion, RomanticTrope } from "@/types";

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "They finally text back after 6 hours. You:",
    options: [
      { text: "Wait exactly 6 hours and 1 minute to respond. Balance.", trope: "push_pull" },
      { text: "Already drafted 4 versions of your reply in Notes", trope: "slow_burn" },
      { text: '"Finally! I was starting to spiral" (send immediately)', trope: "all_in" },
      { text: "Check if they've been active elsewhere first", trope: "slow_reveal" },
      { text: "Wonder if this is the universe giving you a second chance", trope: "second_chance" },
    ],
  },
  {
    id: 2,
    question: "Your ex likes your Instagram story. You:",
    options: [
      { text: "Screenshot it and send to the group chat for analysis", trope: "slow_burn" },
      { text: "Already know what it means. Time to have The Talk.", trope: "all_in" },
      { text: "Like something of theirs back. The game is on.", trope: "push_pull" },
      { text: "Ignore it but check their profile 3 times that day", trope: "slow_reveal" },
      { text: "Feel a flutter. Maybe the timing is finally right?", trope: "second_chance" },
    ],
  },
  {
    id: 3,
    question: "On a first date, you're most likely to:",
    options: [
      { text: "Ask about their last relationship (for research purposes)", trope: "second_chance" },
      { text: "Tell them you're having a great time. Out loud. With words.", trope: "all_in" },
      { text: "Tease them until they're slightly confused but intrigued", trope: "push_pull" },
      { text: "Give them just enough to want a second date", trope: "slow_reveal" },
      { text: "Enjoy the tension of not knowing where this is going", trope: "slow_burn" },
    ],
  },
  {
    id: 4,
    question: "When you catch feelings, you:",
    options: [
      { text: "Tell them. Life's too short for games.", trope: "all_in" },
      { text: "Create situations to see if they feel it too", trope: "push_pull" },
      { text: "Sit with it for weeks before doing anything", trope: "slow_burn" },
      { text: "Drop hints and see if they're paying attention", trope: "slow_reveal" },
      { text: "Wonder if this is fate correcting a past mistake", trope: "second_chance" },
    ],
  },
  {
    id: 5,
    question: "Your biggest dating dealbreaker is someone who:",
    options: [
      { text: "Rushes things before the tension has time to build", trope: "slow_burn" },
      { text: "Plays too hard to get (that's YOUR move)", trope: "push_pull" },
      { text: "Can't handle emotional honesty", trope: "all_in" },
      { text: "Asks too many questions too soon", trope: "slow_reveal" },
      { text: "Refuses to believe people can change", trope: "second_chance" },
    ],
  },
];

/**
 * Calculate the result trope from quiz answers
 */
export function calculateTrope(answers: Record<number, RomanticTrope>): RomanticTrope {
  const scores: Record<RomanticTrope, number> = {
    slow_burn: 0,
    second_chance: 0,
    all_in: 0,
    push_pull: 0,
    slow_reveal: 0,
  };

  let lastAnswered: RomanticTrope = "slow_burn";

  for (const trope of Object.values(answers)) {
    scores[trope]++;
    lastAnswered = trope;
  }

  // Find max score
  const maxScore = Math.max(...Object.values(scores));
  const winners = Object.entries(scores)
    .filter(([, score]) => score === maxScore)
    .map(([trope]) => trope as RomanticTrope);

  // Tie-breaker: last answered wins
  if (winners.length > 1 && winners.includes(lastAnswered)) {
    return lastAnswered;
  }

  return winners[0];
}

/**
 * Trope result content - matches TROPE_CONTENT_SPEC.md
 */
export const TROPE_CONTENT: Record<RomanticTrope, {
  title: string;
  tagline: string;
  description: string;
  shareText: string;
  yourPeople: string[];
}> = {
  slow_burn: {
    title: "SLOW BURN",
    tagline: "the tension is the whole point and you know it",
    description: "You'd rather wait three seasons for a kiss than rush it. You've said \"I just think it's better when it builds\" at least once this month. Eye contact across a room? That's your whole love language. You're not playing hard to get — you genuinely believe anticipation is the best part. Other people think you're patient. You know you're just savoring it.",
    shareText: "I'm a SLOW BURN — the tension is the whole point. what's yours?",
    yourPeople: ["darcy & elizabeth", "jim & pam", "connell & marianne"],
  },
  second_chance: {
    title: "SECOND CHANCE",
    tagline: "you never really closed that chapter, did you",
    description: "You still think about the one that got away. Not in a sad way — in a \"the timing was just wrong\" way. You believe some people are meant to find their way back to each other. Reunion episodes are your weakness. You've definitely stalked an ex's Instagram \"just to see how they're doing.\" You're not hung up on the past — you just think some stories deserve a second draft.",
    shareText: "I'm a SECOND CHANCE — some stories deserve a sequel. what's yours?",
    yourPeople: ["mia & sebastian", "noah & allie", "jesse & céline"],
  },
  all_in: {
    title: "ALL IN",
    tagline: "when you know, you know — and you KNEW",
    description: "You don't do slow. You don't do games. When you feel it, you say it, and honestly? That's terrifying to most people. You've been called \"intense\" like it's a bad thing. It's not. You'd rather be rejected for being honest than liked for being careful. While everyone else is calculating their next move, you already made yours. Life's too short to pretend you don't care.",
    shareText: "I'm ALL IN — when I know, I know. what's yours?",
    yourPeople: ["rachel & nick", "lara jean & peter", "jake & amy"],
  },
  push_pull: {
    title: "PUSH & PULL",
    tagline: "you want them to work for it (and you'll work for it too)",
    description: "Hot then cold. Close then distant. It's not games — it's tension, and you're fluent in it. You flirt by arguing. You show love by teasing. The chase is half the fun and you refuse to apologize for it. People say they want straightforward, but they keep coming back to you. You're exhausting in the best way. Boring could never be your problem.",
    shareText: "I'm a PUSH & PULL — the chase is half the fun. what's yours?",
    yourPeople: ["kat & patrick", "jess & nick", "lorelai & luke"],
  },
  slow_reveal: {
    title: "SLOW REVEAL",
    tagline: "they have to earn the real you",
    description: "You're not cold — you're careful. There's a version of you that most people get, and then there's the version that only comes out when someone proves they're paying attention. You test people without them knowing. You reward curiosity and punish assumptions. People call you \"mysterious\" and you let them, because explaining yourself sounds exhausting. The right person will figure it out.",
    shareText: "I'm a SLOW REVEAL — you have to earn the real me. what's yours?",
    yourPeople: ["jane & rochester", "fleabag & the priest", "bella & edward"],
  },
};
