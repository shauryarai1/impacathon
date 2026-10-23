import { NavLink, Outlet, Link } from "react-router-dom";
import {
  Activity,
  Boxes,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Truck,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useAccessDialog } from "../lib/access";
import { cn } from "./ui";

const navigation = [
  { to: "/coordinator", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/coordinator/requests", label: "Requests", icon: Inbox },
  { to: "/coordinator/operations", label: "Operations", icon: Boxes },
  { to: "/coordinator/deliveries", label: "Deliveries", icon: Truck },
];

function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none"
      aria-label="Lifeline home"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-[#1B1B1B]">
        <Activity className="h-4 w-4 text-white" strokeWidth={2.2} />
      </span>
      <span className="text-sm font-semibold tracking-[0.14em] text-white">
        LIFELINE
      </span>
    </Link>
  );
}

function AccessCard() {
  const { hasCoordinator, hasVolunteer, credentials } = useAuth();
  const { openAccess } = useAccessDialog();

  return (
    <div className="rounded-xl border border-line bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            hasCoordinator ? "bg-success" : "bg-faint",
          )}
        />
        <span className="text-xs font-medium text-white">
          {hasCoordinator ? "Coordinator connected" : "View-only access"}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-faint">
        {hasCoordinator
          ? credentials.coordinatorName || "Demo coordinator"
          : "Add demo access to make decisions."}
        {hasVolunteer ? " Volunteer access ready." : ""}
      </p>
      <button
        type="button"
        onClick={openAccess}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-[#1D1D1D] px-3 py-2 text-xs font-medium text-white transition-colors hover:border-[#3A3A3A] hover:bg-[#232323]"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Demo access
      </button>
    </div>
  );
}

export function CoordinatorLayout() {
  const { openAccess } = useAccessDialog();

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-sidebar px-4 py-5 lg:flex">
        <div className="px-2">
          <Brand />
          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-faint">
            Coordination console
          </p>
        </div>

        <nav className="mt-8 space-y-1" aria-label="Coordinator navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-white/[0.07] text-white"
                      : "text-muted hover:bg-white/[0.04] hover:text-white",
                  )
                }
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto">
          <AccessCard />
          <p className="mt-4 px-1 text-[10px] leading-4 text-faint">
            Human approval is required for every resource allocation.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
            <button
              type="button"
              onClick={openAccess}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-2 text-xs text-muted"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Access
            </button>
          </div>
          <nav
            className="flex gap-1 overflow-x-auto px-3 pb-2"
            aria-label="Coordinator navigation"
          >
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-muted hover:bg-white/[0.04] hover:text-white",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
