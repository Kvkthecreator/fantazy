import { useBasketPolling } from './useBasketPolling';
import { useBasketEventsWebSocket } from './useBasketEventsWebSocket';

/**
 * Subscribe to basket events using WebSocket when enabled, otherwise
 * fall back to a 3s polling loop. The interface is consistent across
 * transport mechanisms.
 */
export function useBasketEvents(basketId: string) {
  const mode = process.env.NEXT_PUBLIC_BASKET_EVENTS === 'websocket' ? 'websocket' : 'polling';
  return mode === 'websocket'
    ? useBasketEventsWebSocket(basketId)
    : useBasketPolling(basketId);
}
