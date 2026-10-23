import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  Send,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Notice, StatusBadge } from "../components/UI";
import type { ApiReport, NeedType, Urgency } from "../api/types";
import { api } from "../api/client";
import { formatLocalDateTime } from "../lib/time";
import {
  categoryFromNeed,
  displayId,
  requestStatusLabel,
  urgencyToApi,
} from "../lib/format";

const needs: NeedType[] = ["Water", "Food", "Shelter", "Medical", "Other"];
const urgencies: Urgency[] = ["Critical", "High", "Routine"];

export default function RequestHelp() {
  const [submitted, setSubmitted] = useState<ApiReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    need: "Water" as NeedType,
    quantity: "",
    location: "",
    name: "",
    urgency: "High" as Urgency,
    details: "",
  });
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const quantity = Number.parseInt(form.quantity, 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
      setError("Enter a quantity of at least 1.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const description =
        form.details.trim() ||
        `${quantity} units of ${form.need.toLowerCase()} requested at ${form.location.trim()}.`;
      const report = await api.submitRequest({
        reporter_name: form.name.trim(),
        category: categoryFromNeed(form.need),
        type: "need",
        location: form.location.trim(),
        description,
        quantity,
        urgency: urgencyToApi(form.urgency),
      });
      setSubmitted(report);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your request could not be submitted.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted)
    return (
      <div className="request-page">
        <div className="request-success">
          <div className="success-icon">
            <Check size={25} />
          </div>
          <p className="eyebrow eyebrow--signal">Request received</p>
          <h1>Help is now in the queue.</h1>
          <p className="request-success__copy">
            A coordinator will review your request and confirm what can be
            delivered. You do not need to keep this page open.
          </p>
          <div className="request-id">
            <span>Request ID</span>
            <strong>{displayId("REQ", submitted.id)}</strong>
            <StatusBadge value={requestStatusLabel(submitted.status)} />
          </div>
          <div className="submission-time">
            <span>Submitted</span>
            <strong>{formatLocalDateTime(submitted.created_at)}</strong>
            <small>This timestamp comes directly from the Lifeline API.</small>
          </div>
          <div className="success-next">
            <CircleAlert size={17} />
            <span>
              Keep this ID for reference. If your situation becomes immediately
              dangerous, contact local emergency services.
            </span>
          </div>
          <Link className="text-link" to="/">
            Return to LIFELINE <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );

  return (
    <div className="request-page">
      <div className="request-form-wrap">
        <Link className="back-link" to="/">
          <ArrowLeft size={15} /> Back to LIFELINE
        </Link>
        <div className="request-intro">
          <p className="eyebrow eyebrow--signal">Resident request</p>
          <h1>What do you need right now?</h1>
          <p>
            Share the essentials. A coordinator will review your request and
            match it with available help.
          </p>
        </div>
        <Notice tone="info">
          This is a short form. You can add context, but only the essentials are
          required.
        </Notice>
        <form className="request-form" onSubmit={submit}>
          <fieldset>
            <legend>1 / The need</legend>
            <label>
              What do you need?<span className="required">Required</span>
            </label>
            <div className="choice-grid">
              {needs.map((need) => (
                <button
                  type="button"
                  key={need}
                  className={`choice-card ${form.need === need ? "choice-card--selected" : ""}`}
                  onClick={() => update("need", need)}
                >
                  <span className="choice-radio" />
                  {need}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>2 / The details</legend>
            <div className="field-grid">
              <label>
                Your name<span className="required">Required</span>
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                />
              </label>
              <label>
                Where are you?<span className="required">Required</span>
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={form.location}
                  onChange={(event) => update("location", event.target.value)}
                  placeholder="Area, street, or landmark"
                />
              </label>
            </div>
            <label style={{ display: "block", marginTop: 12 }}>
              How much do you need?<span className="required">Required</span>
              <input
                required
                type="number"
                min={1}
                max={1000000}
                value={form.quantity}
                onChange={(event) => update("quantity", event.target.value)}
                placeholder="e.g. 24 units"
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>3 / The urgency</legend>
            <label>
              How urgent is it?<span className="required">Required</span>
            </label>
            <div className="urgency-grid">
              {urgencies.map((urgency) => (
                <button
                  type="button"
                  key={urgency}
                  className={`urgency-option urgency-option--${urgency.toLowerCase()} ${form.urgency === urgency ? "urgency-option--selected" : ""}`}
                  onClick={() => update("urgency", urgency)}
                >
                  <span>{urgency}</span>
                  <small>
                    {urgency === "Critical"
                      ? "Immediate risk"
                      : urgency === "High"
                        ? "Needed today"
                        : "Can wait a little"}
                  </small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>4 / Optional context</legend>
            <label>
              Additional details<span className="optional">Optional</span>
              <textarea
                rows={4}
                maxLength={4000}
                value={form.details}
                onChange={(event) => update("details", event.target.value)}
                placeholder="Anything that will help us understand the situation?"
              />
            </label>
          </fieldset>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="request-submit">
            <div>
              <p>Ready to send?</p>
              <span>Your request will be marked as awaiting review.</span>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="spin" size={15} />}
              {isSubmitting ? "Sending request" : "Submit request"}{" "}
              {!isSubmitting && <Send size={15} />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
