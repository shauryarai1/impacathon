import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../lib/auth";
import { useApiQuery } from "../../../lib/query";
import { useAccessDialog } from "../../../lib/access";
import type { Recommendation, Route } from "../../../types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Notice,
  Select,
  StatusBadge,
  UrgencyBadge,
} from "../../../components/ui";
import { Modal } from "../../../components/Modal";
import { formatCategory, formatNumber } from "../../../lib/format";

type ApprovalDialog = "approve" | "modify" | "reject" | null;

function routeStatus(
  recommendation: Recommendation,
  route: Route | undefined,
): { label: string; tone: "success" | "warning" | "danger" } {
  if (recommendation.route_id === null) {
    return { label: "Same area", tone: "success" };
  }
  if (!route) return { label: "Route unavailable", tone: "warning" };
  return route.blocked
    ? { label: "Route blocked", tone: "danger" }
    : { label: `Open · cost ${route.travel_cost}`, tone: "success" };
}

export function ApprovalTab() {
  const { api, hasCoordinator } = useAuth();
  const { openAccess } = useAccessDialog();

  const matches = useApiQuery(() => api.matches.list("proposed"), [api]);
  const resources = useApiQuery(() => api.resources.list(), [api]);
  const routes = useApiQuery(() => api.routes.list(), [api]);

  const [dialog, setDialog] = useState<ApprovalDialog>(null);
  const [reason, setReason] = useState("");
  const [quantity, setQuantity] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const current = matches.data?.[0];
  const total = matches.data?.length ?? 0;

  const resourceMap = useMemo(
    () => new Map((resources.data ?? []).map((resource) => [resource.id, resource])),
    [resources.data],
  );
  const routeMap = useMemo(
    () => new Map((routes.data ?? []).map((route) => [route.id, route])),
    [routes.data],
  );

  const currentResource = current
    ? resourceMap.get(current.resource_id)
    : undefined;
  const currentRoute =
    current && current.route_id ? routeMap.get(current.route_id) : undefined;
  const info = current ? routeStatus(current, currentRoute) : null;

  const compatibleResources = useMemo(() => {
    if (!current) return [];
    return (resources.data ?? []).filter(
      (resource) => resource.category === current.report_category,
    );
  }, [current, resources.data]);

  const openDialog = (next: Exclude<ApprovalDialog, null>) => {
    if (!current) return;
    if (!hasCoordinator) {
      openAccess();
      return;
    }
    setDialog(next);
    setReason("");
    setActionError(null);
    setQuantity(String(current.quantity));
    setResourceId(String(current.resource_id));
  };

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setActionError(null);
  };

  const validateReason = (): boolean => {
    if (reason.trim().length < 3) {
      setActionError("A reason of at least 3 characters is required.");
      return false;
    }
    return true;
  };

  const refreshAfterDecision = () => {
    matches.reload();
    resources.reload();
  };

  const approve = async () => {
    if (!current || !validateReason()) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.matches.approve(current.id, reason.trim());
      setNotice({
        tone: "success",
        text: `Approved. Assignment #${result.assignment.id} was created and ${result.assignment.quantity} units were reserved. The decision is in the audit trail.`,
      });
      setDialog(null);
      refreshAfterDecision();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The approval could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  const modify = async () => {
    if (!current || !validateReason()) return;
    const nextQuantity = Number(quantity);
    const nextResourceId = Number(resourceId);

    if (
      nextQuantity === current.quantity &&
      nextResourceId === current.resource_id
    ) {
      setActionError("Change the quantity or resource before saving.");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      await api.matches.modify(current.id, {
        reason: reason.trim(),
        quantity: nextQuantity,
        resource_id: nextResourceId,
      });
      setNotice({
        tone: "success",
        text: "Suggestion updated. It remains unapproved and still requires a human decision.",
      });
      setDialog(null);
      refreshAfterDecision();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The suggestion could not be modified.",
      );
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!current || !validateReason()) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.matches.reject(current.id, reason.trim());
      setNotice({
        tone: "success",
        text: "Rejected. No stock was reserved and no assignment was created.",
      });
      setDialog(null);
      matches.reload();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The rejection could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (matches.loading && !matches.data) {
    return (
      <Card>
        <LoadingState label="Loading approval queue…" />
      </Card>
    );
  }

  if (matches.error) {
    return (
      <Card>
        <ErrorState error={matches.error} onRetry={matches.reload} />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {notice ? (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      {!current ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Nothing awaiting approval"
            description="Generate suggestions from verified requests, then review them here. No allocation happens without this step."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white">Human approval</p>
              <p className="mt-1 text-xs text-faint">
                One suggestion at a time. Nothing is reserved until you approve.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="warning">Suggested — Not Approved</Badge>
              <span className="text-xs text-faint">
                1 of {total}
              </span>
            </div>
          </div>

          {!hasCoordinator ? (
            <div className="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning/[0.06] p-4 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                Coordinator access is required to approve, modify, or reject.
              </span>
              <Button variant="secondary" size="sm" onClick={openAccess}>
                Add demo access
              </Button>
            </div>
          ) : null}

          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs text-faint">
                  Recommendation #{current.id}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-medium tracking-[-0.02em] text-white">
                    {current.report_location ?? "Unknown location"}
                  </h2>
                  <UrgencyBadge urgency={current.report_urgency ?? "low"} />
                  <StatusBadge status="proposed" />
                </div>
              </div>
              <Badge tone="warning">Not approved</Badge>
            </div>

            <div className="grid gap-6 py-5 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-faint">
                  Request
                </p>
                <p className="mt-2 text-sm text-white">
                  #{current.report_id} · {formatCategory(current.report_category)}
                </p>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Requested</dt>
                    <dd className="text-muted">
                      {current.report_quantity ?? "—"} units
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Remaining shortage</dt>
                    <dd className="text-muted">
                      {current.remaining_shortage ?? 0} units
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-faint">
                  Supply
                </p>
                <p className="mt-2 text-sm text-white">
                  {current.supplier_name ?? "Unknown supplier"}
                </p>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Resource</dt>
                    <dd className="text-right text-muted">
                      {current.resource_name ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Proposed</dt>
                    <dd className="text-muted">{current.quantity} units</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Available</dt>
                    <dd className="text-muted">
                      {currentResource
                        ? formatNumber(currentResource.quantity_available)
                        : "—"}{" "}
                      units
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-faint">
                  Route
                </p>
                <div className="mt-2">
                  {info ? <Badge tone={info.tone}>{info.label}</Badge> : null}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted">
                  {current.route_id
                    ? `Route #${current.route_id} · ${current.supplier_location ?? "supplier"} → ${current.report_location ?? "destination"}`
                    : `${current.supplier_location ?? "Supplier"} and ${current.report_location ?? "request"} are in the same area.`}
                </p>
              </div>
            </div>

            <div className="rounded-lg border-l-2 border-line bg-[#0F0F0F] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-faint">
                Why this suggestion
              </p>
              <p className="mt-1.5 text-sm leading-6 text-neutral-300">
                {current.rationale}
              </p>
            </div>

            {current.needs_review || !info || info.tone === "danger" ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.06] px-3 py-2.5 text-xs leading-5 text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {current.review_reason ??
                  "This suggestion needs attention before approval. Replanning may offer an alternative."}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
              <Button
                onClick={() => openDialog("approve")}
                disabled={!hasCoordinator}
              >
                Approve
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => openDialog("modify")}
                disabled={!hasCoordinator}
              >
                Modify
              </Button>
              <Button
                variant="danger"
                onClick={() => openDialog("reject")}
                disabled={!hasCoordinator}
              >
                Reject
              </Button>
            </div>

            <p className="mt-4 text-xs leading-5 text-faint">
              Approving reserves stock and creates a delivery assignment. Every
              decision records the coordinator, reason, and time.
            </p>
          </Card>
        </>
      )}

      <Modal
        open={dialog === "approve"}
        onClose={closeDialog}
        title="Approve this allocation?"
        description="This is the point where stock is reserved and a delivery assignment is created."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={approve} loading={busy}>
              Approve & reserve stock
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-[#0F0F0F] p-4 text-sm">
            <p className="text-white">
              {current?.quantity} units of {current?.resource_name}
            </p>
            <p className="mt-1 text-xs text-muted">
              From {current?.supplier_name} to {current?.report_location}
            </p>
          </div>
          <Field label="Approval reason" hint="Required and recorded in the audit trail.">
            <Input
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setActionError(null);
              }}
              placeholder="Why is this allocation safe and appropriate?"
              autoFocus
            />
          </Field>
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}
        </div>
      </Modal>

      <Modal
        open={dialog === "modify"}
        onClose={closeDialog}
        title="Modify suggestion"
        description="Changes keep this recommendation unapproved. You will need to approve it explicitly afterward."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={modify} loading={busy}>
              Save modification
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantity">
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setActionError(null);
                }}
              />
            </Field>
            <Field label="Resource">
              <Select
                value={resourceId}
                onChange={(event) => {
                  setResourceId(event.target.value);
                  setActionError(null);
                }}
              >
                {compatibleResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    #{resource.id} · {resource.name} ·{" "}
                    {resource.quantity_available} available
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Reason for modification">
            <Input
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setActionError(null);
              }}
              placeholder="What changed and why?"
            />
          </Field>
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}
        </div>
      </Modal>

      <Modal
        open={dialog === "reject"}
        onClose={closeDialog}
        title="Reject suggestion"
        description="No stock will be reserved and no assignment will be created."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reject} loading={busy}>
              Reject suggestion
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Reason for rejection" hint="Required and recorded in the audit trail.">
            <Input
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setActionError(null);
              }}
              placeholder="Why should this suggestion not proceed?"
              autoFocus
            />
          </Field>
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}
        </div>
      </Modal>
    </div>
  );
}
