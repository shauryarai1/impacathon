import type {
  AuditEvent,
  DashboardMetrics,
  DeliveryAssignment,
  ReliefRequest,
  ReliefRoute,
  ResourceStock,
  SuggestedMatch,
  Supplier,
} from "../api/types";

export const DEMO_DATA_ENABLED = import.meta.env.VITE_USE_DEMO_DATA !== "false";

export const demoMetrics: DashboardMetrics = {
  activeRequests: 18,
  awaitingApproval: 6,
  availableResources: 1240,
  completedDeliveries: 42,
};

// Fixed fixture timestamps are demo records only. Live UI timestamps must come from the API response.
export const demoRequests: ReliefRequest[] = [
  {
    id: "REQ-1048",
    residentLabel: "Household 1048",
    location: "North Ridge · Block 4",
    need: "Water",
    quantity: 48,
    unit: "litres",
    urgency: "Critical",
    status: "Awaiting review",
    submittedAt: "2026-10-23T14:02:00+05:30",
    warning: "Similar request nearby · review before approving",
  },
  {
    id: "REQ-1047",
    residentLabel: "Clinic 07",
    location: "East Junction",
    need: "Medical",
    quantity: 2,
    unit: "first-aid kits",
    urgency: "High",
    status: "Needs information",
    submittedAt: "2026-10-23T13:48:00+05:30",
    details:
      "Trauma dressings and sterile gloves needed for the mobile clinic.",
  },
  {
    id: "REQ-1046",
    residentLabel: "Household 1046",
    location: "South Market",
    need: "Food",
    quantity: 36,
    unit: "meal packs",
    urgency: "High",
    status: "Verified",
    submittedAt: "2026-10-23T13:32:00+05:30",
  },
  {
    id: "REQ-1045",
    residentLabel: "Shelter 12",
    location: "West Field",
    need: "Shelter",
    quantity: 8,
    unit: "blankets",
    urgency: "Routine",
    status: "Awaiting review",
    submittedAt: "2026-10-23T12:48:00+05:30",
  },
];

export const demoSuppliers: Supplier[] = [
  {
    id: "SUP-01",
    name: "Harbor Relief Store",
    region: "North Ridge",
    supplies: ["Water", "Food"],
    reliability: "Verified partner",
  },
  {
    id: "SUP-02",
    name: "Civic Medical Network",
    region: "East Junction",
    supplies: ["Medical"],
    reliability: "Verified partner",
  },
  {
    id: "SUP-03",
    name: "Common Ground Depot",
    region: "West Field",
    supplies: ["Shelter", "Food"],
    reliability: "New partner",
  },
];
export const demoResources: ResourceStock[] = [
  {
    id: "RES-01",
    name: "Bottled water",
    quantity: 860,
    unit: "litres",
    location: "Harbor Relief Store",
    state: "Available",
  },
  {
    id: "RES-02",
    name: "Meal packs",
    quantity: 244,
    unit: "packs",
    location: "Common Ground Depot",
    state: "Available",
  },
  {
    id: "RES-03",
    name: "First-aid kits",
    quantity: 4,
    unit: "kits",
    location: "Civic Medical Network",
    state: "Low",
  },
];
export const demoRoutes: ReliefRoute[] = [
  {
    id: "ROUTE-01",
    name: "North Ridge access road",
    from: "Harbor Relief Store",
    to: "North Ridge · Block 4",
    status: "Accessible",
    note: "Open for light vehicles",
  },
  {
    id: "ROUTE-02",
    name: "East Junction bridge",
    from: "Civic Medical Network",
    to: "East Junction",
    status: "Limited",
    note: "One-way traffic only",
  },
  {
    id: "ROUTE-03",
    name: "West Field service lane",
    from: "Common Ground Depot",
    to: "West Field",
    status: "Blocked",
    note: "Flooding reported 18 min ago",
  },
];
export const demoMatches: SuggestedMatch[] = [
  {
    id: "MATCH-01",
    requestId: "REQ-1048",
    supplierId: "SUP-01",
    resource: "Bottled water",
    quantity: 48,
    unit: "litres",
    routeId: "ROUTE-01",
    reason:
      "Closest verified water stock with an accessible route to North Ridge.",
  },
  {
    id: "MATCH-02",
    requestId: "REQ-1047",
    supplierId: "SUP-02",
    resource: "First-aid kits",
    quantity: 2,
    unit: "kits",
    routeId: "ROUTE-02",
    reason:
      "Medical supplier has the requested stock; route is limited but open.",
  },
  {
    id: "MATCH-03",
    requestId: "REQ-1045",
    supplierId: "SUP-03",
    resource: "Blankets",
    quantity: 8,
    unit: "blankets",
    routeId: "ROUTE-03",
    reason:
      "Stock is nearby, but the current route is blocked and needs replanning.",
  },
];
export const demoDeliveries: DeliveryAssignment[] = [
  {
    id: "DEL-209",
    requestId: "REQ-1046",
    destination: "South Market",
    resource: "Meal packs",
    quantity: 36,
    unit: "packs",
    volunteer: "Maya R.",
    status: "In Transit",
    updatedAt: "12 min ago",
  },
  {
    id: "DEL-208",
    requestId: "REQ-1042",
    destination: "North Ridge · Block 2",
    resource: "Bottled water",
    quantity: 72,
    unit: "litres",
    volunteer: "Jon K.",
    status: "Delivered",
    updatedAt: "34 min ago",
  },
  {
    id: "DEL-207",
    requestId: "REQ-1039",
    destination: "West Field",
    resource: "Blankets",
    quantity: 12,
    unit: "blankets",
    volunteer: "Unassigned",
    status: "Dispatched",
    updatedAt: "46 min ago",
  },
];
export const demoAudit: AuditEvent[] = [
  {
    id: "AUD-01",
    action: "Request received",
    actor: "Resident form",
    time: "8 min ago",
    detail: "REQ-1048 · Water · North Ridge",
  },
  {
    id: "AUD-02",
    action: "Clarification requested",
    actor: "A. Patel",
    time: "22 min ago",
    detail: "REQ-1047 · Medical supplies",
  },
  {
    id: "AUD-03",
    action: "Delivery updated",
    actor: "Maya R.",
    time: "12 min ago",
    detail: "DEL-209 · In Transit",
  },
];
