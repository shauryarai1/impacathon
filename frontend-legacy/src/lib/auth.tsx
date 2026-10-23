import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiRequest,
  createApiClient,
  type ApiClient,
  type ApiRequestOptions,
  type RequestFn,
} from "./api";

const STORAGE_KEY = "lifeline.demo.access";

export interface DemoCredentials {
  coordinatorKey: string;
  coordinatorName: string;
  volunteerKey: string;
  volunteerName: string;
}

export const EMPTY_CREDENTIALS: DemoCredentials = {
  coordinatorKey: "",
  coordinatorName: "",
  volunteerKey: "",
  volunteerName: "",
};

interface AuthContextValue {
  credentials: DemoCredentials;
  setCredentials: (credentials: DemoCredentials) => void;
  api: ApiClient;
  hasCoordinator: boolean;
  hasVolunteer: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadCredentials(): DemoCredentials {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CREDENTIALS;
    const parsed = JSON.parse(raw) as Partial<DemoCredentials>;
    return {
      coordinatorKey: parsed.coordinatorKey ?? "",
      coordinatorName: parsed.coordinatorName ?? "",
      volunteerKey: parsed.volunteerKey ?? "",
      volunteerName: parsed.volunteerName ?? "",
    };
  } catch {
    return EMPTY_CREDENTIALS;
  }
}

function authHeaders(credentials: DemoCredentials): Record<string, string> {
  const headers: Record<string, string> = {};

  if (credentials.coordinatorKey) {
    headers["X-Coordinator-Key"] = credentials.coordinatorKey;
  }
  if (credentials.coordinatorName) {
    headers["X-Coordinator-Name"] = credentials.coordinatorName;
  }
  if (credentials.volunteerKey) {
    headers["X-Volunteer-Key"] = credentials.volunteerKey;
  }
  if (credentials.volunteerName) {
    headers["X-Volunteer-Name"] = credentials.volunteerName;
  }

  return headers;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentialsState] =
    useState<DemoCredentials>(loadCredentials);

  useEffect(() => {
    try {
      if (Object.values(credentials).some(Boolean)) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // The app still works for the current tab if sessionStorage is blocked.
    }
  }, [credentials]);

  const setCredentials = useCallback((next: DemoCredentials) => {
    setCredentialsState({
      coordinatorKey: next.coordinatorKey.trim(),
      coordinatorName: next.coordinatorName.trim(),
      volunteerKey: next.volunteerKey.trim(),
      volunteerName: next.volunteerName.trim(),
    });
  }, []);

  const request = useCallback<RequestFn>(
    async <T,>(path: string, options: ApiRequestOptions = {}) =>
      apiRequest<T>(path, {
        ...options,
        headers: {
          ...options.headers,
          ...authHeaders(credentials),
        },
      }),
    [credentials],
  );

  const api = useMemo(() => createApiClient(request), [request]);

  const value = useMemo<AuthContextValue>(
    () => ({
      credentials,
      setCredentials,
      api,
      hasCoordinator: Boolean(credentials.coordinatorKey),
      hasVolunteer: Boolean(credentials.volunteerKey),
    }),
    [api, credentials, setCredentials],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
