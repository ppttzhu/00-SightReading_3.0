import { getGuestUserId } from './displayName';

export interface PlayerIdentity {
  playerKey: string;
  userId: string | null;
  guestId: string | null;
}

export function resolvePlayerIdentity(authUserId?: string | null): PlayerIdentity {
  if (authUserId) {
    return {
      playerKey: `user:${authUserId}`,
      userId: authUserId,
      guestId: null,
    };
  }
  const guestId = getGuestUserId();
  return {
    playerKey: `guest:${guestId}`,
    userId: null,
    guestId,
  };
}
