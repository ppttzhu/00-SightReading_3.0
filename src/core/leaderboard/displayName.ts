const GUEST_NAME_KEY = 'sight-reading-guest-name';
const GUEST_ID_KEY = 'sight-reading-guest-id';

function randomGuestSuffix() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function getGuestUserId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest_${crypto.randomUUID()}`;
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getGuestDisplayName(): string {
  let name = localStorage.getItem(GUEST_NAME_KEY);
  if (!name) {
    name = `游客${randomGuestSuffix()}`;
    localStorage.setItem(GUEST_NAME_KEY, name);
  }
  return name;
}

export function setGuestDisplayName(name: string) {
  const trimmed = name.trim();
  if (trimmed) localStorage.setItem(GUEST_NAME_KEY, trimmed);
}

export function resolveDisplayName(profileNickname?: string | null): string {
  if (profileNickname?.trim()) return profileNickname.trim();
  return getGuestDisplayName();
}

export function resolveUserId(authUserId?: string | null): string {
  if (authUserId) return authUserId;
  return getGuestUserId();
}
