import { cookies } from 'next/headers';

function key(workspaceId: string) {
  return `lastBasketId::${workspaceId}`;
}

export async function getLastBasketId(workspaceId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(key(workspaceId))?.value ?? null;
}

export async function setLastBasketId(workspaceId: string, basketId: string) {
  const store = await cookies();
  store.set(key(workspaceId), basketId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}
