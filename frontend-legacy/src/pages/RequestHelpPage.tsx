import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import type { Report, ReportCategory, Urgency } from "../types";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
  StatusBadge,
  Textarea,
  buttonStyles,
} from "../components/ui";
import { formatCategory } from "../lib/format";

const categories: ReportCategory[] = [
  "water",
  "food",
  "shelter",
  "medical",
  "other",
];

const urgencies: Urgency[] = ["low", "medium", "high", "critical"];

interface RequestForm {
  name: string;
  category: ReportCategory;
  quantity: string;
  location: string;
  urgency: Urgency;
  details: string;
}

const initialForm: RequestForm = {
  name: "",
  category: "water",
  quantity: "1",
  location: "",
  urgency: "high",
  details: "",
};

export function RequestHelpPage() {
  const { api } = useAuth();
  const [form, setForm] = useState<RequestForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<Report | null>(null);

  const update = <K extends keyof RequestForm>(
    field: K,
    value: RequestForm[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const quantity = Number(form.quantity);
    const description =
      form.details.trim() ||
      `${quantity} ${formatCategory(form.category).toLowerCase()} requested at ${form.location.trim()}.`;

    try {
      const created = await api.reports.create({
        reporter_name: form.name.trim(),
        category: form.category,
        type: "need",
        location: form.location.trim(),
        description,
        quantity,
        urgency: form.urgency,
      });
      setRequest(created);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your request could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setRequest(null);
    setForm(initialForm);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          aria-label="Lifeline home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-[#1B1B1B]">
            <Activity className="h-4 w-4 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-sm font-semibold tracking-[0.14em] text-white">
            LIFELINE
          </span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back home
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        {request ? (
          <div className="rounded-xl border border-line bg-card p-6 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-success/25 bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">
              Request received
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              A coordinator will review your request. Submitting it does not
              guarantee supplies.
            </p>

            <div className="mt-6 rounded-lg border border-line bg-[#0F0F0F] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-faint">
                    Request ID
                  </p>
                  <p className="mt-1 text-lg font-medium text-white">
                    #{request.id}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </div>
              <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-faint">Need</dt>
                  <dd className="mt-1 text-white">
                    {request.quantity} · {formatCategory(request.category)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">Location</dt>
                  <dd className="mt-1 text-white">{request.location}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={reset}>
                Submit another request
              </Button>
              <Link to="/" className={buttonStyles("ghost", "md")}>
                Return home
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
                Resident request
              </p>
              <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.04em] text-white sm:text-[38px]">
                Request emergency supplies
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
                Tell us what you need. Keep it brief. A coordinator will review
                your request before anything is allocated.
              </p>
            </div>

            <form
              onSubmit={submit}
              className="rounded-xl border border-line bg-card p-5 sm:p-7"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="What do you need?">
                  <Select
                    value={form.category}
                    onChange={(event) =>
                      update("category", event.target.value as ReportCategory)
                    }
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {formatCategory(category)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="How much do you need?">
                  <Input
                    type="number"
                    min={1}
                    max={1_000_000}
                    value={form.quantity}
                    onChange={(event) => update("quantity", event.target.value)}
                    required
                  />
                </Field>

                <Field label="Where are you?">
                  <Input
                    value={form.location}
                    onChange={(event) => update("location", event.target.value)}
                    placeholder="Neighborhood or shelter"
                    minLength={2}
                    maxLength={160}
                    required
                  />
                </Field>

                <Field label="How urgent is it?">
                  <Select
                    value={form.urgency}
                    onChange={(event) =>
                      update("urgency", event.target.value as Urgency)
                    }
                  >
                    {urgencies.map((urgency) => (
                      <option key={urgency} value={urgency}>
                        {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Your name"
                  className="sm:col-span-2"
                  hint="So a coordinator can follow up with you."
                >
                  <Input
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Full name"
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </Field>

                <Field
                  label="Additional details"
                  hint="Optional. Include anything that helps us understand the need."
                  className="sm:col-span-2"
                >
                  <Textarea
                    rows={4}
                    value={form.details}
                    onChange={(event) => update("details", event.target.value)}
                    placeholder="For example: families with children, accessibility needs, or a safe drop-off point."
                    maxLength={4000}
                  />
                </Field>
              </div>

              {error ? (
                <div className="mt-5">
                  <Notice tone="error">{error}</Notice>
                </div>
              ) : null}

              <div className="mt-6">
                <Button
                  type="submit"
                  className="w-full"
                  loading={submitting}
                >
                  Submit request
                </Button>
                <p className="mt-3 text-center text-xs leading-5 text-faint">
                  A coordinator will review this request. No supplies are
                  promised until it is verified and approved.
                </p>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
