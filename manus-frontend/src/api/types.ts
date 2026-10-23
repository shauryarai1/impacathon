export type NeedType = 'Water' | 'Food' | 'Shelter' | 'Medical' | 'Other'
export type Urgency = 'Critical' | 'High' | 'Routine'
export type RequestStatus = 'Awaiting review' | 'Needs information' | 'Verified' | 'Rejected'
export type RouteStatus = 'Accessible' | 'Blocked' | 'Limited'
export type DeliveryStatus = 'Dispatched' | 'In Transit' | 'Delivered' | 'Failed' | 'Cancelled'

export interface ReliefRequest {
  id: string
  residentLabel: string
  location: string
  need: NeedType
  quantity: number
  unit: string
  urgency: Urgency
  status: RequestStatus
  /** ISO-8601 timestamp returned by the backend. Never generate this in the UI. */
  submittedAt?: string
  details?: string
  warning?: string
}

export interface Supplier { id: string; name: string; region: string; supplies: string[]; reliability: string }
export interface ResourceStock { id: string; name: string; quantity: number; unit: string; location: string; state: 'Available' | 'Low' | 'Shortage' }
export interface ReliefRoute { id: string; name: string; from: string; to: string; status: RouteStatus; note: string }
export interface SuggestedMatch { id: string; requestId: string; supplierId: string; resource: string; quantity: number; unit: string; routeId: string; reason: string }
export interface DeliveryAssignment { id: string; requestId: string; destination: string; resource: string; quantity: number; unit: string; volunteer: string; status: DeliveryStatus; updatedAt: string }
export interface AuditEvent { id: string; action: string; actor: string; time: string; detail: string }
export interface DashboardMetrics { activeRequests: number; awaitingApproval: number; availableResources: number; completedDeliveries: number }
export interface ApiEnvelope<T> { data: T; message?: string; error?: { code?: string; message?: string } }
