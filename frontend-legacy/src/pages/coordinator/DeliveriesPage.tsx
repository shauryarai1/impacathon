import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useApiQuery } from "../../lib/query";
import { useAccessDialog } from "../../lib/access";
import type { Assignment, AssignmentStatus } from "../../types";
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
  PageHeader,
  StatusBadge,
  TableShell,
} from "../../components/ui";
import { Modal } from "../../components/Modal";
import {
  assignmentTransitions,
  formatCategory,
  formatDateTime,
  formatRelativeTime,
  formatStatus,
} from "../../lib/format";

type PendingDialog = "delivered" | "failed" | "cancelled" | null;

function inventoryLabel(assignment: Assignment): string {
  if (assignment.inventory_consumed) return "Consumed";
  if (assignment.inventory_released) return "Released";
  return "Reserved";
}

export function DeliveriesPage() {
  const { api, hasVolunteer } = useAuth();
  const { openAccess } = useAccessDialog();

  const assignments = useApiQuery(() => api.assignments.list(), [api]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const selected = assignments.data?.find(
    (assignment) => assignment.id === selectedId,
  );

  useEffect(() => {
    setNote("");
    setActionError(null);
  }, [selectedId, dialog]);

  const applyUpdate = (updated: Assignment) => {
    if (assignments.data) {
      assignments.setData(
        assignments.data.map((assignment) =>
          assignment.id === updated.id ? updated : assignment,
        ),
      );
    }
    assignments.reload();
  };

  const updateStatus = async (
    status: AssignmentStatus,
    noteValue?: string,
  ) => {
    if (!selected) return;
    if (!hasVolunteer) {
      openAccess();
      return;
    }

    setBusy(status);
    setActionError(null);
    try {
      const payload =
        status === "failed"
          ? { status, failure_reason: noteValue?.trim() }
          : status === "cancelled"
            ? { status, note: noteValue?.trim() }
            : status === "delivered"
              ? { status, note: noteValue?.trim() || undefined }
              : { status };

      const updated = await api.assignments.updateStatus(selected.id, payload);
      applyUpdate(updated);
      setNotice({
        tone: "success",
        text: `Assignment #${updated.id} is now ${formatStatus(
          updated.status,
        ).toLowerCase()}.`,
      });
      setDialog(null);
      setNote("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The delivery update could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  };

  const openDialog = (status: "delivered" | "failed" | "cancelled") => {
    if (!hasVolunteer) {
      openAccess();
      return;
    }
    setDialog(status);
    setNote("");
    setActionError(null);
  };

  const submitDialog = async () => {
    if (!dialog) return;
    if (
      (dialog === "failed" || dialog === "cancelled") &&
      note.trim().length < 3
    ) {
      setActionError("A reason of at least 3 characters is required.");
      return;
    }
    await updateStatus(dialog, note);
  };

  const allAssignments = assignments.data ?? [];
  const nextStatuses = selected
    ? assignmentTransitions[selected.status]
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Volunteer operations"
        title="Deliveries"
        description="Assignments exist only after coordinator approval. Update progress here as supplies move."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={assignments.reload}
            disabled={assignments.loading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {notice ? (
        <div className="mb-4">
          <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        </div>
      ) : null}

      <Card>
        {assignments.loading && !assignments.data ? (
          <LoadingState label="Loading deliveries…" />
        ) : assignments.error ? (
          <ErrorState error={assignments.error} onRetry={assignments.reload} />
        ) : allAssignments.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-4 w-4" />}
            title="No delivery assignments"
            description="Approved resource matches become delivery assignments and appear here."
          />
        ) : (
          <TableShell className="border-0">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-faint">
                  <th className="px-5 py-3 font-medium">Assignment</th>
                  <th className="px-5 py-3 font-medium">Destination</th>
                  <th className="px-5 py-3 font-medium">Resource</th>
                  <th className="px-5 py-3 text-right font-medium">Quantity</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allAssignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    onClick={() => setSelectedId(assignment.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(assignment.id);
                      }
                    }}
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">#{assignment.id}</p>
                      <p className="mt-0.5 text-xs text-faint">
                        Request #{assignment.report_id}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {assignment.report_location || "—"}
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {assignment.resource_name || "—"}
                    </td>
                    <td className="px-5 py-4 text-right text-white">
                      {assignment.quantity}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={assignment.status} />
                    </td>
                    <td className="px-5 py-4 text-muted">
                      {formatRelativeTime(assignment.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Card>

      <Modal
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `Assignment #${selected.id}` : "Assignment"}
        description={
          selected
            ? `Request #${selected.report_id} · ${formatCategory(selected.report_category)}`
            : "Loading assignment."
        }
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setSelectedId(null)}>
              Close
            </Button>
          </div>
        }
      >
        {!selected ? (
          <LoadingState label="Loading assignment…" />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <Badge
                tone={
                  selected.inventory_consumed
                    ? "success"
                    : selected.inventory_released
                      ? "neutral"
                      : "warning"
                }
              >
                Inventory {inventoryLabel(selected).toLowerCase()}
              </Badge>
              {selected.needs_review ? (
                <Badge tone="warning">
                  <AlertTriangle className="h-3 w-3" />
                  Needs review
                </Badge>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-[#0F0F0F] p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-faint">Destination</p>
                <p className="mt-1 text-white">{selected.report_location || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-faint">Resource</p>
                <p className="mt-1 text-white">{selected.resource_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-faint">Quantity</p>
                <p className="mt-1 text-white">{selected.quantity} units</p>
              </div>
              <div>
                <p className="text-xs text-faint">Supplier</p>
                <p className="mt-1 text-white">{selected.supplier_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-faint">Approved by</p>
                <p className="mt-1 text-white">
                  {selected.coordinator_name || `Coordinator #${selected.created_by_id}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-faint">Volunteer</p>
                <p className="mt-1 text-white">
                  {selected.volunteer_name || "Not updated yet"}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4 border-b border-line pb-2">
                <span className="text-faint">Approval reason</span>
                <span className="max-w-md text-right text-neutral-200">
                  {selected.approval_reason}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-line pb-2">
                <span className="text-faint">Created</span>
                <span className="text-neutral-200">
                  {formatDateTime(selected.created_at)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-line pb-2">
                <span className="text-faint">Dispatched</span>
                <span className="text-neutral-200">
                  {formatDateTime(selected.dispatched_at)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-faint">Delivered</span>
                <span className="text-neutral-200">
                  {formatDateTime(selected.delivered_at)}
                </span>
              </div>
            </div>

            {selected.confirmation_note ? (
              <Notice tone="success">
                <span className="font-medium">Delivery confirmation</span>
                <br />
                {selected.confirmation_note}
              </Notice>
            ) : null}

            {selected.failure_reason ? (
              <Notice tone="error">
                <span className="font-medium">Failure or cancellation reason</span>
                <br />
                {selected.failure_reason}
              </Notice>
            ) : null}

            {selected.review_reason && selected.needs_review ? (
              <Notice tone="warning">{selected.review_reason}</Notice>
            ) : null}

            {nextStatuses.length === 0 ? (
              <div className="rounded-lg border border-line bg-[#0F0F0F] px-4 py-3 text-sm text-muted">
                This assignment is complete. No further delivery updates are
                allowed.
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-[#141414] p-4">
                <h3 className="text-sm font-medium text-white">Update delivery</h3>
                {!hasVolunteer ? (
                  <div className="mt-3 flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning/[0.06] p-3 text-xs leading-5 text-warning sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-start gap-2">
                      <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Volunteer access is required to update delivery status.
                    </span>
                    <Button variant="secondary" size="sm" onClick={openAccess}>
                      Add demo access
                    </Button>
                  </div>
                ) : null}

                {actionError ? (
                  <div className="mt-3">
                    <Notice tone="error">{actionError}</Notice>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {nextStatuses.includes("dispatched") ? (
                    <Button
                      onClick={() => updateStatus("dispatched")}
                      loading={busy === "dispatched"}
                      disabled={!hasVolunteer || Boolean(busy)}
                    >
                      <Truck className="h-4 w-4" />
                      Mark dispatched
                    </Button>
                  ) : null}
                  {nextStatuses.includes("in_transit") ? (
                    <Button
                      onClick={() => updateStatus("in_transit")}
                      loading={busy === "in_transit"}
                      disabled={!hasVolunteer || Boolean(busy)}
                    >
                      Mark in transit
                    </Button>
                  ) : null}
                  {nextStatuses.includes("delivered") ? (
                    <Button
                      onClick={() => openDialog("delivered")}
                      disabled={!hasVolunteer || Boolean(busy)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark delivered
                    </Button>
                  ) : null}
                  {nextStatuses.includes("failed") ? (
                    <Button
                      variant="danger"
                      onClick={() => openDialog("failed")}
                      disabled={!hasVolunteer || Boolean(busy)}
                    >
                      Mark failed
                    </Button>
                  ) : null}
                  {nextStatuses.includes("cancelled") ? (
                    <Button
                      variant="danger"
                      onClick={() => openDialog("cancelled")}
                      disabled={!hasVolunteer || Boolean(busy)}
                    >
                      Cancel assignment
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={dialog !== null}
        onClose={() => {
          if (!busy) setDialog(null);
        }}
        title={
          dialog === "delivered"
            ? "Confirm delivery"
            : dialog === "failed"
              ? "Mark delivery failed"
              : "Cancel assignment"
        }
        description={
          dialog === "delivered"
            ? "This confirms the supplies reached their destination."
            : dialog === "failed"
              ? "The reservation will be released and the assignment will need coordinator attention."
              : "The reservation will be released and the assignment will close."
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setDialog(null)}
              disabled={Boolean(busy)}
            >
              Back
            </Button>
            <Button
              variant={dialog === "delivered" ? "primary" : "danger"}
              onClick={submitDialog}
              loading={Boolean(busy)}
            >
              {dialog === "delivered"
                ? "Confirm delivery"
                : dialog === "failed"
                  ? "Mark failed"
                  : "Cancel assignment"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field
            label={
              dialog === "delivered"
                ? "Delivery note"
                : dialog === "failed"
                  ? "Failure reason"
                  : "Cancellation reason"
            }
            hint={
              dialog === "delivered"
                ? "Optional. Include who received the delivery."
                : "Required. This is recorded in the audit trail."
            }
          >
            <Input
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setActionError(null);
              }}
              placeholder={
                dialog === "delivered"
                  ? "Received by shelter lead"
                  : "What prevented delivery?"
              }
              autoFocus
            />
          </Field>
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}
        </div>
      </Modal>
    </div>
  );
}
