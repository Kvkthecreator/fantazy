export const DEV = process.env.NODE_ENV !== 'production';

export function dlog(origin: string, ...args: any[]) {
  if (!DEV) return;
  // eslint-disable-next-line no-console
  console.debug(`[DEBUG] ${origin}`, ...args);
}