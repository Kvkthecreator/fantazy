"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface RotatingHeroProps {
  targets: string[];
  /** Number of full rotations before stopping (default: 3) */
  rotationCycles?: number;
  /** Duration per word in ms (default: 1000) */
  rotationSpeed?: number;
}

export function RotatingHero({
  targets,
  rotationCycles = 3,
  rotationSpeed = 1000,
}: RotatingHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [hasStopped, setHasStopped] = useState(false);

  const totalRotations = rotationCycles * targets.length;

  const rotate = useCallback(() => {
    if (hasStopped || isPaused) return;

    setIsAnimating(true);

    // After fade out, change word
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % targets.length;
        return next;
      });
      setCycleCount((prev) => prev + 1);
      setIsAnimating(false);
    }, 200); // Fade out duration
  }, [hasStopped, isPaused, targets.length]);

  // Check if we should stop rotating
  useEffect(() => {
    if (cycleCount >= totalRotations && !hasStopped) {
      // Stop on "crush" (index 0) if possible
      if (currentIndex === 0) {
        setHasStopped(true);
      }
    }
  }, [cycleCount, totalRotations, currentIndex, hasStopped]);

  // Rotation interval
  useEffect(() => {
    if (hasStopped) return;

    const interval = setInterval(rotate, rotationSpeed);
    return () => clearInterval(interval);
  }, [rotate, rotationSpeed, hasStopped]);

  const currentTarget = targets[currentIndex];

  return (
    <section
      className="relative overflow-hidden rounded-3xl border bg-card shadow-lg"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="absolute inset-0">
        <img
          src="/playground-assets/classroom-bg.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />
      </div>

      <div className="relative z-10 flex flex-col gap-5 p-8 sm:p-10 text-white drop-shadow-md">
        {/* Headline with rotating word */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            <span className="block sm:inline">Relive the moment with your</span>{" "}
            <span className="inline-flex items-baseline whitespace-nowrap">
              <span
                className={cn(
                  "transition-opacity duration-200",
                  isAnimating ? "opacity-0" : "opacity-100"
                )}
              >
                &ldquo;{currentTarget}&rdquo;
              </span>
              <span className="ml-0.5">.</span>
            </span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg text-white/85">
            The scene&apos;s already started. You&apos;re already in it.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/login?next=/discover"
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            Try Episode-0
          </Link>
        </div>
      </div>
    </section>
  );
}
