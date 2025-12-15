export function getStudioAllowlist(): string[] {
  const raw = process.env.STUDIO_ALLOWED_EMAILS ?? 'kvkthecreator@gmail.com'
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function isInternalEmail(email: string | null | undefined) {
  if (!email) return false
  return getStudioAllowlist().includes(email.toLowerCase())
}
