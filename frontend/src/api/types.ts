export type NeedType = "Water" | "Food" | "Shelter" | "Medical" | "Other";
export type Urgency = "Critical" | "High" | "Routine";
export type RequestStatus =
  | "Awaiting review"
  | "Needs information"
  | "Verified"
  | "Rejected";
export type RouteStatus = "Accessible" | "Blocked" | "Limited";
export type DeliveryStatus =
  | "Approved"
  | "Dispatched"
  | "In Transit"
  | "Delivered"
  | "Failed"
  | "Cancelled";

/**
 * Legacy preview view models. They are retained so the original Manus demo
 * fixture module still type-checks, but live pages use the API models below.
 */
export interface ReliefRequest {
  id: string;
  residentLabel: string;
  location: string;
  need: NeedType;
  quantity: number;
  unit: string;
  urgency: Urgency;
  status: RequestStatus;
  submittedAt?: string;
  details?: string;
  warning?: string;
}

export interface Supplier {
  id: string;
  name: string;
  region: string;
  supplies: string[];
  reliability: string;
}
export interface ResourceStock {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  state: "Available" | "Low" | "Shortage";
}
export interface ReliefRoute {
  id: string;
  name: string;
  from: string;
  to: string;
  status: RouteStatus;
  note: string;
}
export interface SuggestedMatch {
  id: string;
  requestId: string;
  supplierId: string;
  resource: string;
  quantity: number;
  unit: string;
  routeId: string;
  reason: string;
}
export interface DeliveryAssignment {
  id: string;
  requestId: string;
  destination: string;
  resource: string;
  quantity: number;
  unit: string;
  volunteer: string;
  status: DeliveryStatus;
  updatedAt: string;
}
export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  time: string;
  detail: string;
}
export interface DashboardMetrics {
  activeRequests: number;
  awaitingApproval: number;
  availableResources: number;
  completedDeliveries: number;
}

/** Backend contract types. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export type ReportCategory =
  | "water"
  | "food"
  | "shelter"
  | "medical"
  | "road_blockage"
  | "other";
export type ReportType = "need" | "hazard";
export type ApiUrgency = "low" | "medium" | "high" | "critical";
export type ReportStatus =
  | "pending_verification"
  | "verified"
  | "rejected"
  | "clarification_requested";
export type SupplierVerificationStatus = "pending" | "verified" | "rejected";
export type RecommendationStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "superseded";
export type AssignmentStatus =
  | "approved"
  | "dispatched"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled";

export interface ApiReport {
  id: number;
  reporter_name: string;
  category: ReportCategory;
  type: ReportType;
  location: string;
  description: string;
  quantity: number;
  urgency: ApiUrgency;
  status: ReportStatus;
  duplicate_of_report_id: number | null;
  duplicate_score: number | null;
  review_flags: string[];
  needs_review: boolean;
  verified_by_id: number | null;
  verified_at: string | null;
  verification_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiReportCreate {
  reporter_name: string;
  category: ReportCategory;
  type: ReportType;
  location: string;
  description: string;
  quantity: number;
  urgency: ApiUrgency;
}

export interface ApiReportReview {
  id: number;
  report_id: number;
  coordinator_id: number;
  decision: string;
  reason: string;
  created_at: string;
}

export interface ApiSupplier {
  id: number;
  name: string;
  location: string;
  contact_name: string | null;
  verification_status: SupplierVerificationStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiSupplierCreate {
  name: string;
  location: string;
  contact_name?: string | null;
  verification_status?: SupplierVerificationStatus;
  active?: boolean;
}

export interface ApiSupplierUpdate {
  name?: string;
  location?: string;
  contact_name?: string | null;
  verification_status?: SupplierVerificationStatus;
  active?: boolean;
  reason: string;
}

export interface ApiResource {
  id: number;
  supplier_id: number;
  name: string;
  category: ReportCategory;
  quantity_total: number;
  quantity_available: number;
  quantity_reserved: number;
  created_at: string;
  updated_at: string;
}

export interface ApiResourceCreate {
  supplier_id: number;
  name: string;
  category: ReportCategory;
  quantity_available: number;
}

export interface ApiResourceRestock {
  quantity: number;
  reason: string;
}

export interface ApiRoute {
  id: number;
  origin: string;
  destination: string;
  travel_cost: number;
  blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiRecommendation {
  id: number;
  report_id: number;
  resource_id: number;
  supplier_id: number;
  route_id: number | null;
  quantity: number;
  status: RecommendationStatus;
  rationale: string;
  route_cost: number;
  needs_review: boolean;
  review_reason: string | null;
  reviewed_by_id: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  report_location: string | null;
  report_category: ReportCategory | null;
  report_status: ReportStatus | null;
  report_urgency: ApiUrgency | null;
  report_quantity: number | null;
  resource_name: string | null;
  supplier_name: string | null;
  supplier_location: string | null;
  assignment_id: number | null;
  assignment_status: string | null;
  remaining_shortage: number | null;
}

export interface ApiMatchGenerationResult {
  generated_count: number;
  superseded_count: number;
  recommendations: ApiRecommendation[];
  shortages: ApiShortage[];
}

export interface ApiAssignment {
  id: number;
  recommendation_id: number;
  report_id: number;
  resource_id: number;
  supplier_id: number;
  route_id: number | null;
  quantity: number;
  status: AssignmentStatus;
  volunteer_id: number | null;
  created_by_id: number;
  approval_reason: string;
  confirmation_note: string | null;
  failure_reason: string | null;
  needs_review: boolean;
  review_reason: string | null;
  inventory_released: boolean;
  inventory_consumed: boolean;
  created_at: string;
  updated_at: string;
  dispatched_at: string | null;
  delivered_at: string | null;
  recommendation_quantity: number | null;
  report_location: string | null;
  report_category: string | null;
  report_urgency: string | null;
  resource_name: string | null;
  supplier_name: string | null;
  volunteer_name: string | null;
  volunteer_organization: string | null;
  coordinator_name: string | null;
}

export interface ApiAssignmentStatusUpdate {
  status: AssignmentStatus;
  note?: string;
  failure_reason?: string;
}

export interface ApiShortage {
  id: number;
  report_id: number;
  quantity: number;
  reason: string;
  status: "open" | "resolved";
  source: string;
  reported_by_id: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  report_location: string | null;
  report_category: ReportCategory | null;
  report_urgency: ApiUrgency | null;
}

export interface ApiDashboardMetrics {
  total_requests: number;
  pending_verification: number;
  approved_assignments: number;
  completed_deliveries: number;
  shortages: number;
  blocked_routes: number;
  total_reports: number;
  verified_needs: number;
  delivered_assignments: number;
  outstanding_demand: number;
  delivery_completion_rate: number;
  verified_requests: number;
  clarification_requested: number;
  proposed_matches: number;
  active_assignments: number;
  failed_deliveries: number;
  cancelled_assignments: number;
  open_shortage_units: number;
  available_inventory_units: number;
  reserved_inventory_units: number;
}

export interface ApiAuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  actor_type: string;
  actor_name: string;
  reason: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ApiApprovalResult {
  recommendation: ApiRecommendation;
  assignment: ApiAssignment;
  supplier: ApiSupplier | null;
}

export interface ApiHealth {
  status: string;
  database: string;
}
