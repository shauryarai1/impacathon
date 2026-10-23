import type {
  ApiApprovalResult,
  ApiAssignment,
  ApiAssignmentStatusUpdate,
  ApiAuditLog,
  ApiDashboardMetrics,
  ApiEnvelope,
  ApiHealth,
  ApiMatchGenerationResult,
  ApiRecommendation,
  ApiReport,
  ApiReportCreate,
  ApiReportReview,
  ApiResource,
  ApiResourceCreate,
  ApiResourceRestock,
  ApiRoute,
  ApiShortage,
  ApiSupplier,
  ApiSupplierCreate,
  ApiSupplierUpdate,
  AssignmentStatus,
  RecommendationStatus,
  ReportCategory,
  ReportType,
} from "./types";
import { authHeaders } from "../lib/auth";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

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

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the Lifeline API at ${API_BASE_URL}. Start the FastAPI backend and try again.`,
    );
  }

  const text = await response.text();
  let envelope: ApiEnvelope<T> | null = null;

  if (text) {
    try {
      envelope = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiError(
        `The Lifeline API returned a non-JSON response (HTTP ${response.status}).`,
        response.status,
      );
    }
  }

  if (!response.ok || envelope?.success === false) {
    throw new ApiError(
      envelope?.message || `Request failed with HTTP ${response.status}.`,
      response.status,
      envelope?.data ?? null,
    );
  }

  return (envelope?.data ?? null) as T;
}

export const api = {
  baseUrl: API_BASE_URL,

  health: () => request<ApiHealth>("/api/health"),

  getDashboardMetrics: () =>
    request<ApiDashboardMetrics>("/api/dashboard/metrics"),

  listReports: (params: {
    status?: string;
    category?: ReportCategory;
    type?: ReportType;
    location?: string;
    limit?: number;
  } = {}) => request<ApiReport[]>(`/api/reports${query(params)}`),

  getReport: (id: number) => request<ApiReport>(`/api/reports/${id}`),

  getReportReviews: (id: number) =>
    request<ApiReportReview[]>(`/api/reports/${id}/reviews`),

  submitRequest: (payload: ApiReportCreate) =>
    request<ApiReport>("/api/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyRequest: (id: number, reason: string) =>
    request<ApiReport>(`/api/reports/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  rejectRequest: (id: number, reason: string) =>
    request<ApiReport>(`/api/reports/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  clarifyRequest: (id: number, reason: string) =>
    request<ApiReport>(`/api/reports/${id}/request-clarification`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  listSuppliers: (params: {
    verification_status?: string;
    active?: boolean;
  } = {}) => request<ApiSupplier[]>(`/api/suppliers${query(params)}`),

  createSupplier: (payload: ApiSupplierCreate) =>
    request<ApiSupplier>("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSupplier: (id: number, payload: ApiSupplierUpdate) =>
    request<ApiSupplier>(`/api/suppliers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  verifySupplier: (id: number, reason: string) =>
    request<ApiSupplier>(`/api/suppliers/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  listResources: () => request<ApiResource[]>("/api/resources"),

  createResource: (payload: ApiResourceCreate) =>
    request<ApiResource>("/api/resources", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  restockResource: (id: number, payload: ApiResourceRestock) =>
    request<ApiResource>(`/api/resources/${id}/restock`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listRoutes: (params: { blocked?: boolean } = {}) =>
    request<ApiRoute[]>(`/api/routes${query(params)}`),

  blockRoute: (id: number, reason: string) =>
    request<ApiRoute>(`/api/routes/${id}/block`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  unblockRoute: (id: number, reason: string) =>
    request<ApiRoute>(`/api/routes/${id}/unblock`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  listMatches: (status?: RecommendationStatus, reportId?: number) =>
    request<ApiRecommendation[]>(
      `/api/matches${query({ status, report_id: reportId })}`,
    ),

  generateMatches: (payload: { report_id?: number; replace_proposed?: boolean } = {}) =>
    request<ApiMatchGenerationResult>("/api/matches", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  approveMatch: (id: number, reason: string) =>
    request<ApiApprovalResult>(`/api/matches/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  modifyMatch: (
    id: number,
    payload: { reason: string; quantity?: number; resource_id?: number },
  ) =>
    request<ApiRecommendation>(`/api/matches/${id}/modify`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  rejectMatch: (id: number, reason: string) =>
    request<ApiRecommendation>(`/api/matches/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  listAssignments: (status?: AssignmentStatus) =>
    request<ApiAssignment[]>(`/api/assignments${query({ status })}`),

  updateAssignmentStatus: (
    id: number,
    payload: ApiAssignmentStatusUpdate,
  ) =>
    request<ApiAssignment>(`/api/assignments/${id}/status`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listShortages: (status?: "open" | "resolved") =>
    request<ApiShortage[]>(`/api/shortages${query({ status })}`),

  listAuditLogs: (params: { limit?: number; action?: string } = {}) =>
    request<ApiAuditLog[]>(`/api/audit-logs${query(params)}`),
};
