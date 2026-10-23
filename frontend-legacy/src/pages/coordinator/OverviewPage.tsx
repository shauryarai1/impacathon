import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Inbox,
  KeyRound,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useApiQuery } from "../../lib/query";
import { useAccessDialog } from "../../lib/access";
import type { Report, Urgency } from "../../types";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  UrgencyBadge,
  buttonStyles,
} from "../../components/ui";
import {
  formatAction,
  formatCategory,
  formatNumber,
  formatRelativeTime,
} from "../../lib/format";

const urgencyRank: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-faint">{hint}</p>
    </Card>
  );
}

export function OverviewPage() {
  const { api, hasCoordinator } = useAuth();
  const { openAccess } = useAccessDialog();

  const metrics = useApiQuery(() => api.dashboard.metrics(), [api]);
  const reports = useApiQuery(() => api.reports.list({ limit: 100 }), [api]);
  const proposals = useApiQuery(() => api.matches.list("proposed"), [api]);
  const activity = useApiQuery(
    () => api.audit.list({ limit: 6 }),
    [api, hasCoordinator],
    { enabled: hasCoordinator },
  );

  const allReports = reports.data ?? [];
  const activeRequests = reports.data
    ? allReports.filter((report) => report.status !== "rejected").length
    : (metrics.data?.total_requests ?? 0);

  const awaitingApproval = proposals.data
    ? proposals.data.length
    : (metrics.data?.proposed_matches ?? 0);

  const attention = allReports
    .filter(
      (report) =>
        report.status === "pending_verification" ||
        report.status === "clarification_requested",
    )
    .sort(
      (left: Report, right: Report) =>
        urgencyRank[left.urgency] - urgencyRank[right.urgency] ||
        new Date(left.created_at).getTime() -
          new Date(right.created_at).getTime(),
    )
    .slice(0, 5);

  const anyError = metrics.error || reports.error || proposals.error;

  return (
    <div>
      <PageHeader
        eyebrow="Coordination console"
        title="Overview"
        description="What needs attention right now. Every allocation still requires a human decision."
        actions={
          <Link to="/coordinator/requests" className={buttonStyles("primary", "md")}>
            View requests
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {anyError ? (
        <div className="mb-5">
          <Card>
            <ErrorState
              error={anyError}
              onRetry={() => {
                metrics.reload();
                reports.reload();
                proposals.reload();
              }}
            />
          </Card>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active requests"
          value={metrics.loading && !reports.data ? "—" : formatNumber(activeRequests)}
          hint={`${formatNumber(metrics.data?.pending_verification ?? 0)} pending verification`}
        />
        <Metric
          label="Awaiting approval"
          value={awaitingApproval ? formatNumber(awaitingApproval) : "0"}
          hint={
            awaitingApproval
              ? "Suggested matches need a decision"
              : "No suggestions waiting"
          }
        />
        <Metric
          label="Available resources"
          value={formatNumber(metrics.data?.available_inventory_units ?? 0)}
          hint={`${formatNumber(metrics.data?.reserved_inventory_units ?? 0)} units reserved`}
        />
        <Metric
          label="Completed deliveries"
          value={formatNumber(metrics.data?.completed_deliveries ?? 0)}
          hint={`${formatNumber(metrics.data?.delivery_completion_rate ?? 0)}% completion rate`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-medium text-white">
                Requests needing attention
              </h2>
              <p className="mt-1 text-xs text-faint">
                Pending verification or clarification.
              </p>
            </div>
            {attention.length > 0 ? (
              <span className="text-xs text-faint">{attention.length} shown</span>
            ) : null}
          </div>

          {reports.loading && !reports.data ? (
            <LoadingState label="Loading requests…" />
          ) : reports.error ? (
            <ErrorState error={reports.error} onRetry={reports.reload} />
          ) : attention.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-4 w-4" />}
              title="Nothing needs attention"
              description="All submitted requests have a coordinator decision."
            />
          ) : (
            <div className="divide-y divide-line">
              {attention.map((report) => (
                <Link
                  key={report.id}
                  to={`/coordinator/requests?request=${report.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        Request #{report.id}
                      </span>
                      <UrgencyBadge urgency={report.urgency} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {formatCategory(report.category)} · {report.quantity} units ·{" "}
                      {report.location}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={report.status} />
                    <ArrowRight className="hidden h-4 w-4 text-faint sm:block" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {attention.length > 0 ? (
            <div className="border-t border-line px-5 py-3">
              <Link
                to="/coordinator/requests"
                className="text-xs text-muted transition-colors hover:text-white"
              >
                Open all requests →
              </Link>
            </div>
          ) : null}
        </Card>

        <Card>
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-medium text-white">Recent activity</h2>
            <p className="mt-1 text-xs text-faint">
              Human decisions and coordination changes.
            </p>
          </div>

          {!hasCoordinator ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-line text-faint">
                <KeyRound className="h-4 w-4" />
              </div>
              <p className="mt-4 text-sm font-medium text-white">
                Demo access required
              </p>
              <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-muted">
                The audit trail is visible to coordinators. Public data remains
                available without it.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={openAccess}
              >
                Add demo access
              </Button>
            </div>
          ) : activity.loading && !activity.data ? (
            <LoadingState label="Loading activity…" />
          ) : activity.error ? (
            <ErrorState error={activity.error} onRetry={activity.reload} />
          ) : !activity.data?.length ? (
            <EmptyState
              icon={<Clock3 className="h-4 w-4" />}
              title="No activity yet"
              description="Coordinator decisions will appear here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {activity.data.map((entry) => (
                <li key={entry.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-white">{formatAction(entry.action)}</p>
                    <span className="shrink-0 text-[11px] text-faint">
                      {formatRelativeTime(entry.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {entry.actor_name}
                    {entry.entity_id ? ` · #${entry.entity_id}` : ""}
                  </p>
                  {entry.reason ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-faint">
                      {entry.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {metrics.data?.shortages || metrics.data?.blocked_routes ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 text-xs leading-5 text-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            {formatNumber(metrics.data?.shortages ?? 0)} open shortage
            {metrics.data?.shortages === 1 ? "" : "s"} and{" "}
            {formatNumber(metrics.data?.blocked_routes ?? 0)} blocked route
            {metrics.data?.blocked_routes === 1 ? "" : "s"}. Replenishment and
            replanning are available in Operations.
          </p>
        </div>
      ) : null}
    </div>
  );
}
