export interface AccessCredentials {
  coordinatorKey: string;
  coordinatorName: string;
  volunteerKey: string;
  volunteerName: string;
}

const EMPTY_ACCESS: AccessCredentials = {
  coordinatorKey: "",
  coordinatorName: "",
  volunteerKey: "",
  volunteerName: "",
};

/**
 * Credentials intentionally live in memory only for the current browser
 * session. They are not written to localStorage or sessionStorage, and they
 * disappear on refresh or logout.
 */
let memoryAccess: AccessCredentials | null = null;

export function getAccess(): AccessCredentials {
  return memoryAccess ?? EMPTY_ACCESS;
}

export function saveAccess(access: AccessCredentials): void {
  memoryAccess = {
    coordinatorKey: access.coordinatorKey.trim(),
    coordinatorName: access.coordinatorName.trim(),
    volunteerKey: access.volunteerKey.trim(),
    volunteerName: access.volunteerName.trim(),
  };
}

export function clearAccess(): void {
  memoryAccess = null;
}

export function authHeaders(): Record<string, string> {
  const access = getAccess();
  const headers: Record<string, string> = {};

  if (access.coordinatorKey) {
    headers["X-Coordinator-Key"] = access.coordinatorKey;
  }
  if (access.coordinatorName) {
    headers["X-Coordinator-Name"] = access.coordinatorName;
  }
  if (access.volunteerKey) {
    headers["X-Volunteer-Key"] = access.volunteerKey;
  }
  if (access.volunteerName) {
    headers["X-Volunteer-Name"] = access.volunteerName;
  }

  return headers;
}

export function hasCoordinatorAccess(): boolean {
  return Boolean(getAccess().coordinatorKey);
}

export function hasVolunteerAccess(): boolean {
  return Boolean(getAccess().volunteerKey);
}

export function coordinatorDisplayName(): string {
  return getAccess().coordinatorName || "Coordinator";
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "CO"
  );
}
