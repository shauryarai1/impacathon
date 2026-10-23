import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Settings2,
} from "lucide-react";
import { NavLink, Outlet, Link, Navigate, useNavigate } from "react-router-dom";
import { Logo, StatusBadge } from "../components/UI";
import {
  clearAccess,
  coordinatorDisplayName,
  getAccess,
  hasCoordinatorAccess,
  hasVolunteerAccess,
  initials,
} from "../lib/auth";

const items = [
  { to: "/coordinator", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/coordinator/requests", label: "Requests", icon: ClipboardList },
  { to: "/coordinator/operations", label: "Operations", icon: Settings2 },
  { to: "/coordinator/deliveries", label: "Deliveries", icon: PackageCheck },
];

export default function CoordinatorShell() {
  const navigate = useNavigate();
  const authenticated = hasCoordinatorAccess();
  const access = getAccess();
  const displayName = coordinatorDisplayName();
  const volunteerReady = hasVolunteerAccess();

  if (!authenticated) return <Navigate to="/coordinator/login" replace />;

  const logout = () => {
    clearAccess();
    navigate("/");
  };

  return (
    <div className="coordinator-shell">
      <aside className="sidebar">
        <Link to="/" className="sidebar__logo">
          <Logo />
        </Link>
        <div className="sidebar__context">
          <span className="context-label">Workspace</span>
          <strong>Relief coordination</strong>
          <span className="context-status">
            <Activity size={13} /> Coordinator session
          </span>
        </div>
        <nav className="sidebar__nav" aria-label="Coordinator navigation">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-item ${isActive ? "nav-item--active" : ""}`
              }
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <StatusBadge value="Live API" />
          <p>
            {volunteerReady
              ? "Coordinator and volunteer access are held in memory for this session."
              : "Add a volunteer key to update delivery status."}
          </p>
          <button className="text-button sidebar-logout" onClick={logout}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </aside>
      <div className="coordinator-main">
        <header className="coordinator-topbar">
          <div className="mobile-brand">
            <Link to="/">
              <Logo compact />
            </Link>
          </div>
          <div className="topbar__meta">
            <span className="topbar__title">Operations workspace</span>
            <StatusBadge value="Live API" />
          </div>
          <button
            className="topbar__user topbar__user-button"
            onClick={logout}
            title="Log out"
          >
            <span className="avatar">{initials(displayName)}</span>
            <span className="topbar__user-copy">
              <strong>{displayName}</strong>
              <small>Coordinator · Log out</small>
            </span>
          </button>
        </header>
        <div className="mobile-nav" aria-label="Mobile coordinator navigation">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive
                  ? "mobile-nav__item mobile-nav__item--active"
                  : "mobile-nav__item"
              }
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
        <main className="coordinator-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
