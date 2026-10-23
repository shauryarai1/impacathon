import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { ResourcesTab } from "./operations/ResourcesTab";
import { MatchesTab } from "./operations/MatchesTab";
import { ApprovalTab } from "./operations/ApprovalTab";

type OpsTab = "resources" | "matches" | "approval";

const tabs: Array<{ id: OpsTab; label: string }> = [
  { id: "resources", label: "Resources" },
  { id: "matches", label: "Suggested Matches" },
  { id: "approval", label: "Human Approval" },
];

export function OperationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: OpsTab =
    requestedTab === "matches" || requestedTab === "approval"
      ? requestedTab
      : "resources";

  const setTab = (tab: OpsTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Resources and allocation"
        title="Operations"
        description="Review supply, see suggested allocations, and make the human decision that releases resources."
      />

      <div
        className="mb-6 flex gap-1 overflow-x-auto border-b border-line"
        role="tablist"
        aria-label="Operations sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setTab(tab.id)}
            className={
              activeTab === tab.id
                ? "whitespace-nowrap border-b-2 border-white px-4 py-3 text-sm font-medium text-white"
                : "whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm text-muted transition-colors hover:text-white"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resources" ? <ResourcesTab /> : null}
      {activeTab === "matches" ? (
        <MatchesTab onOpenApproval={() => setTab("approval")} />
      ) : null}
      {activeTab === "approval" ? <ApprovalTab /> : null}
    </div>
  );
}
