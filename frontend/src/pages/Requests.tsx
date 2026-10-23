import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  ShieldX,
  UserRoundCheck,
} from "lucide-react";
import type { ApiReport } from "../api/types";
import { api } from "../api/client";
import { useApiData } from "../lib/useApi";
import {
  displayId,
  needFromCategory,
  reportWarning,
  requestStatusLabel,
  urgencyLabel,
} from "../lib/format";
import {
  Button,
  EmptyState,
  Notice,
  PageHeader,
  StatusBadge,
  Surface,
} from "../components/UI";
import { formatLocalDateTime, formatRelativeTime } from "../lib/time";

type ReviewAction = "verify" | "clarify" | "reject";

export default function Requests() {
  const reports = useApiData(() => api.listReports({ limit: 100 }), []);
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const sortedRequests = useMemo(
    () =>
      [...(reports.data ?? [])].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [reports.data],
  );

  useEffect(() => {
    if (!sortedRequests.length) {
      setSelectedId(null);
      return;
    }
    const requestedId = Number(searchParams.get("request"));
    if (requestedId && sortedRequests.some((item) => item.id === requestedId)) {
      setSelectedId(requestedId);
      return;
    }
    if (!selectedId || !sortedRequests.some((item) => item.id === selectedId)) {
      setSelectedId(sortedRequests[0].id);
    }
  }, [searchParams, selectedId, sortedRequests]);

  const selected =
    sortedRequests.find((request) => request.id === selectedId) ?? null;

  const resetMessages = () => {
    setNotice("");
    setActionError("");
  };

  const selectRequest = (id: number) => {
    setSelectedId(id);
    setReason("");
    resetMessages();
  };

  const applyUpdate = (updated: ApiReport) => {
    if (reports.data) {
      reports.setData(
        reports.data.map((item) => (item.id === updated.id ? updated : item)),
      );
    }
    reports.reload();
  };

  const act = async (action: ReviewAction) => {
    if (!selected) return;
    if (reason.trim().length < 3) {
      setActionError("Add a short reason of at least 3 characters.");
      return;
    }

    setBusy(action);
    setActionError("");
    setNotice("");
    try {
      const updated =
        action === "verify"
          ? await api.verifyRequest(selected.id, reason.trim())
          : action === "clarify"
            ? await api.clarifyRequest(selected.id, reason.trim())
            : await api.rejectRequest(selected.id, reason.trim());

      applyUpdate(updated);
      setReason("");
      setNotice(
        action === "verify"
          ? "Request verified. It can now move to matching."
          : action === "clarify"
            ? "Clarification requested. The request remains unverified."
            : "Request rejected. No resources will be allocated.",
      );
    } catch (reasonValue) {
      setActionError(
        reasonValue instanceof Error
          ? reasonValue.message
          : "The decision could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  };

  const canDecide =
    selected?.status === "pending_verification" ||
    selected?.status === "clarification_requested";

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coordinator / Requests"
        title="Review incoming needs."
        description="Verify what is real, clear up uncertainty, and keep the next decision obvious."
      />

      {reports.error && (
        <div style={{ display: "grid", gap: 10 }}>
          <Notice tone="error">{reports.error}</Notice>
          <div>
            <Button variant="secondary" size="sm" onClick={reports.reload}>
              <RefreshCw size={14} /> Try again
            </Button>
          </div>
        </div>
      )}

      {reports.loading && !reports.data ? (
        <Surface>
          <EmptyState
            icon={<LoaderCircle className="spin" size={18} />}
            title="Loading requests"
            description="Fetching the latest reports from the Lifeline API."
          />
        </Surface>
      ) : !reports.loading && sortedRequests.length === 0 ? (
        <Surface>
          <EmptyState
            title="No requests yet"
            description="Resident submissions will appear here as soon as they are reported."
          />
        </Surface>
      ) : selected ? (
        <div className="split-view">
          <Surface className="request-table-surface">
            <div className="table-toolbar">
              <div>
                <span className="table-count">
                  {sortedRequests.length} submitted requests
                </span>
                <span className="table-subtle"> · newest first</span>
              </div>
              <button
                className="icon-button"
                aria-label="Refresh requests"
                title="Refresh requests"
                onClick={reports.reload}
                disabled={reports.loading}
              >
                <RefreshCw size={17} />
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Location</th>
                    <th>Need</th>
                    <th>Urgency</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRequests.map((request) => (
                    <tr
                      key={request.id}
                      className={
                        request.id === selected.id ? "table-row--selected" : ""
                      }
                      onClick={() => selectRequest(request.id)}
                    >
                      <td>
                        <strong>{displayId("REQ", request.id)}</strong>
                        <span>{request.reporter_name}</span>
                      </td>
                      <td>{request.location}</td>
                      <td>
                        {needFromCategory(request.category)}
                        <span>{request.quantity} units</span>
                      </td>
                      <td>
                        <StatusBadge value={urgencyLabel(request.urgency)} />
                      </td>
                      <td>
                        <StatusBadge
                          value={requestStatusLabel(request.status)}
                        />
                      </td>
                      <td>
                        <strong>
                          {formatLocalDateTime(request.created_at)}
                        </strong>
                        <span>{formatRelativeTime(request.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
          <Surface className="detail-panel">
            <div className="detail-panel__top">
              <div>
                <p className="eyebrow">Request detail</p>
                <h2>{displayId("REQ", selected.id)}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Refresh request list"
                title="Refresh request list"
                onClick={reports.reload}
                disabled={reports.loading}
              >
                <RefreshCw size={17} />
              </button>
            </div>
            {reportWarning(selected) && (
              <Notice tone="warning">{reportWarning(selected)}</Notice>
            )}
            <div className="detail-hero">
              <span className="detail-need-icon">
                {needFromCategory(selected.category).slice(0, 1)}
              </span>
              <div>
                <h3>
                  {selected.quantity} units of{" "}
                  {needFromCategory(selected.category)}
                </h3>
                <p>{selected.location}</p>
              </div>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Submitted</dt>
                <dd>
                  <strong>{formatLocalDateTime(selected.created_at)}</strong>
                  <small className="detail-relative">
                    {formatRelativeTime(selected.created_at)}
                  </small>
                </dd>
              </div>
              <div>
                <dt>Urgency</dt>
                <dd>
                  <StatusBadge value={urgencyLabel(selected.urgency)} />
                </dd>
              </div>
              <div>
                <dt>Current status</dt>
                <dd>
                  <StatusBadge
                    value={requestStatusLabel(selected.status)}
                  />
                </dd>
              </div>
              <div>
                <dt>Reporter</dt>
                <dd>{selected.reporter_name}</dd>
              </div>
              <div>
                <dt>Context</dt>
                <dd>{selected.description}</dd>
              </div>
            </dl>

            {canDecide ? (
              <div className="detail-actions">
                <p className="eyebrow">Choose the next step</p>
                <div className="request-form" style={{ marginTop: 0 }}>
                  <label>
                    Decision reason<span className="required">Required</span>
                    <textarea
                      rows={3}
                      value={reason}
                      maxLength={2000}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setActionError("");
                      }}
                      placeholder="What did you confirm, or why are you pausing this request?"
                    />
                  </label>
                </div>
                {actionError && <Notice tone="error">{actionError}</Notice>}
                <Button
                  onClick={() => act("verify")}
                  disabled={Boolean(busy)}
                >
                  {busy === "verify" ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <UserRoundCheck size={15} />
                  )}
                  Verify request
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => act("clarify")}
                  disabled={Boolean(busy)}
                >
                  {busy === "clarify" ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <MessageSquare size={15} />
                  )}
                  Request clarification
                </Button>
                <Button
                  variant="danger"
                  onClick={() => act("reject")}
                  disabled={Boolean(busy)}
                >
                  {busy === "reject" ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <ShieldX size={15} />
                  )}
                  Reject request
                </Button>
              </div>
            ) : (
              <Notice
                tone={
                  selected.status === "verified" ? "success" : "warning"
                }
              >
                {selected.status === "verified"
                  ? "This request is verified and may proceed to matching."
                  : selected.status === "rejected"
                    ? "This request was rejected. No resources will be allocated."
                    : "This request needs information before it can be verified."}
              </Notice>
            )}
            {notice && (
              <div className="action-feedback">
                <Check size={15} />
                {notice}
              </div>
            )}
            <div className="detail-footer">
              <CircleAlert size={15} />
              <span>
                Every decision is recorded with your coordinator name, reason,
                and timestamp in the audit trail.
              </span>
            </div>
          </Surface>
        </div>
      ) : null}
      <div className="mobile-back-note">
        <ArrowLeft size={14} /> Select a row to review details.
      </div>
    </div>
  );
}
