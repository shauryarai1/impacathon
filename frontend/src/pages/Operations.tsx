import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Ban,
  Check,
  CircleAlert,
  GitBranch,
  LoaderCircle,
  PackagePlus,
  Pencil,
  RefreshCw,
  Route,
  ShieldCheck,
  Store,
  Unlock,
  Users,
} from "lucide-react";
import type {
  ApiRecommendation,
  ApiResource,
  ApiRoute,
  ReportCategory,
  SupplierVerificationStatus,
} from "../api/types";
import { api } from "../api/client";
import { useApiData } from "../lib/useApi";
import {
  displayId,
  needFromCategory,
  routeStatusLabel,
  urgencyLabel,
} from "../lib/format";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Notice,
  PageHeader,
  SectionHeading,
  StatusBadge,
  Surface,
} from "../components/UI";

type OpsTab = "resources" | "matches" | "approval";
type Decision = "approve" | "modify" | "reject";
type NoticeState = { tone: "success" | "error" | "info"; text: string };

const categories: ReportCategory[] = [
  "water",
  "food",
  "shelter",
  "medical",
  "other",
];
const verificationStatuses: SupplierVerificationStatus[] = [
  "pending",
  "verified",
  "rejected",
];

function resourceState(resource: ApiResource): string {
  if (resource.quantity_available <= 0) return "Shortage";
  if (resource.quantity_available < 25) return "Limited";
  return "Available";
}

