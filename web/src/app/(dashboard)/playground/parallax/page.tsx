"use client";

import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

// Local test assets (transparent avatar + background)
const AVATAR_URL = "/playground-assets/avatar_transparent.png";
const BACKGROUND_URL = "/playground-assets/classroom-bg.jpg";

export default function ParallaxPlayground() {
  const [parallaxEnabled, setParallaxEnabled] = useState(true);
  const [breathingEnabled, setBreathingEnabled] = useState(true);
  const [parallaxIntensity, setParallaxIntensity] = useState(20);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse position relative to container center
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !parallaxEnabled) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Normalize to -1 to 1
    const x = (e.clientX - centerX) / (rect.width / 2);
    const y = (e.clientY - centerY) / (rect.height / 2);

    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  // Calculate transforms based on mouse position
  const bgTransform = parallaxEnabled
    ? `translate(${mousePos.x * parallaxIntensity * 0.3}px, ${mousePos.y * parallaxIntensity * 0.3}px) scale(1.1)`
    : "scale(1.05)";

  const avatarTransform = parallaxEnabled
    ? `translate(${mousePos.x * parallaxIntensity * -0.5}px, ${mousePos.y * parallaxIntensity * -0.3}px)`
    : "";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parallax Playground</h1>
        <p className="text-muted-foreground">
          Compare static overlay vs animated parallax scene cards
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="parallax-toggle" className="font-medium">
              Parallax Effect (mouse move)
            </Label>
            <Switch
              id="parallax-toggle"
              checked={parallaxEnabled}
              onCheckedChange={setParallaxEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="breathing-toggle" className="font-medium">
              Breathing Animation
            </Label>
            <Switch
              id="breathing-toggle"
              checked={breathingEnabled}
              onCheckedChange={setBreathingEnabled}
            />
          </div>

          {parallaxEnabled && (
            <div className="space-y-2">
              <Label className="font-medium">
                Parallax Intensity: {parallaxIntensity}px
              </Label>
              <Slider
                value={[parallaxIntensity]}
                onValueChange={([v]) => setParallaxIntensity(v)}
                min={5}
                max={50}
                step={5}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scene Card Demo */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl cursor-crosshair shadow-2xl"
      >
        {/* Background Layer */}
        <div
          className="absolute inset-[-20px] transition-transform duration-100 ease-out bg-cover bg-center"
          style={{
            transform: bgTransform,
            backgroundImage: `url(${BACKGROUND_URL})`,
          }}
        />

        {/* Character Layer */}
        <div
          className={`absolute bottom-0 right-[5%] h-[90%] transition-transform duration-100 ease-out ${
            breathingEnabled ? "animate-breathing" : ""
          }`}
          style={{ transform: avatarTransform }}
        >
          <img
            src={AVATAR_URL}
            alt="Character"
            className="h-full w-auto object-contain"
            style={{
              filter: "drop-shadow(0 0 15px rgba(0,0,0,0.4))",
            }}
          />
        </div>

        {/* Foreground FX Layer - bokeh / light particles */}
        <div
          className="absolute inset-0 pointer-events-none transition-transform duration-100 ease-out"
          style={{
            transform: parallaxEnabled
              ? `translate(${mousePos.x * parallaxIntensity * -0.8}px, ${mousePos.y * parallaxIntensity * -0.8}px)`
              : "",
          }}
        >
          <div className="absolute top-[15%] right-[20%] w-4 h-4 bg-white/30 rounded-full blur-sm" />
          <div className="absolute top-[25%] right-[35%] w-2 h-2 bg-white/20 rounded-full blur-sm" />
          <div className="absolute bottom-[30%] left-[20%] w-3 h-3 bg-white/25 rounded-full blur-sm" />
          <div className="absolute top-[60%] right-[10%] w-5 h-5 bg-purple-300/20 rounded-full blur-md" />
        </div>

        {/* Gradient overlay for text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

        {/* Text Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-6 text-white pointer-events-none">
          <p className="text-sm opacity-70 mb-1">Episode 3</p>
          <p className="text-xl font-semibold">
            "I didn't expect to see you here tonight..."
          </p>
        </div>

        {/* Mode indicator */}
        <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 rounded-full text-white text-xs">
          {parallaxEnabled ? "Mode B: Parallax" : "Mode A: Static Overlay"}
        </div>
      </div>

      {/* Explanation */}
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
          <p><strong>Mode A (Static Overlay):</strong> Background + character PNG layered. No motion. Clean, simple.</p>
          <p><strong>Mode B (Parallax):</strong> Same assets, but layers move at different rates based on mouse/scroll. Creates depth illusion.</p>
          <p className="text-xs mt-4">
            Move your mouse over the scene to see the parallax effect. Toggle switches to compare.
          </p>
        </CardContent>
      </Card>

      {/* CSS for breathing animation */}
      <style jsx global>{`
        @keyframes breathing {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        .animate-breathing {
          animation: breathing 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
