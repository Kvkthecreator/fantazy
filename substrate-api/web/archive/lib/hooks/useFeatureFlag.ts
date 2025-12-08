export function useFeatureFlag(flag: string, defaultVal = false) {
  const bool =
    typeof window !== "undefined"
      ? window.localStorage.getItem(`ff:${flag}`)
      : null;

  if (bool !== null) return bool === "true";

  // fallback to env
  return process.env[`NEXT_PUBLIC_${flag.toUpperCase()}`] === "true"
    ? true
    : defaultVal;
}
