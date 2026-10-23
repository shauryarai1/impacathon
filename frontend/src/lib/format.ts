import type {
  ApiReport,
  ApiUrgency,
  AssignmentStatus,
  NeedType,
  ReportCategory,
  RequestStatus,
  RouteStatus,
  Urgency,
} from "../api/types";

const needByCategory: Record<ReportCategory, NeedType> = {
  water: "Water",
  food: "Food",
  shelter: "Shelter",
  medical: "Medical",
  road_blockage: "Other",
  other: "Other",
};

const categoryByNeed: Record<NeedType, ReportCategory> = {
  Water: "water",
  Food: "food",
  Shelter: "shelter",
  Medical: "medical",
  Other: "other",
};

export function needFromCategory(category: ReportCategory | null): NeedType {
  return category ? needByCategory[category] : "Other";
}

export function categoryFromNeed(need: NeedType): ReportCategory {
  return categoryByNeed[need];
}

export function urgencyLabel(urgency: ApiUrgency | string | null): Urgency {
  if (urgency === "critical") return "Critical";
  if (urgency === "high") return "High";
  return "Routine";
}

export function urgencyToApi(urgency: Urgency): ApiUrgency {
  if (urgency === "Critical") return "critical";
  if (urgency === "High") return "high";
  return "medium";
}

export function requestStatusLabel(status: string): RequestStatus {
  if (status === "verified") return "Verified";
  if (status === "rejected") return "Rejected";
  if (status === "clarification_requested") return "Needs information";
  return "Awaiting review";
}

export function routeStatusLabel(blocked: boolean): RouteStatus {
  return blocked ? "Blocked" : "Accessible";
}

export function deliveryStatusLabel(status: AssignmentStatus | string): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "dispatched":
      return "Dispatched";
    case "in_transit":
      return "In Transit";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function nextAssignmentStatuses(status: AssignmentStatus): AssignmentStatus[] {
  switch (status) {
    case "approved":
      return ["dispatched", "failed", "cancelled"];
    case "dispatched":
      return ["in_transit", "failed", "cancelled"];
    case "in_transit":
      return ["delivered", "failed", "cancelled"];
    default:
      return [];
  }
}

export function assignmentUnit(): string {
  return "units";
}

export function displayId(prefix: string, id: number): string {
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

export function reportWarning(report: ApiReport): string | undefined {
  if (report.duplicate_of_report_id) {
    const similarity = report.duplicate_score
      ? ` (${Math.round(report.duplicate_score * 100)}% similar)`
      : "";
    return `Possible duplicate of request #${report.duplicate_of_report_id}${similarity}. Review before verifying.`;
  }
  if (report.review_flags.length) {
    return report.review_flags.join(" ");
  }
  return undefined;
}

export function humanizeAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function matchStockLabel(quantityAvailable: number | undefined): string {
  return quantityAvailable === undefined
    ? "Stock unavailable"
    : `${quantityAvailable} available`;
}
