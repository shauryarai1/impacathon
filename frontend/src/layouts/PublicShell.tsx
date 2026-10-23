import { ArrowRight } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { Logo } from "../components/UI";

export default function PublicShell() {
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" aria-label="LIFELINE home">
          <Logo />
        </Link>
        <nav className="public-nav" aria-label="Public navigation">
          <Link to="/#about">About</Link>
          <Link to="/#how-it-works">How It Works</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="public-footer">
        <span>LIFELINE</span>
        <span>When systems fail, communities connect.</span>
        <span className="public-footer__links">
          <Link to="/for-organizations">For Organizations</Link>
          <Link to="/#about">About Lifeline</Link>
          <Link to="/coordinator/login">
            Are you a coordinator? Log in <ArrowRight size={13} />
          </Link>
        </span>
      </footer>
    </div>
  );
}
