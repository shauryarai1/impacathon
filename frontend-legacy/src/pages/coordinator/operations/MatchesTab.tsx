import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
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
  LoadingState,
  Notice,
  StatusBadge,
  UrgencyBadge,
} from "../../../components/ui";
import { formatCategory, formatNumber } from "../../../lib/format";

function routeSummary(
  recommendation: Recommendation,
  route: Route | undefined,
): { label: string; tone: "success" | "warning" | "danger" } {
  if (recommendation.route_id === null) {
    return { label: "Same area", tone: "success" };
  }
  if (!route) {
    return { label: "Route unavailable", tone: "warning" };
  }
  if (route.blocked) {
    return { label: "Blocked", tone: "danger" };
  }
  return { label: `Open · cost ${route.travel_cost}`, tone: "success" };
}

export function MatchesTab({ onOpenApproval }: { onOpenApproval: () => void }) {
  const { api, hasCoordinator } = useAuth();
  const { openAccess } = useAccessDialog();

  const matches = useApiQuery(() => api.matches.list("proposed"), [api]);
  const shortages = useApiQuery(() => api.shortages.list("open"), [api]);
  const routes = useApiQuery(() => api.routes.list(), [api]);
  const resources = useApiQuery(() => api.resources.list(), [api]);

  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const routeMap = useMemo(
    () => new Map((routes.data ?? []).map((route) => [route.id, route])),
    [routes.data],
  );
  const resourceMap = useMemo(
    () => new Map((resources.data ?? []).map((resource) => [resource.id, resource])),
    [resources.data],
  );

  const generate = async () => {
    if (!hasCoordinator) {
      openAccess();
      return;
    }
    setGenerating(true);
    setNotice(null);
    try {
      const result = await api.matches.generate({ replace_proposed: true });
      setNotice({
        tone: "success",
        text: `Generated ${result.generated_count} suggestion${
          result.generated_count === 1 ? "" : "s"
        } and superseded ${result.superseded_count}. No stock was reserved. Every suggestion still needs human approval.`,
      });
      matches.reload();
      shortages.reload();
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "New suggestions could not be generated.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const proposals = matches.data ?? [];
  const openShortages = shortages.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          Suggestions are deterministic and explainable. They never reserve
          stock, create an assignment, or dispatch supplies.
        </p>
        <Button onClick={generate} loading={generating}>
          <Sparkles className="h-4 w-4" />
          Generate suggestions
        </Button>
      </div>

      {!hasCoordinator ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning/[0.06] p-4 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <span>
            Coordinator access is required to run matching.
          </span>
          <Button variant="secondary" size="sm" onClick={openAccess}>
            Add demo access
          </Button>
        </div>
      ) : null}

      {notice ? (
        <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      {matches.loading && !matches.data ? (
        <Card>
          <LoadingState label="Loading suggestions…" />
        </Card>
      ) : matches.error ? (
        <Card>
          <ErrorState error={matches.error} onRetry={matches.reload} />
        </Card>
      ) : proposals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="h-4 w-4" />}
            title="No suggestions waiting"
            description="Verify a resident request, then generate suggestions to see resource options."
            action={
              <Button variant="secondary" size="sm" onClick={generate}>
                Generate suggestions
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {proposals.map((recommendation) => {
            const route = recommendation.route_id
              ? routeMap.get(recommendation.route_id)
              : undefined;
            const routeInfo = routeSummary(recommendation, route);
            const stock = resourceMap.get(recommendation.resource_id);

            return (
              <Card key={recommendation.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs text-faint">
                      Request #{recommendation.report_id}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium text-white">
                        {recommendation.report_location ?? "Unknown location"}
                      </h2>
                      <UrgencyBadge
                        urgency={recommendation.report_urgency ?? "low"}
                      />
                      <StatusBadge status="proposed" />
                    </div>
                  </div>
                  <Badge tone="warning">Suggested — Not Approved</Badge>
                </div>

                <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-faint">
                      Need
                    </p>
                    <p className="mt-1.5 text-sm text-white">
                      {formatCategory(recommendation.report_category)} ·{" "}
                      {recommendation.report_quantity ?? "—"} units
                    </p>
                    {recommendation.remaining_shortage ? (
                      <p className="mt-1 text-xs text-warning">
                        {recommendation.remaining_shortage} units still short
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-faint">
                      Supplier
                    </p>
                    <p className="mt-1.5 text-sm text-white">
                      {recommendation.supplier_name ?? "Unknown supplier"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {recommendation.quantity} units ·{" "}
                      {stock ? `${formatNumber(stock.quantity_available)} available` : "stock unavailable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-faint">
                      Route
                    </p>
                    <div className="mt-1.5">
                      <Badge tone={routeInfo.tone}>{routeInfo.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {recommendation.resource_name ?? "Resource"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border-l-2 border-line bg-[#0F0F0F] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-faint">
                    Why this match
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-neutral-300">
                    {recommendation.rationale}
                  </p>
                </div>

                {recommendation.needs_review ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.06] px-3 py-2.5 text-xs leading-5 text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {recommendation.review_reason ??
                      "This suggestion needs coordinator review before approval."}
                  </div>
                ) : null}
              </Card>
            );
          })}

          <div className="flex justify-end pt-1">
            <Button variant="secondary" onClick={onOpenApproval}>
              Review in Human Approval
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-medium text-white">Open shortages</h2>
          <p className="mt-1 text-xs text-faint">
            Replanning creates new suggestions. It never changes an approved
            allocation automatically.
          </p>
        </div>
        {shortages.loading && !shortages.data ? (
          <LoadingState />
        ) : shortages.error ? (
          <ErrorState error={shortages.error} onRetry={shortages.reload} />
        ) : openShortages.length === 0 ? (
          <EmptyState
            title="No open shortages"
            description="Accessible supply currently covers outstanding demand."
          />
        ) : (
          <ul className="divide-y divide-line">
            {openShortages.map((shortage) => (
              <li key={shortage.id} className="px-5 py-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm text-white">
                      Request #{shortage.report_id} · {shortage.quantity} units
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {shortage.report_location ?? "Unknown location"} ·{" "}
                      {formatCategory(shortage.report_category)}
                    </p>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-faint">
                      {shortage.reason}
                    </p>
                  </div>
                  <Badge tone="danger">Open shortage</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
