import { useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  PackageCheck,
  Truck,
} from "lucide-react";
import type { ApiAssignment, AssignmentStatus } from "../api/types";
import { api } from "../api/client";
import { useApiData } from "../lib/useApi";
import { hasVolunteerAccess } from "../lib/auth";
import {
  deliveryStatusLabel,
  displayId,
  nextAssignmentStatuses,
} from "../lib/format";
import { formatLocalDateTime, formatRelativeTime } from "../lib/time";
import {
  ConfirmDialog,
  EmptyState,
  Notice,
  PageHeader,
  StatusBadge,
  Surface,
} from "../components/UI";

interface DeliveryDialog {
  assignment: ApiAssignment;
  target: AssignmentStatus;
}

export default function Deliveries() {
  const deliveries = useApiData(() => api.listAssignments(), []);
  const volunteerReady = hasVolunteerAccess();

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<DeliveryDialog | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const updateStatus = async (
    assignment: ApiAssignment,
    target: AssignmentStatus,
    noteValue?: string,
  ) => {
    if (!volunteerReady) {
      setError(
        "Volunteer credentials are required. Log out and add a volunteer key on the coordinator login screen.",
      );
      return;
    }

    setBusy(true);
    setError("");
    setDialogError("");
    try {
      const payload =
        target === "failed"
          ? { status: target, failure_reason: noteValue?.trim() }
          : target === "cancelled"
            ? { status: target, note: noteValue?.trim() }
            : target === "delivered"
              ? { status: target, note: noteValue?.trim() || undefined }
              : { status: target };

      const updated = await api.updateAssignmentStatus(assignment.id, payload);
      if (deliveries.data) {
        deliveries.setData(
          deliveries.data.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        );
      }
      deliveries.reload();
      setNotice(
        `${displayId("DEL", updated.id)} is now ${deliveryStatusLabel(updated.status)}.`,
      );
      setDialog(null);
      setNote("");
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "The delivery update could not be saved.";
      if (dialog) setDialogError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = (
    assignment: ApiAssignment,
    target: AssignmentStatus,
  ) => {
    if (target === assignment.status) return;
    if (!volunteerReady) {
      setError(
        "Volunteer credentials are required. Log out and add a volunteer key on the coordinator login screen.",
      );
      return;
    }
    if (target === "failed" || target === "cancelled" || target === "delivered") {
      setDialog({ assignment, target });
      setNote("");
      setDialogError("");
      return;
    }
    void updateStatus(assignment, target);
  };

  const confirmDialog = async () => {
    if (!dialog) return;
    if (
      (dialog.target === "failed" || dialog.target === "cancelled") &&
      note.trim().length < 3
    ) {
      setDialogError("A reason of at least 3 characters is required.");
      return;
    }
    await updateStatus(dialog.assignment, dialog.target, note);
  };

  const assignments = deliveries.data ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coordinator / Deliveries"
        title="Keep every handoff visible."
        description="Volunteers update the delivery status as supplies move from an approved match to a destination."
      />

      {notice && (
        <div className="ops-notice">
          <Check size={15} /> {notice}
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <Notice tone={volunteerReady ? "info" : "warning"}>
        {volunteerReady
          ? "Assignments appear only after coordinator approval. Updates are sent to the Lifeline API."
          : "Volunteer credentials are not configured. Delivery status changes are unavailable until a volunteer key is added."}
      </Notice>

      {deliveries.loading && !deliveries.data ? (
        <Surface>
          <EmptyState
            icon={<LoaderCircle className="spin" size={18} />}
            title="Loading deliveries"
            description="Fetching the latest assignments from the Lifeline API."
          />
        </Surface>
      ) : deliveries.error ? (
        <Surface>
          <EmptyState
            icon={<CircleAlert size={18} />}
            title="Deliveries unavailable"
            description={deliveries.error}
          />
        </Surface>
      ) : assignments.length === 0 ? (
        <Surface>
          <EmptyState
            icon={<Truck size={18} />}
            title="No delivery assignments"
            description="Approved resource allocations will appear here for dispatch and delivery tracking."
          />
        </Surface>
      ) : (
        <Surface className="delivery-surface">
          <div className="table-toolbar">
            <div>
              <span className="table-count">
                {assignments.length} delivery assignments
              </span>
              <span className="table-subtle"> · volunteer updates welcome</span>
            </div>
            <span className="delivery-legend">
              <span>
                <span className="legend-dot legend-dot--green" /> Delivered
              </span>
              <span>
                <span className="legend-dot legend-dot--amber" /> Moving
              </span>
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Destination</th>
                  <th>Resource</th>
                  <th>Volunteer</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((delivery) => {
                  const allowed = [
                    delivery.status,
                    ...nextAssignmentStatuses(delivery.status),
                  ];
                  const terminal = nextAssignmentStatuses(delivery.status).length === 0;
                  return (
                    <tr key={delivery.id}>
                      <td>
                        <strong>{displayId("DEL", delivery.id)}</strong>
                        <span>{displayId("REQ", delivery.report_id)}</span>
                      </td>
                      <td>{delivery.report_location || "—"}</td>
                      <td>
                        {delivery.quantity} units {delivery.resource_name}
                      </td>
                      <td>{delivery.volunteer_name || "Unassigned"}</td>
                      <td>
                        <label className="status-select">
                          <StatusBadge
                            value={deliveryStatusLabel(delivery.status)}
                          />
                          <select
                            aria-label={`Update ${displayId("DEL", delivery.id)} status`}
                            value={delivery.status}
                            onChange={(event) =>
                              handleStatusChange(
                                delivery,
                                event.target.value as AssignmentStatus,
                              )
                            }
                            disabled={!volunteerReady || terminal}
                          >
                            {allowed.map((status) => (
                              <option value={status} key={status}>
                                {deliveryStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={13} />
                        </label>
                      </td>
                      <td title={formatLocalDateTime(delivery.updated_at)}>
                        {formatRelativeTime(delivery.updated_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="delivery-footer">
            <div>
              <Truck size={16} />
              <span>Volunteers can update status from the field.</span>
            </div>
            <div>
              <PackageCheck size={16} />
              <span>Delivery confirmation closes the loop.</span>
            </div>
            <div>
              <CircleAlert size={16} />
              <span>Failed or cancelled deliveries return to replanning.</span>
            </div>
          </div>
        </Surface>
      )}

      <div className="delivery-mobile-note">
        Select a delivery status to update it. Every change is recorded in the
        audit trail.
      </div>

      {dialog && (
        <ConfirmDialog
          eyebrow="Volunteer update"
          title={
            dialog.target === "delivered"
              ? "Confirm delivery"
              : dialog.target === "failed"
                ? "Mark delivery failed"
                : "Cancel assignment"
          }
          description={
            dialog.target === "delivered"
              ? "This confirms the supplies reached their destination and consumes the reservation."
              : dialog.target === "failed"
                ? "The inventory reservation will be released and the assignment flagged for coordinator review."
                : "The inventory reservation will be released and the assignment closed."
          }
          confirmLabel={
            dialog.target === "delivered"
              ? "Confirm delivery"
              : dialog.target === "failed"
                ? "Mark failed"
                : "Cancel assignment"
          }
          onConfirm={confirmDialog}
          onCancel={() => {
            if (!busy) {
              setDialog(null);
              setDialogError("");
            }
          }}
          busy={busy}
        >
          <div className="request-form" style={{ marginTop: 14 }}>
            <label>
              {dialog.target === "delivered"
                ? "Delivery note"
                : "Reason"}
              {dialog.target === "delivered" ? (
                <span className="optional">Optional</span>
              ) : (
                <span className="required">Required</span>
              )}
              <textarea
                rows={3}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setDialogError("");
                }}
                placeholder={
                  dialog.target === "delivered"
                    ? "Who received the delivery?"
                    : "What prevented delivery?"
                }
              />
            </label>
          </div>
          {dialogError && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="error">{dialogError}</Notice>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
