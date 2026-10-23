import type {
  AssignmentStatus,
  ReportCategory,
  ReportStatus,
  ShortageStatus,
  Urgency,
} from "../types";

const statusLabels: Record<string, string> = {
  pending_verification: "Pending verification",
  clarification_requested: "Clarification requested",
  verified: "Verified",
  rejected: "Rejected",
  proposed: "Suggested",
  approved: "Approved",
  superseded: "Superseded",
  dispatched: "Dispatched",
  in_transit: "In transit",
  delivered: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled",
  open: "Open",
  resolved: "Resolved",
  pending: "Pending",
};

const categoryLabels: Record<ReportCategory, string> = {
  water: "Water",
  food: "Food",
  shelter: "Shelter",
  medical: "Medical",
  road_blockage: "Road blockage",
  other: "Other",
};

const urgencyLabels: Record<Urgency, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function formatStatus(status: string): string {
  return statusLabels[status] ?? titleCase(status);
}

export function formatCategory(category: ReportCategory | string | null): string {
  if (!category) return "—";
  return categoryLabels[category as ReportCategory] ?? titleCase(category);
}

export function formatUrgency(urgency: Urgency | string | null): string {
  if (!urgency) return "—";
  return urgencyLabels[urgency as Urgency] ?? titleCase(urgency);
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);

  if (absolute < 45) return "Just now";

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absolute < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (absolute < 604_800) return formatter.format(Math.round(seconds / 86_400), "day");
  return formatDate(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatRoute(
  route: { origin: string; destination: string } | null | undefined,
): string {
  return route ? `${route.origin} → ${route.destination}` : "Same area";
}

export function formatAction(action: string): string {
  return titleCase(action);
}

export function isRequestActive(status: ReportStatus): boolean {
  return status !== "rejected";
}

export function isShortageOpen(status: ShortageStatus): boolean {
  return status === "open";
}

export const assignmentTransitions: Record<
  AssignmentStatus,
  AssignmentStatus[]
> = {
  approved: ["dispatched", "failed", "cancelled"],
  dispatched: ["in_transit", "failed", "cancelled"],
  in_transit: ["delivered", "failed", "cancelled"],
  delivered: [],
  failed: [],
  cancelled: [],
};
