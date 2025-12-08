export async function logEvent(name: string, payload?: Record<string, any>) {
  try {
    if (process.env.TELEMETRY_ENDPOINT) {
      await fetch(process.env.TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, payload }),
      });
    } else {
      // Fallback to console for development
      console.log('[telemetry]', name, payload);
    }
  } catch (_err) {
    // swallow errors
  }
}
