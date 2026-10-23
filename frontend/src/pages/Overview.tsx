import {
  ArrowRight,
  ChevronRight,
  Clock3,
  FileWarning,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ApiReport, ApiUrgency } from "../api/types";
import { api } from "../api/client";
import { useApiData } from "../lib/useApi";
import {
  displayId,
  humanizeAction,
  needFromCategory,
  urgencyLabel,
} from "../lib/format";
import { formatRelativeTime } from "../lib/time";
import {
  Button,
  EmptyState,
  MetricCard,
  Notice,
  PageHeader,
  SectionHeading,
  StatusBadge,
  Surface,
} from "../components/UI";

const urgencyRank: Record<ApiUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function Overview() {
  const metrics = useApiData(() => api.getDashboardMetrics(), []);
  const reports = useApiData(() => api.listReports({ limit: 100 }), []);
  const matches = useApiData(() => api.listMatches("proposed"), []);
  const audit = useApiData(() => api.listAuditLogs({ limit: 4 }), []);

  const activeRequests = reports.data
    ? reports.data.filter((request) => request.status !== "rejected").length
    : (metrics.data?.total_requests ?? 0);

  const awaitingApproval = matches.data
    ? matches.data.length
    : (metrics.data?.proposed_matches ?? 0);

  const attention = [...(reports.data ?? [])]
    .filter(
      (request) =>
        request.status === "pending_verification" ||
        request.status === "clarification_requested",
    )
    .sort(
      (left: ApiReport, right: ApiReport) =>
        urgencyRank[left.urgency] - urgencyRank[right.urgency] ||
        new Date(left.created_at).getTime() -
          new Date(right.created_at).getTime(),
    )
    .slice(0, 3);

  const firstError =
    metrics.error || reports.error || matches.error || audit.error;

  const reloadAll = () => {
    metrics.reload();
    reports.reload();
    matches.reload();
    audit.reload();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Coordinator overview"
        title="See what needs attention."
        description="A calm view of the requests, resources, and decisions that keep relief moving."
        action={
          <Link className="button button--primary" to="/coordinator/requests">
            View requests <ArrowRight size={16} />
          </Link>
        }
      />

      {firstError ? (
        <div style={{ display: "grid", gap: 10 }}>
          <Notice tone="error">{firstError}</Notice>
          <div>
            <Button variant="secondary" size="sm" onClick={reloadAll}>
              Try again
            </Button>
          </div>
        </div>
      ) : (
        <div className="demo-banner">
          <span>
            <span className="demo-pulse" /> LIVE API
          </span>
          <p>
            Connected to the Lifeline backend. Every allocation still requires
            explicit human approval.
          </p>
        </div>
      )}

      <div className="metric-grid">
        <MetricCard
          label="Active requests"
          value={metrics.loading && !reports.data ? "—" : activeRequests}
          note="Needs a decision or delivery"
          accent
        />
        <MetricCard
          label="Awaiting approval"
          value={metrics.loading && !matches.data ? "—" : awaitingApproval}
          note="Human review required"
        />
        <MetricCard
          label="Available resources"
          value={
            metrics.data
              ? metrics.data.available_inventory_units.toLocaleString()
              : "—"
          }
          note="Units across recorded suppliers"
        />
        <MetricCard
          label="Completed deliveries"
          value={metrics.data?.completed_deliveries ?? "—"}
          note={`${metrics.data?.delivery_completion_rate ?? 0}% completion rate`}
        />
      </div>

      <div className="overview-grid">
        <Surface>
          <SectionHeading
            title="Requests needing attention"
            description="Start with the clearest next decision."
            action={
              <Link className="text-link" to="/coordinator/requests">
                All requests <ArrowRight size={14} />
              </Link>
            }
          />
          {reports.loading && !reports.data ? (
            <div className="empty-inline">Loading requests…</div>
          ) : attention.length === 0 ? (
            <div className="empty-inline">
              No requests are waiting for coordinator review.
            </div>
          ) : (
            <div className="attention-list">
              {attention.map((request) => (
                <Link
                  to={`/coordinator/requests?request=${request.id}`}
                  key={request.id}
                  className="attention-row"
                >
                  <span
                    className={`attention-icon attention-icon--${urgencyLabel(request.urgency).toLowerCase()}`}
                  >
                    {request.urgency === "critical" ? (
                      <ShieldAlert size={17} />
                    ) : (
                      <FileWarning size={17} />
                    )}
                  </span>
                  <span className="attention-copy">
                    <strong>
                      {displayId("REQ", request.id)} ·{" "}
                      {needFromCategory(request.category)}
                    </strong>
                    <small>
                      {request.location} · {request.quantity} units
                    </small>
                  </span>
                  <StatusBadge value={urgencyLabel(request.urgency)} />
                  <ChevronRight size={16} className="row-chevron" />
                </Link>
              ))}
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeading
            title="Recent activity"
            description="A short audit trail of what changed."
            action={
              <Link className="text-link" to="/coordinator/operations">
                Open operations <ArrowRight size={14} />
              </Link>
            }
          />
          {audit.loading && !audit.data ? (
            <div className="empty-inline">Loading recent activity…</div>
          ) : audit.error ? (
            <EmptyState
              title="Activity unavailable"
              description={audit.error}
            />
          ) : !audit.data?.length ? (
            <div className="empty-inline">No decisions recorded yet.</div>
          ) : (
            <div className="activity-list">
              {audit.data.slice(0, 3).map((event) => (
                <div className="activity-row" key={event.id}>
                  <span className="activity-icon">
                    <Clock3 size={15} />
                  </span>
                  <span>
                    <strong>{humanizeAction(event.action)}</strong>
                    <small>
                      {event.actor_name}
                      {event.entity_id ? ` · #${event.entity_id}` : ""}
                      {event.reason ? ` · ${event.reason}` : ""}
                    </small>
                  </span>
                  <time>{formatRelativeTime(event.created_at)}</time>
                </div>
              ))}
            </div>
          )}
          <div className="activity-footer">
            <PackageCheck size={15} /> Every approval and delivery update is
            recorded.
          </div>
        </Surface>
      </div>
    </div>
  );
}
