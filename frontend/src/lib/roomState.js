export function parseStoredSession(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function remainingSeconds(room, now = room?.serverNow ?? Date.now()) {
  if (!room?.endsAt) return 0;
  return Math.max(0, Math.ceil((room.endsAt - now) / 1000));
}

export function canHostStart(room, address) {
  return Boolean(
    room &&
    address &&
    room.status === 'lobby' &&
    room.playerCount >= 2 &&
    room.hostAddress === address,
  );
}

export function roomCapacityState(room) {
  const count = room?.playerCount || 0;
  const capacity = room?.capacity || 100;
  return {
    count,
    capacity,
    full: count >= capacity,
    percent: Math.min(100, (count / capacity) * 100),
  };
}
