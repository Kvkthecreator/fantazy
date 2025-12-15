import { cn } from "@/lib/utils";

interface BackgroundBlobProps {
  className?: string;
}

export function BackgroundBlob({ className }: BackgroundBlobProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-3xl",
        className
      )}
      aria-hidden
    >
      <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute right-[-60px] top-24 h-56 w-56 rounded-full bg-accent/12 blur-3xl" />
    </div>
  );
}
