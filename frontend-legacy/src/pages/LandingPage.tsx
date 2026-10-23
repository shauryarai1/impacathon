import { Link } from "react-router-dom";
import { Activity, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { buttonStyles } from "../components/ui";

const steps = [
  {
    title: "Request help",
    description: "Tell us what you need and where you are.",
  },
  {
    title: "Human verification",
    description: "A coordinator reviews every request.",
  },
  {
    title: "Coordinated delivery",
    description: "Resources are approved and tracked to arrival.",
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] grid-lines opacity-70" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-[#1B1B1B]">
            <Activity className="h-4 w-4 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-sm font-semibold tracking-[0.14em] text-white">
            LIFELINE
          </span>
        </div>
        <p className="hidden text-[11px] uppercase tracking-[0.14em] text-faint sm:block">
          Impactathon 2026
        </p>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-84px)] max-w-7xl flex-col justify-center px-6 pb-20 pt-8 sm:px-8">
        <div className="grid gap-16 lg:grid-cols-[1.25fr_0.75fr] lg:items-center lg:gap-20">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[11px] text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-muted" />
              Human-reviewed disaster coordination
            </div>

            <h1 className="max-w-3xl text-balance text-[46px] font-semibold leading-[1.02] tracking-[-0.055em] text-white sm:text-[66px] lg:text-[78px]">
              When systems fail,
              <br />
              communities connect.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-muted sm:text-lg">
              A simpler way to request help, coordinate resources, and deliver
              relief when it matters most.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/request" className={buttonStyles("primary", "md", "h-11 px-5")}>
                Request help
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/coordinator"
                className={buttonStyles("secondary", "md", "h-11 px-5")}
              >
                Coordinator dashboard
              </Link>
            </div>

            <p className="mt-8 max-w-md text-xs leading-5 text-faint">
              Every allocation is reviewed and approved by a human coordinator.
              Nothing is dispatched automatically.
            </p>
          </div>

          <div className="w-full max-w-md lg:justify-self-end">
            <div className="rounded-xl border border-line bg-card p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                A clear path to help
              </p>
              <ol className="mt-6 space-y-0">
                {steps.map((step, index) => (
                  <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0">
                    {index < steps.length - 1 ? (
                      <span className="absolute left-[11px] top-7 h-[calc(100%-20px)] w-px bg-line" />
                    ) : null}
                    <span className="relative z-10 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border border-line bg-[#111111] text-[10px] font-medium text-muted">
                      {index + 1}
                    </span>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-xs text-faint">
                <Check className="h-3.5 w-3.5 text-muted" />
                Every step is visible and accountable.
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Lifeline · Resilient communities</span>
          <span>Coordinated by people, not algorithms.</span>
        </div>
      </footer>
    </div>
  );
}
