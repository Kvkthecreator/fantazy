export function requestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  // fallback
  return 'req_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
