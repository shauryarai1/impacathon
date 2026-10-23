import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useApiQuery } from "../../lib/query";
import { useAccessDialog } from "../../lib/access";
import type { Report, ReportReview } from "../../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  PageHeader,
  StatusBadge,
  TableShell,
  Textarea,
  UrgencyBadge,
} from "../../components/ui";
import { Modal } from "../../components/Modal";
import { formatCategory, formatDateTime } from "../../lib/format";

type ReportAction = "verify" | "reject" | "clarify";

export function RequestsPage() {
  const { api, hasCoordinator } = useAuth();
  const { openAccess } = useAccessDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get("request")) || null;

  const reports = useApiQuery(() => api.reports.list({ limit: 100 }), [api]);
  const reviews = useApiQuery<ReportReview[]>(
    () =>
      selectedId === null
        ? Promise.resolve([])
        : api.reports.reviews(selectedId),
    [api, selectedId],
    { enabled: selectedId !== null },
  );

  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState<ReportAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedReport = reports.data?.find((report) => report.id === selectedId);

  useEffect(() => {
    setReason("");
    setActionError(null);
    setNotice(null);
  }, [selectedId]);

  const openRequest = (id: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("request", String(id));
    setSearchParams(next);
  };

  const closeRequest = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("request");
    setSearchParams(next, { replace: true });
  };

  const applyUpdate = (updated: Report) => {
    if (reports.data) {
      reports.setData(
        reports.data.map((report) =>
          report.id === updated.id ? updated : report,
        ),
      );
    }
    reports.reload();
    reviews.reload();
  };

  const act = async (action: ReportAction) => {
    if (!selectedReport) return;
    if (!hasCoordinator) {
      openAccess();
      return;
    }
    if (reason.trim().length < 3) {
      setActionError("Add a short reason of at least 3 characters.");
      return;
    }

    setBusyAction(action);
    setActionError(null);
    setNotice(null);

    try {
      const updated =
        action === "verify"
          ? await api.reports.verify(selectedReport.id, reason.trim())
          : action === "reject"
            ? await api.reports.reject(selectedReport.id, reason.trim())
            : await api.reports.requestClarification(
                selectedReport.id,
                reason.trim(),
              );

      applyUpdate(updated);
      setReason("");
      setNotice(
        action === "verify"
          ? "Request verified. It can now be considered for matching."
          : action === "reject"
            ? "Request rejected. No resources will be allocated."
            : "Clarification requested. The request remains unverified.",
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The decision could not be saved.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const canDecide =
    selectedReport?.status === "pending_verification" ||
    selectedReport?.status === "clarification_requested";

  return (
    <div>
      <PageHeader
        eyebrow="Human verification"
        title="Requests"
        description="Review disaster needs and hazards before any resource allocation begins."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={reports.reload}
            disabled={reports.loading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <Card>
        {reports.loading && !reports.data ? (
          <LoadingState label="Loading requests…" />
        ) : reports.error ? (
          <ErrorState error={reports.error} onRetry={reports.reload} />
        ) : !reports.data?.length ? (
          <EmptyState
            title="No requests yet"
            description="Resident requests submitted from the public form will appear here."
          />
        ) : (
          <TableShell className="border-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-faint">
                  <th className="px-5 py-3 font-medium">Request</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Need</th>
                  <th className="px-5 py-3 font-medium">Urgency</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.data.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => openRequest(report.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRequest(report.id);
                      }
                    }}
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">#{report.id}</p>
                      <p className="mt-0.5 text-xs text-faint">
                        {report.reporter_name}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-muted">{report.location}</td>
                    <td className="px-5 py-4 text-muted">
                      {formatCategory(report.category)} · {report.quantity}
                    </td>
                    <td className="px-5 py-4">
                      <UrgencyBadge urgency={report.urgency} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={report.status} />
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
        onClose={closeRequest}
        title={selectedReport ? `Request #${selectedReport.id}` : "Request"}
        description={
          selectedReport
            ? `Submitted by ${selectedReport.reporter_name} · ${formatDateTime(selectedReport.created_at)}`
            : "Loading request details."
        }
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={closeRequest}>
              Close
            </Button>
          </div>
        }
      >
        {!selectedReport ? (
          reports.loading ? (
            <LoadingState label="Loading request…" />
          ) : (
            <EmptyState
              title="Request not found"
              description="It may have been removed or the link is incorrect."
            />
          )
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selectedReport.status} />
              <UrgencyBadge urgency={selectedReport.urgency} />
              <span className="rounded-full border border-line bg-white/[0.04] px-2.5 py-1 text-[11px] text-muted">
                {formatCategory(selectedReport.category)}
              </span>
            </div>

            <div>
              <p className="text-sm leading-6 text-neutral-200">
                {selectedReport.description}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-[#0F0F0F] p-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-faint">Quantity</dt>
                <dd className="mt-1 text-white">{selectedReport.quantity}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Location</dt>
                <dd className="mt-1 text-white">{selectedReport.location}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Type</dt>
                <dd className="mt-1 capitalize text-white">{selectedReport.type}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Reporter</dt>
                <dd className="mt-1 text-white">{selectedReport.reporter_name}</dd>
              </div>
            </dl>

            {selectedReport.review_flags.length > 0 ||
            selectedReport.duplicate_of_report_id ? (
              <div className="rounded-lg border border-warning/25 bg-warning/[0.06] p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-medium text-warning">
                      Review before verifying
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-warning/90">
                      {selectedReport.duplicate_of_report_id ? (
                        <li>
                          Possible duplicate of request #
                          {selectedReport.duplicate_of_report_id}
                          {selectedReport.duplicate_score
                            ? ` · ${Math.round(selectedReport.duplicate_score * 100)}% similar`
                            : ""}
                        </li>
                      ) : null}
                      {selectedReport.review_flags.map((flag) => (
                        <li key={flag}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            {selectedReport.verification_reason ? (
              <div className="rounded-lg border border-line bg-[#0F0F0F] p-4">
                <p className="text-xs text-faint">Coordinator decision</p>
                <p className="mt-1.5 text-sm leading-6 text-neutral-200">
                  {selectedReport.verification_reason}
                </p>
                <p className="mt-2 text-xs text-faint">
                  {formatDateTime(selectedReport.verified_at)}
                </p>
              </div>
            ) : null}

            {canDecide ? (
              <div className="rounded-lg border border-line bg-[#141414] p-4">
                {!hasCoordinator ? (
                  <div className="mb-4 flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning/[0.06] p-3 text-xs leading-5 text-warning sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Coordinator access is required to verify, reject, or ask
                      for clarification.
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={openAccess}
                    >
                      Add demo access
                    </Button>
                  </div>
                ) : null}

                <Field
                  label="Decision reason"
                  hint="This is recorded in the audit trail."
                >
                  <Textarea
                    rows={3}
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setActionError(null);
                    }}
                    placeholder="What did you confirm, or why are you rejecting or requesting clarification?"
                    disabled={!hasCoordinator}
                  />
                </Field>

                {actionError ? (
                  <p className="mt-2 text-xs text-danger">{actionError}</p>
                ) : null}
                {notice ? (
                  <div className="mt-3">
                    <Notice tone="success">{notice}</Notice>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => act("verify")}
                    loading={busyAction === "verify"}
                    disabled={!hasCoordinator || Boolean(busyAction)}
                  >
                    Verify request
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => act("clarify")}
                    loading={busyAction === "clarify"}
                    disabled={!hasCoordinator || Boolean(busyAction)}
                  >
                    Request clarification
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => act("reject")}
                    loading={busyAction === "reject"}
                    disabled={!hasCoordinator || Boolean(busyAction)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : notice ? (
              <Notice tone="success">{notice}</Notice>
            ) : null}

            <div>
              <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-faint">
                Review history
              </h3>
              {reviews.loading && !reviews.data ? (
                <p className="mt-3 text-sm text-muted">Loading history…</p>
              ) : reviews.error ? (
                <p className="mt-3 text-sm text-danger">
                  {reviews.error.message}
                </p>
              ) : !reviews.data?.length ? (
                <p className="mt-3 text-sm text-muted">No decisions recorded yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
                  {reviews.data.map((review) => (
                    <li key={review.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <StatusBadge status={review.decision} />
                        <span className="text-xs text-faint">
                          {formatDateTime(review.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-neutral-200">
                        {review.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
