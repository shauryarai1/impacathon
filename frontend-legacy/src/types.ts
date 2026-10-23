export type ReportCategory =
  | "water"
  | "food"
  | "shelter"
  | "medical"
  | "road_blockage"
  | "other";

export type ReportType = "need" | "hazard";

export type Urgency = "low" | "medium" | "high" | "critical";

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

export type ShortageStatus = "open" | "resolved";

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Report {
  id: number;
  reporter_name: string;
  category: ReportCategory;
  type: ReportType;
  location: string;
  description: string;
  quantity: number;
  urgency: Urgency;
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

export interface ReportCreate {
  reporter_name: string;
  category: ReportCategory;
  type: ReportType;
  location: string;
  description: string;
  quantity: number;
  urgency: Urgency;
}

export interface ReportReview {
  id: number;
  report_id: number;
  coordinator_id: number;
  decision: "verified" | "rejected" | "clarification_requested";
  reason: string;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  location: string;
  contact_name: string | null;
  verification_status: SupplierVerificationStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreate {
  name: string;
  location: string;
  contact_name?: string | null;
  verification_status?: SupplierVerificationStatus;
  active?: boolean;
}

export interface SupplierUpdate {
  name?: string;
  location?: string;
  contact_name?: string | null;
  verification_status?: SupplierVerificationStatus;
  active?: boolean;
  reason: string;
}

export interface Resource {
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

export interface ResourceCreate {
  supplier_id: number;
  name: string;
  category: ReportCategory;
  quantity_available: number;
}

export interface ResourceRestock {
  quantity: number;
  reason: string;
}

export interface Route {
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

export interface RouteCreate {
  origin: string;
  destination: string;
  travel_cost: number;
  blocked?: boolean;
}

export interface Recommendation {
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
  report_urgency: Urgency | null;
  report_quantity: number | null;
  resource_name: string | null;
  supplier_name: string | null;
  supplier_location: string | null;
  assignment_id: number | null;
  assignment_status: string | null;
  remaining_shortage: number | null;
}

export interface Assignment {
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

export interface AssignmentStatusUpdate {
  status: AssignmentStatus;
  note?: string;
  failure_reason?: string;
}

export interface Shortage {
  id: number;
  report_id: number;
  quantity: number;
  reason: string;
  status: ShortageStatus;
  source: string;
  reported_by_id: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  report_location: string | null;
  report_category: ReportCategory | null;
  report_urgency: Urgency | null;
}

export interface DashboardMetrics {
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

export interface AuditLog {
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

export interface MatchGenerationResult {
  generated_count: number;
  superseded_count: number;
  recommendations: Recommendation[];
  shortages: Shortage[];
}

export interface ApprovalResult {
  recommendation: Recommendation;
  assignment: Assignment;
  supplier: Supplier | null;
}

export interface HealthStatus {
  status: string;
  database: string;
}

export interface ReportListParams {
  status?: ReportStatus;
  category?: ReportCategory;
  type?: ReportType;
  location?: string;
  limit?: number;
}

export interface MatchGeneratePayload {
  report_id?: number;
  replace_proposed?: boolean;
}

export interface ModifyRecommendationPayload {
  reason: string;
  quantity?: number;
  resource_id?: number;
}

export interface ShortageCreate {
  report_id: number;
  quantity: number;
  reason: string;
}

export interface AuditLogParams {
  entity_type?: string;
  entity_id?: number;
  action?: string;
  limit?: number;
}
