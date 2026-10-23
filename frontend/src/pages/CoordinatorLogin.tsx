import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound, LoaderCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Notice } from "../components/UI";
import { api } from "../api/client";
import { clearAccess, saveAccess } from "../lib/auth";

export default function CoordinatorLogin() {
  const navigate = useNavigate();
  const [coordinatorKey, setCoordinatorKey] = useState("");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [volunteerKey, setVolunteerKey] = useState("");
  const [volunteerName, setVolunteerName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");

    if (!coordinatorKey.trim() || !coordinatorName.trim()) {
      setError("Enter both your coordinator name and the demo access key.");
      return;
    }

    setIsSubmitting(true);
    saveAccess({
      coordinatorKey,
      coordinatorName,
      volunteerKey,
      volunteerName,
    });

    try {
      // The protected audit endpoint validates the coordinator key against the
      // real FastAPI backend before the workspace opens.
      await api.listAuditLogs({ limit: 1 });
      navigate("/coordinator");
    } catch (reason) {
      clearAccess();
      setError(
        reason instanceof Error
          ? reason.message
          : "The backend rejected this demo access.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link className="back-link" to="/">
          <ArrowLeft size={15} /> Back to LIFELINE
        </Link>
        <div className="login-icon">
          <KeyRound size={20} />
        </div>
        <p className="eyebrow eyebrow--signal">Demo coordinator flow</p>
        <h1>Coordinator Access</h1>
        <p className="login-copy">
          Sign in to manage community relief operations.
        </p>
        <Notice tone="info">
          This prototype uses a shared demo API key in the request headers, not
          an email/password or JWT login. The key is kept in memory for this
          browser session and is never placed in the URL or local storage.
        </Notice>
        {error && <Notice tone="error">{error}</Notice>}
        <form className="login-form" onSubmit={submit}>
          <label>
            Coordinator name
            <input
              type="text"
              autoComplete="name"
              required
              value={coordinatorName}
              onChange={(event) => setCoordinatorName(event.target.value)}
              placeholder="Your name"
            />
          </label>
          <label>
            Demo access key
            <input
              type="password"
              autoComplete="off"
              required
              value={coordinatorKey}
              onChange={(event) => setCoordinatorKey(event.target.value)}
              placeholder="From the backend environment"
            />
          </label>

          <div className="login-divider">
            <span>Optional delivery access</span>
          </div>
          <label>
            Volunteer name
            <input
              type="text"
              autoComplete="off"
              value={volunteerName}
              onChange={(event) => setVolunteerName(event.target.value)}
              placeholder="Volunteer or provider name"
            />
          </label>
          <label>
            Volunteer demo key
            <input
              type="password"
              autoComplete="off"
              value={volunteerKey}
              onChange={(event) => setVolunteerKey(event.target.value)}
              placeholder="Only needed for delivery updates"
            />
          </label>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <ArrowRight size={15} />
            )}
            {isSubmitting ? "Validating access" : "Sign in"}
          </Button>
        </form>
        <p className="login-disclaimer">
          Access is verified against a protected backend endpoint. If the
          backend is unavailable, invalid, or not configured, access remains
          denied. Refreshing the page or logging out clears the in-memory
          credentials.
        </p>
      </div>
    </div>
  );
}
