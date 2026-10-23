import type {
  ApiEnvelope,
  ApprovalResult,
  Assignment,
  AssignmentStatus,
  AssignmentStatusUpdate,
  AuditLog,
  AuditLogParams,
  DashboardMetrics,
  HealthStatus,
  MatchGeneratePayload,
  MatchGenerationResult,
  ModifyRecommendationPayload,
  Recommendation,
  RecommendationStatus,
  Report,
  ReportCreate,
  ReportListParams,
  ReportReview,
  Resource,
  ResourceCreate,
  ResourceRestock,
  Route,
  RouteCreate,
  Shortage,
  ShortageCreate,
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  SupplierVerificationStatus,
} from "../types";

const RAW_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

// The contract sets VITE_API_BASE_URL to the server origin. Accept a value
// ending in /api as well so local configuration mistakes are harmless.
export const API_BASE_URL = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 0, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type RequestFn = <T>(
  path: string,
  options?: ApiRequestOptions,
) => Promise<T>;

function toQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(
      `Cannot reach the Lifeline API at ${API_BASE_URL}. Make sure the backend is running.`,
    );
  }

  const text = await response.text();
  let payload: ApiEnvelope<T> | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiError(
        `The API returned an unexpected response (HTTP ${response.status}).`,
        response.status,
      );
    }
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message || `Request failed with HTTP ${response.status}.`,
      response.status,
      payload?.data ?? null,
    );
  }

  return (payload?.data ?? (null as T)) as T;
}

export function createApiClient(request: RequestFn) {
  return {
    health: () => request<HealthStatus>("/api/health"),

    reports: {
      list: (params: ReportListParams = {}) =>
        request<Report[]>(`/api/reports${toQuery({ ...params })}`),
      pending: () => request<Report[]>("/api/reports/pending"),
      get: (id: number) => request<Report>(`/api/reports/${id}`),
      reviews: (id: number) =>
        request<ReportReview[]>(`/api/reports/${id}/reviews`),
      create: (payload: ReportCreate) =>
        request<Report>("/api/reports", { method: "POST", body: payload }),
      verify: (id: number, reason: string) =>
        request<Report>(`/api/reports/${id}/verify`, {
          method: "POST",
          body: { reason },
        }),
      reject: (id: number, reason: string) =>
        request<Report>(`/api/reports/${id}/reject`, {
          method: "POST",
          body: { reason },
        }),
      requestClarification: (id: number, reason: string) =>
        request<Report>(`/api/reports/${id}/request-clarification`, {
          method: "POST",
          body: { reason },
        }),
    },

    suppliers: {
      list: (params: {
        verification_status?: SupplierVerificationStatus;
        active?: boolean;
      } = {}) => request<Supplier[]>(`/api/suppliers${toQuery({ ...params })}`),
      get: (id: number) => request<Supplier>(`/api/suppliers/${id}`),
      create: (payload: SupplierCreate) =>
        request<Supplier>("/api/suppliers", {
          method: "POST",
          body: payload,
        }),
      update: (id: number, payload: SupplierUpdate) =>
        request<Supplier>(`/api/suppliers/${id}`, {
          method: "PATCH",
          body: payload,
        }),
      verify: (id: number, reason: string) =>
        request<Supplier>(`/api/suppliers/${id}/verify`, {
          method: "POST",
          body: { reason },
        }),
    },

    resources: {
      list: (params: { supplier_id?: number; category?: string } = {}) =>
        request<Resource[]>(`/api/resources${toQuery({ ...params })}`),
      get: (id: number) => request<Resource>(`/api/resources/${id}`),
      create: (payload: ResourceCreate) =>
        request<Resource>("/api/resources", {
          method: "POST",
          body: payload,
        }),
      restock: (id: number, payload: ResourceRestock) =>
        request<Resource>(`/api/resources/${id}/restock`, {
          method: "POST",
          body: payload,
        }),
    },

    routes: {
      list: (params: { blocked?: boolean } = {}) =>
        request<Route[]>(`/api/routes${toQuery({ ...params })}`),
      get: (id: number) => request<Route>(`/api/routes/${id}`),
      create: (payload: RouteCreate) =>
        request<Route>("/api/routes", { method: "POST", body: payload }),
      block: (id: number, reason: string) =>
        request<Route>(`/api/routes/${id}/block`, {
          method: "POST",
          body: { reason },
        }),
      unblock: (id: number, reason: string) =>
        request<Route>(`/api/routes/${id}/unblock`, {
          method: "POST",
          body: { reason },
        }),
    },

    matches: {
      list: (status?: RecommendationStatus, reportId?: number) =>
        request<Recommendation[]>(
          `/api/matches${toQuery({ status, report_id: reportId })}`,
        ),
      get: (id: number) =>
        request<Recommendation>(`/api/matches/${id}`),
      generate: (payload: MatchGeneratePayload = {}) =>
        request<MatchGenerationResult>("/api/matches", {
          method: "POST",
          body: payload,
        }),
      approve: (id: number, reason: string) =>
        request<ApprovalResult>(`/api/matches/${id}/approve`, {
          method: "POST",
          body: { reason },
        }),
      modify: (id: number, payload: ModifyRecommendationPayload) =>
        request<Recommendation>(`/api/matches/${id}/modify`, {
          method: "POST",
          body: payload,
        }),
      reject: (id: number, reason: string) =>
        request<Recommendation>(`/api/matches/${id}/reject`, {
          method: "POST",
          body: { reason },
        }),
    },

    assignments: {
      list: (status?: AssignmentStatus, reportId?: number) =>
        request<Assignment[]>(
          `/api/assignments${toQuery({ status, report_id: reportId })}`,
        ),
      get: (id: number) => request<Assignment>(`/api/assignments/${id}`),
      updateStatus: (id: number, payload: AssignmentStatusUpdate) =>
        request<Assignment>(`/api/assignments/${id}/status`, {
          method: "POST",
          body: payload,
        }),
    },

    shortages: {
      list: (status?: "open" | "resolved", reportId?: number) =>
        request<Shortage[]>(
          `/api/shortages${toQuery({ status, report_id: reportId })}`,
        ),
      create: (payload: ShortageCreate) =>
        request<Shortage>("/api/shortages", {
          method: "POST",
          body: payload,
        }),
      resolve: (id: number, reason: string) =>
        request<Shortage>(`/api/shortages/${id}/resolve`, {
          method: "POST",
          body: { reason },
        }),
    },

    dashboard: {
      metrics: () => request<DashboardMetrics>("/api/dashboard/metrics"),
    },

    audit: {
      list: (params: AuditLogParams = {}) =>
        request<AuditLog[]>(`/api/audit-logs${toQuery({ ...params })}`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
