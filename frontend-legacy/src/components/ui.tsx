import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  RotateCw,
  XCircle,
} from "lucide-react";
import { formatStatus, formatUrgency } from "../lib/format";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border border-white bg-white text-black hover:border-neutral-200 hover:bg-neutral-200",
  secondary:
    "border border-line bg-[#1D1D1D] text-white hover:border-[#3A3A3A] hover:bg-[#232323]",
  ghost:
    "border border-transparent bg-transparent text-muted hover:bg-white/[0.05] hover:text-white",
  danger:
    "border border-danger/30 bg-danger/[0.06] text-danger hover:border-danger/50 hover:bg-danger/[0.12]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-45",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-card", className)}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-neutral-300">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

const controlClasses =
  "w-full rounded-lg border border-line bg-[#0F0F0F] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 transition-colors hover:border-[#363636] focus:border-neutral-500 focus:outline-none disabled:opacity-50";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClasses, "appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClasses, "resize-y", className)} {...props} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type BadgeTone = "neutral" | "success" | "warning" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-line bg-white/[0.04] text-muted",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "verified":
    case "approved":
    case "delivered":
    case "resolved":
      return "success";
    case "pending_verification":
    case "clarification_requested":
    case "proposed":
    case "pending":
    case "high":
      return "warning";
    case "rejected":
    case "failed":
    case "cancelled":
    case "open":
    case "critical":
      return "danger";
    default:
      return "neutral";
  }
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{formatStatus(status)}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  return <Badge tone={statusTone(urgency)}>{formatUrgency(urgency)}</Badge>;
}

export function Notice({
  tone,
  children,
  onDismiss,
}: {
  tone: "success" | "error" | "warning" | "info";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    success: "border-success/25 bg-success/[0.07] text-success",
    error: "border-danger/25 bg-danger/[0.07] text-danger",
    warning: "border-warning/25 bg-warning/[0.07] text-warning",
    info: "border-line bg-white/[0.03] text-muted",
  };
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "error"
        ? XCircle
        : tone === "warning"
          ? AlertTriangle
          : Inbox;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border px-3.5 py-3 text-sm",
        styles[tone],
      )}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>{children}</div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-current opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-line text-faint">
        {icon ?? <Inbox className="h-4 w-4" />}
      </div>
      <p className="text-sm font-medium text-white">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 px-6 py-14 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <AlertTriangle className="mb-3 h-5 w-5 text-danger" />
      <p className="text-sm font-medium text-white">Could not load data</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted">{error.message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line", className)}>
      {children}
    </div>
  );
}
