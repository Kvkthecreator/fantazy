export interface Profile {
  avatarUrl: string;
  displayName: string;
  locale: string;
  timezone: string;
}

export interface Preferences {
  theme: string;
  dumpBasket: string | null;
}

export async function fetchMockProfile(): Promise<Profile> {
  return {
    avatarUrl: "/placeholder-avatar.png",
    displayName: "Jane Doe",
    locale: "en-US",
    timezone: "UTC",
  };
}

export async function saveMockProfile(_data: Profile): Promise<{ ok: boolean }> {
  await new Promise((r) => setTimeout(r, 500));
  return { ok: true };
}

export async function fetchMockPreferences(): Promise<Preferences> {
  return {
    theme: "light",
    dumpBasket: null,
  };
}

export async function saveMockPreferences(
  _data: Preferences
): Promise<{ ok: boolean }> {
  await new Promise((r) => setTimeout(r, 500));
  return { ok: true };
}
