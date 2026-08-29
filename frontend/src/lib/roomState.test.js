import { describe, expect, it } from 'vitest';
import {
  canHostStart,
  parseStoredSession,
  remainingSeconds,
  roomCapacityState,
} from './roomState';

describe('room state helpers', () => {
  it('restores valid sessions and rejects corrupt storage', () => {
    expect(parseStoredSession('{"roomCode":"ABC123"}').roomCode).toBe('ABC123');
    expect(parseStoredSession('{bad')).toEqual({});
  });

  it('derives a server-synchronized countdown', () => {
    expect(remainingSeconds({ endsAt: 10_500, serverNow: 8_000 })).toBe(3);
    expect(remainingSeconds({ endsAt: 8_000, serverNow: 9_000 })).toBe(0);
  });

  it('handles host start and full rooms', () => {
    const room = {
      status: 'lobby',
      playerCount: 100,
      capacity: 100,
      hostAddress: '0xhost',
    };
    expect(canHostStart(room, '0xhost')).toBe(true);
    expect(roomCapacityState(room)).toMatchObject({ full: true, percent: 100 });
  });
});
