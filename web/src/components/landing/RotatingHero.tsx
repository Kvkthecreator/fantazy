"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChatPreview } from "./ChatPreview";

// Scenarios reframed around being IN the moment
const SCENARIOS = [
  { target: "confession", line: "You're in it. What do you say?" },
  { target: "confrontation", line: "Your move. No script." },
  { target: "turning point", line: "Everything changes now. You decide." },
];

interface RotatingHeroProps {
  /** Number of full rotations before stopping (default: 3) */
  rotationCycles?: number;
  /** Duration per word in ms (default: 2500) */
  rotationSpeed?: number;
}

export function RotatingHero({
  rotationCycles = 3,
  rotationSpeed = 2500,
}: RotatingHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [hasStopped, setHasStopped] = useState(false);

  const totalRotations = rotationCycles * SCENARIOS.length;

  const rotate = useCallback(() => {
    if (hasStopped || isPaused) return;

    setIsAnimating(true);

    setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % SCENARIOS.length;
        return next;
      });
      setCycleCount((prev) => prev + 1);
      setIsAnimating(false);
    }, 200);
  }, [hasStopped, isPaused]);

  useEffect(() => {
    if (cycleCount >= totalRotations && !hasStopped) {
      if (currentIndex === 0) {
        setHasStopped(true);
      }
    }
  }, [cycleCount, totalRotations, currentIndex, hasStopped]);

  useEffect(() => {
    if (hasStopped) return;

    const interval = setInterval(rotate, rotationSpeed);
    return () => clearInterval(interval);
  }, [rotate, rotationSpeed, hasStopped]);

  const current = SCENARIOS[currentIndex];

  return (
    <section
      className="relative overflow-hidden rounded-3xl border bg-card shadow-lg"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-pink-500/20 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 grid gap-6 p-6 sm:p-8 md:grid-cols-2 md:gap-8 lg:p-10">
        {/* Left: Copy */}
        <div className="flex flex-col justify-center gap-5 text-white">
          {/* Eyebrow */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              Live the story
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
              <span className="block">Don&apos;t watch the story.</span>
              <span className="block mt-1">Live it.</span>
            </h1>

            {/* Rotating scenario line */}
            <p
              className={cn(
                "max-w-md text-base text-white/70 transition-all duration-200 sm:text-lg",
                isAnimating
                  ? "opacity-0 translate-y-1"
                  : "opacity-100 translate-y-0"
              )}
            >
              The{" "}
              <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                {current.target}
              </span>
              . {current.line}
            </p>
          </div>

          {/* Clarity line for cold traffic */}
          <p className="text-sm text-white/50 max-w-md">
            Step into scenes that respond to you. Shape what happens next.
          </p>

          {/* Value props */}
          <ul className="flex flex-col gap-2 text-sm text-white/60">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              Stories that remember you
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              Your choices change everything
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Romance. Drama. Thriller. You&apos;re the lead.
            </li>
          </ul>

          {/* CTA */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/login?next=/dashboard"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-white/90"
            >
              Play free
            </Link>
            <Link
              href="#series"
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              See stories
            </Link>
          </div>
          <p className="text-xs text-white/40">No credit card required</p>
        </div>

        {/* Right: Chat Preview */}
        <div className="hidden md:flex md:items-center md:justify-center">
          <ChatPreview className="w-full max-w-sm" />
        </div>
      </div>
    </section>
  );
}