export default function Operations() {
  const [tab, setTab] = useState<OpsTab>("resources");
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const suppliers = useApiData(() => api.listSuppliers(), []);
  const resources = useApiData(() => api.listResources(), []);
  const routes = useApiData(() => api.listRoutes(), []);
  const matches = useApiData(() => api.listMatches("proposed"), []);
  const shortages = useApiData(() => api.listShortages("open"), []);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierBusy, setSupplierBusy] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    location: "",
    contact: "",
    verification_status: "verified" as SupplierVerificationStatus,
  });

  const [restockOpen, setRestockOpen] = useState(false);
  const [restockBusy, setRestockBusy] = useState(false);
  const [restockError, setRestockError] = useState("");
  const [restockForm, setRestockForm] = useState({
    resource_id: "",
    quantity: "",
    reason: "Emergency resupply.",
  });

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryForm, setInventoryForm] = useState({
    supplier_id: "",
    name: "",
    category: "water" as ReportCategory,
    quantity: "",
  });

  const [supplierEditOpen, setSupplierEditOpen] = useState(false);
  const [supplierEditBusy, setSupplierEditBusy] = useState(false);
  const [supplierEditError, setSupplierEditError] = useState("");
  const [supplierEditForm, setSupplierEditForm] = useState({
    supplier_id: "",
    verification_status: "verified" as SupplierVerificationStatus,
    active: "true",
    reason: "Supplier verification reviewed.",
  });

  const [routeDialog, setRouteDialog] = useState<ApiRoute | null>(null);
  const [routeReason, setRouteReason] = useState("");
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState("");

  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState("");

  const [generating, setGenerating] = useState(false);

  const supplierMap = useMemo(
    () =>
      new Map((suppliers.data ?? []).map((supplier) => [supplier.id, supplier])),
    [suppliers.data],
  );
  const resourceMap = useMemo(
    () =>
      new Map((resources.data ?? []).map((resource) => [resource.id, resource])),
    [resources.data],
  );
  const routeMap = useMemo(
    () => new Map((routes.data ?? []).map((route) => [route.id, route])),
    [routes.data],
  );

  const proposedMatches = matches.data ?? [];
  const selectedIndex = Math.max(
    0,
    proposedMatches.findIndex((match) => match.id === selectedMatchId),
  );
  const activeMatch: ApiRecommendation | null =
    proposedMatches[selectedIndex] ?? null;
  const activeRequest = activeMatch;
  const activeSupplier = activeMatch
    ? supplierMap.get(activeMatch.supplier_id)
    : undefined;
  const activeResource = activeMatch
    ? resourceMap.get(activeMatch.resource_id)
    : undefined;
  const activeRoute =
    activeMatch && activeMatch.route_id
      ? routeMap.get(activeMatch.route_id)
      : undefined;

  useEffect(() => {
    if (activeMatch) {
      setQuantity(String(activeMatch.quantity));
      setEditing(false);
    }
  }, [activeMatch?.id, activeMatch?.quantity]);

  const reloadLive = () => {
    suppliers.reload();
    resources.reload();
    routes.reload();
    matches.reload();
    shortages.reload();
  };

  const announce = (tone: NoticeState["tone"], text: string) =>
    setNotice({ tone, text });

  const setFailure = (reason: unknown) =>
    announce(
      "error",
      reason instanceof Error ? reason.message : "The action could not be completed.",
    );

  const createSupplier = async () => {
    if (!supplierForm.name.trim() || !supplierForm.location.trim()) {
      setSupplierError("Supplier name and location are required.");
      return;
    }
    setSupplierBusy(true);
    setSupplierError("");
    try {
      await api.createSupplier({
        name: supplierForm.name.trim(),
        location: supplierForm.location.trim(),
        contact_name: supplierForm.contact.trim() || null,
        verification_status: supplierForm.verification_status,
        active: true,
      });
      setSupplierOpen(false);
      setSupplierForm({
        name: "",
        location: "",
        contact: "",
        verification_status: "verified",
      });
      announce("success", "Supplier created.");
      suppliers.reload();
      resources.reload();
    } catch (reason) {
      setSupplierError(
        reason instanceof Error ? reason.message : "Supplier could not be created.",
      );
    } finally {
      setSupplierBusy(false);
    }
  };

  const restock = async () => {
    if (!restockForm.resource_id) {
      setRestockError("Choose a resource to restock.");
      return;
    }
    if (restockForm.reason.trim().length < 3) {
      setRestockError("Add a short reason for the restock.");
      return;
    }
    setRestockBusy(true);
    setRestockError("");
    try {
      await api.restockResource(Number(restockForm.resource_id), {
        quantity: Number(restockForm.quantity),
        reason: restockForm.reason.trim(),
      });
      setRestockOpen(false);
      setRestockForm({
        resource_id: "",
        quantity: "",
        reason: "Emergency resupply.",
      });
      announce("success", "Inventory restocked.");
      resources.reload();
    } catch (reason) {
      setRestockError(
        reason instanceof Error ? reason.message : "Inventory could not be changed.",
      );
    } finally {
      setRestockBusy(false);
    }
  };

  const createInventory = async () => {
    if (!inventoryForm.supplier_id) {
      setInventoryError("Choose a supplier.");
      return;
    }
    if (!inventoryForm.name.trim()) {
      setInventoryError("Resource name is required.");
      return;
    }
    setInventoryBusy(true);
    setInventoryError("");
    try {
      await api.createResource({
        supplier_id: Number(inventoryForm.supplier_id),
        name: inventoryForm.name.trim(),
        category: inventoryForm.category,
        quantity_available: Number(inventoryForm.quantity),
      });
      setInventoryOpen(false);
      setInventoryForm({
        supplier_id: "",
        name: "",
        category: "water",
        quantity: "",
      });
      announce("success", "Inventory added.");
      resources.reload();
    } catch (reason) {
      setInventoryError(
        reason instanceof Error ? reason.message : "Inventory could not be added.",
      );
    } finally {
      setInventoryBusy(false);
    }
  };

  const updateSupplier = async () => {
    if (!supplierEditForm.supplier_id) {
      setSupplierEditError("Choose a supplier.");
      return;
    }
    if (supplierEditForm.reason.trim().length < 3) {
      setSupplierEditError("Add a short reason for the update.");
      return;
    }
    setSupplierEditBusy(true);
    setSupplierEditError("");
    try {
      await api.updateSupplier(Number(supplierEditForm.supplier_id), {
        verification_status: supplierEditForm.verification_status,
        active: supplierEditForm.active === "true",
        reason: supplierEditForm.reason.trim(),
      });
      setSupplierEditOpen(false);
      announce("success", "Supplier updated.");
      suppliers.reload();
      matches.reload();
    } catch (reason) {
      setSupplierEditError(
        reason instanceof Error ? reason.message : "Supplier could not be updated.",
      );
    } finally {
      setSupplierEditBusy(false);
    }
  };

  const openRouteDialog = (route: ApiRoute) => {
    setRouteDialog(route);
    setRouteReason(
      route.blocked
        ? "Route inspected and reopened."
        : "Access is currently unsafe.",
    );
    setRouteError("");
  };

  const changeRoute = async () => {
    if (!routeDialog) return;
    if (routeReason.trim().length < 3) {
      setRouteError("Add a short reason for the route change.");
      return;
    }
    setRouteBusy(true);
    setRouteError("");
    try {
      if (routeDialog.blocked) {
        await api.unblockRoute(routeDialog.id, routeReason.trim());
        announce("success", "Route reopened.");
      } else {
        await api.blockRoute(routeDialog.id, routeReason.trim());
        announce("success", "Route blocked. Affected suggestions are flagged.");
      }
      setRouteDialog(null);
      routes.reload();
      matches.reload();
      shortages.reload();
    } catch (reason) {
      setRouteError(
        reason instanceof Error ? reason.message : "Route could not be updated.",
      );
    } finally {
      setRouteBusy(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await api.generateMatches({ replace_proposed: true });
      announce(
        "success",
        `Generated ${result.generated_count} suggestion${
          result.generated_count === 1 ? "" : "s"
        }. No stock was reserved. Every suggestion still needs approval.`,
      );
      matches.reload();
      shortages.reload();
    } catch (reason) {
      setFailure(reason);
    } finally {
      setGenerating(false);
    }
  };

  const openMatch = (match: ApiRecommendation) => {
    setSelectedMatchId(match.id);
    setTab("approval");
    setEditing(false);
    setNotice(null);
  };

  const openDecision = (next: Decision) => {
    setDecision(next);
    setDecisionReason("");
    setDecisionError("");
  };

  const completeDecision = async () => {
    if (!activeMatch || !decision) return;
    if (decisionReason.trim().length < 3) {
      setDecisionError("A reason of at least 3 characters is required.");
      return;
    }

    setDecisionBusy(true);
    setDecisionError("");
    try {
      if (decision === "approve") {
        const result = await api.approveMatch(activeMatch.id, decisionReason.trim());
        announce(
          "success",
          `Approved. Assignment ${displayId("DEL", result.assignment.id)} created and stock reserved.`,
        );
        setDecision(null);
        setSelectedMatchId(null);
        matches.reload();
        resources.reload();
        shortages.reload();
      } else if (decision === "reject") {
        await api.rejectMatch(activeMatch.id, decisionReason.trim());
        announce("success", "Recommendation rejected. No stock was reserved.");
        setDecision(null);
        setSelectedMatchId(null);
        matches.reload();
        shortages.reload();
      } else {
        const nextQuantity = Number(quantity);
        if (!Number.isFinite(nextQuantity) || nextQuantity < 1) {
          setDecisionError("Enter a quantity of at least 1.");
          setDecisionBusy(false);
          return;
        }
        if (nextQuantity === activeMatch.quantity) {
          setDecisionError("Change the quantity before saving a modification.");
          setDecisionBusy(false);
          return;
        }
        await api.modifyMatch(activeMatch.id, {
          reason: decisionReason.trim(),
          quantity: nextQuantity,
        });
        announce(
          "success",
          "Modification saved. It is still unapproved and requires a fresh human decision.",
        );
        setDecision(null);
        setEditing(false);
        matches.reload();
      }
    } catch (reason) {
      setDecisionError(
        reason instanceof Error ? reason.message : "The decision could not be saved.",
      );
    } finally {
      setDecisionBusy(false);
    }
  };

  const resourceError = suppliers.error || resources.error || routes.error;
  const matchError = matches.error || shortages.error || routes.error;
  const resourcesLoading =
    (suppliers.loading && !suppliers.data) ||
    (resources.loading && !resources.data) ||
    (routes.loading && !routes.data);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coordinator / Operations"
        title="Move from signal to action."
        description="Resources, explainable suggestions, and human approval live together here."
      />
      <div className="ops-tabs" role="tablist" aria-label="Operations sections">
        <button
          role="tab"
          aria-selected={tab === "resources"}
          className={
            tab === "resources" ? "ops-tab ops-tab--active" : "ops-tab"
          }
          onClick={() => setTab("resources")}
        >
          <Store size={16} /> Resources
        </button>
        <button
          role="tab"
          aria-selected={tab === "matches"}
          className={tab === "matches" ? "ops-tab ops-tab--active" : "ops-tab"}
          onClick={() => setTab("matches")}
        >
          <GitBranch size={16} /> Suggested matches
        </button>
        <button
          role="tab"
          aria-selected={tab === "approval"}
          className={tab === "approval" ? "ops-tab ops-tab--active" : "ops-tab"}
          onClick={() => setTab("approval")}
        >
          <ShieldCheck size={16} /> Human approval
        </button>
      </div>

      {notice && (
        notice.tone === "success" ? (
          <div className="ops-notice">
            <Check size={15} /> {notice.text}
          </div>
        ) : (
          <Notice tone={notice.tone}>{notice.text}</Notice>
        )
      )}

      {tab === "resources" && (
        <div className="ops-stack">
          {resourceError && (
            <Notice tone="error">{resourceError}</Notice>
          )}
          <div className="ops-actions">
            <div>
              <p className="eyebrow">Resource picture</p>
              <h2>Know what can move.</h2>
            </div>
            <div className="button-row">
              <Button
                variant="secondary"
                onClick={() => {
                  setSupplierError("");
                  setSupplierOpen(true);
                }}
              >
                <Users size={15} /> Add supplier
              </Button>
              <Button
                onClick={() => {
                  setRestockError("");
                  setRestockOpen(true);
                }}
              >
                <PackagePlus size={15} /> Restock resources
              </Button>
            </div>
          </div>

          {resourcesLoading ? (
            <Surface>
              <EmptyState
                icon={<LoaderCircle className="spin" size={18} />}
                title="Loading the resource picture"
                description="Fetching supplier, stock, and route data from the Lifeline API."
              />
            </Surface>
          ) : (
            <div className="resource-grid">
              <Surface>
                <SectionHeading
                  title="Available stock"
                  description="Verified supply across the response area."
                />
                {resources.data?.length ? (
                  <div className="resource-list">
                    {resources.data.map((resource) => {
                      const supplier = supplierMap.get(resource.supplier_id);
                      return (
                        <div className="resource-row" key={resource.id}>
                          <span className="resource-icon">
                            <PackagePlus size={16} />
                          </span>
                          <span className="resource-main">
                            <strong>{resource.name}</strong>
                            <small>
                              {supplier?.name ?? `Supplier #${resource.supplier_id}`}
                              {supplier?.location ? ` · ${supplier.location}` : ""}
                            </small>
                          </span>
                          <span className="resource-amount">
                            <strong>
                              {resource.quantity_available.toLocaleString()}
                            </strong>
                            <small>units</small>
                          </span>
                          <StatusBadge value={resourceState(resource)} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-inline">
                    No inventory has been added yet.
                  </div>
                )}
              </Surface>
              <Surface>
                <SectionHeading
                  title="Routes"
                  description="Access changes need a fresh review."
                />
                {routes.data?.length ? (
                  <div className="route-list">
                    {routes.data.map((item) => (
                      <div className="route-row" key={item.id}>
                        <span className="route-icon">
                          <Route size={16} />
                        </span>
                        <span className="resource-main">
                          <strong>
                            {item.origin} → {item.destination}
                          </strong>
                          <small>
                            Route #{item.id} · travel cost {item.travel_cost}
                          </small>
                        </span>
                        <span className="route-status">
                          <StatusBadge
                            value={routeStatusLabel(item.blocked)}
                          />
                          <small>
                            {item.blocked_reason ?? "Open for coordination."}
                          </small>
                        </span>
                        <button
                          className="icon-button"
                          onClick={() => openRouteDialog(item)}
                          aria-label={
                            item.blocked ? "Unblock route" : "Block route"
                          }
                          disabled={routeBusy}
                        >
                          {item.blocked ? (
                            <Unlock size={16} />
                          ) : (
                            <Ban size={16} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-inline">No routes recorded yet.</div>
                )}
              </Surface>
            </div>
          )}

          <Surface className="advanced-panel">
            <div>
              <p className="eyebrow">Secondary controls</p>
              <h3>Advanced operations</h3>
              <p>
                Add stock or verify existing suppliers without cluttering the
                resource picture. Every change is audited.
              </p>
            </div>
            <div className="button-row">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setInventoryError("");
                  setInventoryOpen(true);
                }}
              >
                <PackagePlus size={14} /> Add inventory
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSupplierEditError("");
                  setSupplierEditOpen(true);
                }}
              >
                <Users size={14} /> Update supplier
              </Button>
              <Button variant="ghost" size="sm" onClick={reloadLive}>
                <RefreshCw size={14} /> Refresh
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {tab === "matches" && (
        <div className="ops-stack">
          {matchError && <Notice tone="error">{matchError}</Notice>}
          <div className="ops-actions">
            <div>
              <p className="eyebrow">Explainable allocation</p>
              <h2>Review what the engine suggests.</h2>
            </div>
            <div className="button-row">
              <Button variant="ghost" size="sm" onClick={reloadLive}>
                <RefreshCw size={14} /> Refresh
              </Button>
              <Button onClick={generate} disabled={generating}>
                {generating ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <GitBranch size={15} />
                )}
                {generating ? "Generating" : "Generate suggestions"}
              </Button>
            </div>
          </div>
          <Notice tone="warning">
            Suggested matches are explainable recommendations only. They are not
            approved and do not reserve stock.
          </Notice>

          {matches.loading && !matches.data ? (
            <Surface>
              <EmptyState
                icon={<LoaderCircle className="spin" size={18} />}
                title="Loading suggestions"
                description="Fetching the current allocation proposals."
              />
            </Surface>
          ) : proposedMatches.length === 0 ? (
            <Surface>
              <EmptyState
                title="No suggestions waiting"
                description="Verify a need, then generate suggestions to see possible allocations."
              />
            </Surface>
          ) : (
            <div className="match-list">
              {proposedMatches.map((item) => {
                const matchSupplier = supplierMap.get(item.supplier_id);
                const matchRoute = item.route_id
                  ? routeMap.get(item.route_id)
                  : undefined;
                return (
                  <Surface className="match-card" key={item.id}>
                    <div className="match-card__top">
                      <StatusBadge value="Suggested — Not Approved" />
                      <span className="match-id">
                        {displayId("MAT", item.id)}
                      </span>
                    </div>
                    <div className="match-flow">
                      <div>
                        <span className="eyebrow">Request needs</span>
                        <strong>
                          {displayId("REQ", item.report_id)} ·{" "}
                          {needFromCategory(item.report_category)}
                        </strong>
                        <small>{item.report_location}</small>
                      </div>
                      <ArrowRight size={18} />
                      <div>
                        <span className="eyebrow">Supplier</span>
                        <strong>{matchSupplier?.name ?? item.supplier_name}</strong>
                        <small>
                          {item.quantity} units · {item.resource_name}
                        </small>
                      </div>
                      <ArrowRight size={18} />
                      <div>
                        <span className="eyebrow">Route</span>
                        <strong>
                          {matchRoute
                            ? `${matchRoute.origin} → ${matchRoute.destination}`
                            : "Same area"}
                        </strong>
                        <small>
                          <StatusBadge
                            value={routeStatusLabel(Boolean(matchRoute?.blocked))}
                          />
                        </small>
                      </div>
                    </div>
                    <div className="match-reason">
                      <GitBranch size={16} />
                      <span>
                        <strong>Why this was suggested:</strong> {item.rationale}
                      </span>
                    </div>
                    {item.needs_review && (
                      <Notice tone="warning">
                        {item.review_reason ??
                          "This suggestion needs coordinator attention before approval."}
                      </Notice>
                    )}
                    <button className="text-button" onClick={() => openMatch(item)}>
                      Open for human approval <ArrowRight size={14} />
                    </button>
                  </Surface>
                );
              })}
            </div>
          )}

          <Surface>
            <SectionHeading
              title="Open shortages"
              description="Replanning creates fresh suggestions; it never reassigns approved work."
            />
            {shortages.data?.length ? (
              <div className="resource-list">
                {shortages.data.map((shortage) => (
                  <div className="resource-row" key={shortage.id}>
                    <span className="resource-icon">
                      <CircleAlert size={16} />
                    </span>
                    <span className="resource-main">
                      <strong>
                        {displayId("REQ", shortage.report_id)} ·{" "}
                        {shortage.quantity} units short
                      </strong>
                      <small>
                        {shortage.report_location ?? "Unknown location"} ·{" "}
                        {shortage.reason}
                      </small>
                    </span>
                    <span className="resource-amount">
                      <strong>{shortage.quantity}</strong>
                      <small>units</small>
                    </span>
                    <StatusBadge value="Shortage" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inline">
                No open shortages. Accessible supply covers current demand.
              </div>
            )}
          </Surface>
        </div>
      )}

      {tab === "approval" && (
        <div className="approval-layout">
          {matches.loading && !matches.data ? (
            <Surface>
              <EmptyState
                icon={<LoaderCircle className="spin" size={18} />}
                title="Loading approval queue"
                description="Fetching proposed matches that need a human decision."
              />
            </Surface>
          ) : activeMatch && activeRequest ? (
            <>
              <Surface className="approval-card">
                <div className="approval-card__top">
                  <div>
                    <p className="eyebrow">
                      Recommendation {selectedIndex + 1} of{" "}
                      {proposedMatches.length}
                    </p>
                    <h2>Does this match make sense?</h2>
                  </div>
                  <span className="approval-lock">
                    <ShieldCheck size={15} /> Human decision required
                  </span>
                </div>
                <Notice tone="warning">
                  Nothing moves until you explicitly approve this recommendation.
                </Notice>
                <div className="approval-request">
                  <div className="approval-request__id">
                    <span className="detail-need-icon">
                      {needFromCategory(activeRequest.report_category).slice(0, 1)}
                    </span>
                    <div>
                      <span className="eyebrow">Request</span>
                      <h3>
                        {displayId("REQ", activeRequest.report_id)} ·{" "}
                        {needFromCategory(activeRequest.report_category)}
                      </h3>
                      <p>
                        {activeRequest.report_location} ·{" "}
                        {urgencyLabel(activeRequest.report_urgency)} urgency
                      </p>
                    </div>
                  </div>
                  <div className="approval-quantity">
                    <span className="eyebrow">Quantity</span>
                    {editing ? (
                      <input
                        className="quantity-input"
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                      />
                    ) : (
                      <strong>{activeMatch.quantity} units</strong>
                    )}
                  </div>
                </div>
                <div className="approval-details">
                  <div>
                    <span className="eyebrow">Supplier</span>
                    <strong>
                      {activeSupplier?.name ?? activeMatch.supplier_name}
                    </strong>
                    <small>
                      {activeSupplier?.verification_status === "verified"
                        ? "Verified supplier"
                        : "Supplier verification pending"}
                    </small>
                  </div>
                  <div>
                    <span className="eyebrow">Route status</span>
                    <strong>
                      <StatusBadge
                        value={routeStatusLabel(Boolean(activeRoute?.blocked))}
                      />
                    </strong>
                    <small>
                      {activeRoute
                        ? activeRoute.blocked_reason ??
                          `${activeRoute.origin} → ${activeRoute.destination}`
                        : "Same area · no travel required"}
                    </small>
                  </div>
                  <div>
                    <span className="eyebrow">Stock availability</span>
                    <strong>
                      {activeResource
                        ? `${activeResource.quantity_available} units`
                        : "Unavailable"}
                    </strong>
                    <small>Before approval · not reserved</small>
                  </div>
                </div>
                <div className="approval-explanation">
                  <GitBranch size={17} />
                  <div>
                    <span className="eyebrow">Explanation</span>
                    <p>{activeMatch.rationale}</p>
                  </div>
                </div>
                {activeMatch.needs_review && (
                  <Notice tone="warning">
                    {activeMatch.review_reason ??
                      "This suggestion needs attention before approval."}
                  </Notice>
                )}
                {editing && (
                  <div className="modify-row">
                    <Pencil size={15} />
                    <span>
                      Modify quantity for review. This still needs a separate
                      explicit approval.
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openDecision("modify")}
                    >
                      Save modification
                    </Button>
                  </div>
                )}
                <div className="approval-actions">
                  <Button
                    variant="danger"
                    onClick={() => openDecision("reject")}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setEditing((current) => !current)}
                  >
                    <Pencil size={15} /> Modify
                  </Button>
                  <Button onClick={() => openDecision("approve")}>
                    <Check size={15} /> Approve
                  </Button>
                </div>
                <div className="approval-trail">
                  <span>
                    <RefreshCw size={14} /> The approval trail records the
                    decision, coordinator, and timestamp.
                  </span>
                  <small>No inventory mutation until approval.</small>
                </div>
              </Surface>
              <div className="approval-aside">
                <p className="eyebrow">Safety check</p>
                <h3>Review with the whole picture.</h3>
                <div className="safety-list">
                  <div>
                    <span className="safety-number">01</span>
                    <span>Is the requested quantity plausible?</span>
                  </div>
                  <div>
                    <span className="safety-number">02</span>
                    <span>Can the route be reached safely?</span>
                  </div>
                  <div>
                    <span className="safety-number">03</span>
                    <span>Has another request already covered this need?</span>
                  </div>
                </div>
                <p className="aside-note">
                  Blocked routes and shortages trigger replanning. Replanned
                  suggestions always return here for fresh human approval.
                </p>
              </div>
            </>
          ) : (
            <EmptyState
              title="No recommendation waiting"
              description="Suggested matches will appear here after you generate them."
            />
          )}
        </div>
      )}

      {decision && activeMatch && (
        <ConfirmDialog
          title={
            decision === "approve"
              ? "Approve this allocation?"
              : decision === "reject"
                ? "Reject this recommendation?"
                : "Save this modification?"
          }
          description={
            decision === "approve"
              ? "Approval reserves stock and creates a delivery assignment. It does not silently dispatch supplies."
              : decision === "reject"
                ? "This recommendation will be marked as rejected in the audit trail. No stock is reserved."
                : "The modified quantity remains unapproved until a separate explicit decision."
          }
          confirmLabel={
            decision === "approve"
              ? "Approve allocation"
              : decision === "reject"
                ? "Reject recommendation"
                : "Save modification"
          }
          onConfirm={completeDecision}
          onCancel={() => {
            if (!decisionBusy) {
              setDecision(null);
              setDecisionError("");
            }
          }}
          busy={decisionBusy}
        >
          <div className="request-form" style={{ marginTop: 14 }}>
            <label>
              Decision reason<span className="required">Required</span>
              <textarea
                rows={3}
                value={decisionReason}
                onChange={(event) => {
                  setDecisionReason(event.target.value);
                  setDecisionError("");
                }}
                placeholder="Why is this the right decision?"
              />
            </label>
            {decision === "modify" && (
              <Notice tone="info">
                New quantity: {quantity} units. This stays unapproved.
              </Notice>
            )}
          </div>
          {decisionError && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="error">{decisionError}</Notice>
            </div>
          )}
        </ConfirmDialog>
      )}

      {supplierOpen && (
        <ConfirmDialog
          eyebrow="Coordinator action"
          title="Add a supplier"
          description="Create a supplier record. Matching only uses verified, active suppliers."
          confirmLabel="Add supplier"
          onConfirm={createSupplier}
          onCancel={() => {
            if (!supplierBusy) setSupplierOpen(false);
          }}
          busy={supplierBusy}
        >
          <div className="request-form" style={{ marginTop: 14 }}>
            <label>
              Name<span className="required">Required</span>
              <input
                value={supplierForm.name}
                onChange={(event) =>
                  setSupplierForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Supplier or relief center"
              />
            </label>
            <label>
              Location<span className="required">Required</span>
              <input
                value={supplierForm.location}
                onChange={(event) =>
                  setSupplierForm((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Area or neighborhood"
              />
            </label>
            <label>
              Contact<span className="optional">Optional</span>
              <input
                value={supplierForm.contact}
                onChange={(event) =>
                  setSupplierForm((current) => ({
                    ...current,
                    contact: event.target.value,
                  }))
                }
                placeholder="Contact name"
              />
            </label>
            <label>
              Verification
              <select
                className="quantity-input"
                value={supplierForm.verification_status}
                onChange={(event) =>
                  setSupplierForm((current) => ({
                    ...current,
                    verification_status: event.target
                      .value as SupplierVerificationStatus,
                  }))
                }
              >
                {verificationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {supplierError && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="error">{supplierError}</Notice>
            </div>
          )}
        </ConfirmDialog>
      )}

      {restockOpen && (
        <ConfirmDialog
          eyebrow="Coordinator action"
          title="Restock inventory"
          description="Add available units to an existing resource. Reserved stock is not changed."
          confirmLabel="Add stock"
          onConfirm={restock}
          onCancel={() => {
            if (!restockBusy) setRestockOpen(false);
          }}
          busy={restockBusy}
        >
          <div className="request-form" style={{ marginTop: 14 }}>
            <label>
              Resource<span className="required">Required</span>
              <select
                className="quantity-input"
                value={restockForm.resource_id}
                onChange={(event) =>
                  setRestockForm((current) => ({
                    ...current,
                    resource_id: event.target.value,
                  }))
                }
              >
                <option value="">Choose a resource</option>
                {(resources.data ?? []).map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    #{resource.id} · {resource.name} ·{" "}
                    {resource.quantity_available} available
                  </option>
                ))}
              </select>
            </label>
            <label>
              Units to add<span className="required">Required</span>
              <input
                type="number"
                min={1}
                value={restockForm.quantity}
                onChange={(event) =>
                  setRestockForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                placeholder="e.g. 100"
              />
            </label>
            <label>
              Reason<span className="required">Required</span>
              <input
                value={restockForm.reason}
                onChange={(event) =>
                  setRestockForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          {restockError && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="error">{restockError}</Notice>
            </div>
          )}
        </ConfirmDialog>
      )}

      {inventoryOpen && (
        <ConfirmDialog
          eyebrow="Coordinator action"
          title="Add inventory"
          description="Create a new resource record for a supplier."
          confirmLabel="Add inventory"
          onConfirm={createInventory}
          onCancel={() => {
            if (!inventoryBusy) setInventoryOpen(false);
          }}
          busy={inventoryBusy}
        >
          <div className="request-form" style={{ marginTop: 14 }}>
            <label>
              Supplier<span className="required">Required</span>
              <select
                className="quantity-input"
                value={inventoryForm.supplier_id}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    supplier_id: event.target.value,
                  }))
                }
              >
                <option value="">Choose a supplier</option>
                {(suppliers.data ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    #{supplier.id} · {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Resource name<span className="required">Required</span>
              <input
                value={inventoryForm.name}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Bottled water"
              />
            </label>
            <label>
              Category
              <select
                className="quantity-input"
                value={inventoryForm.category}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    category: event.target.value as ReportCategory,
                  }))
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Units available<span className="required">Required</span>
              <input
                type="number"
                min={1}
                value={inventoryForm.quantity}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                placeholder="e.g. 100"
              />
            </label>
          </div>
          {inventoryError && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="error">{inventoryError}</Notice>
            </div>
          )}
        </ConfirmDialog>
      )}

      {supplierEditOpen && (
        <ConfirmDialog
          eyebrow="Coordinator action"
          title="Update supplier"
          description="Change verification or availability. Matching only uses verified, active suppliers."
          confirmLabel="Save supplier"
          onConfirm={updateSupplier}
          onCancel={() => {
            if (!supplierEditBusy) setSupplierEditOpen(false);
          }}
          busy={supplierEditBusy}
        >
          <div className="request-form" style={{ marginTop: 14 }}>
            <label>
              Supplier<span className="required">Required</span>
              <select
                className="quantity-input"
                value={supplierEditForm.supplier_id}
                onChange={(event) => {
                  const selected = supplierMap.get(Number(event.target.value));
                  setSupplierEditForm((current) => ({
                    ...current,
                    supplier_id: event.target.value,
                    verification_status:
                      selected?.verification_status ?? "verified",
                    active: selected ? String(selected.active) : "true",
                  }));
                }}
              >
                <option value="">Choose a supplier</option>
                {(suppliers.data ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    #{supplier.id} · {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Verification
              <select
                className="quantity-input"
                value={supplierEditForm.verification_status}
                onChange={(event) =>
                  setSupplierEditForm((current) => ({
                    ...current,
                    verification_status: event.target
                      .value as SupplierVerificationStatus,
                  }))
                }
              >
                {verificationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Availability
              <select
                className="quantity-input"
                value={supplierEditForm.active}
                onChange={(event) =>
                  setSupplierEditForm((current) => ({
                    ...current,
                    active: event.target.value,
                  }))
                }
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <label>
              Reason<span className="required">Required</span>
              <input
                value={supplierEditForm.reason}
                onChange={(event) =>
                  setSupplierEditForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          {supplierEditError && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="error">{supplierEditError}</Notice>
            </div>
          )}
        </ConfirmDialog>
      )}

      {routeDialog && (
        <ConfirmDialog
          eyebrow="Coordinator action"
          title={routeDialog.blocked ? "Reopen this route?" : "Block this route?"}
          description={
            routeDialog.blocked
              ? "Reopened routes become available to new matching suggestions."
              : "Blocked routes are excluded from matching and affected suggestions are flagged for review."
          }
          confirmLabel={routeDialog.blocked ? "Reopen route" : "Block route"}
          onConfirm={changeRoute}
          onCancel={() => {
            if (!routeBusy) setRouteDialog(null);
          }}
          busy={routeBusy}
        >
          <div className="request-form" style={{ marginTop: 14 }}>
            <label>
              Reason<span className="required">Required</span>
              <textarea
                rows={3}
                value={routeReason}
                onChange={(event) => {
                  setRouteReason(event.target.value);
                  setRouteError("");
                }}
              />
            </label>
          </div>
          {routeError && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="error">{routeError}</Notice>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
