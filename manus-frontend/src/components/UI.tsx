import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ArrowUpRight, Check, CircleAlert, Info, LoaderCircle, X } from 'lucide-react'
import type { RequestStatus, RouteStatus, Urgency, DeliveryStatus } from '../api/types'

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand-lockup" aria-label="LIFELINE"><span className="brand-mark"><span /></span><span className={compact ? 'brand-wordmark brand-wordmark--compact' : 'brand-wordmark'}>LIFELINE</span></div>
}

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  return <button className={`button button--${variant} button--${size} ${className}`} {...props}>{children}</button>
}

export function StatusBadge({ value }: { value: RequestStatus | RouteStatus | Urgency | DeliveryStatus | 'Suggested — Not Approved' | 'DEMO DATA' }) {
  const tone = value === 'Critical' || value === 'Blocked' || value === 'Rejected' || value === 'Failed' || value === 'Cancelled' ? 'red' : value === 'High' || value === 'Limited' || value === 'Needs information' || value === 'Awaiting review' || value === 'DEMO DATA' || value === 'Suggested — Not Approved' ? 'amber' : value === 'Verified' || value === 'Accessible' || value === 'Delivered' ? 'green' : 'neutral'
  return <span className={`status status--${tone}`}><span className="status-dot" />{value}</span>
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-header__action">{action}</div>}</div>
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>
}

export function MetricCard({ label, value, note, accent = false }: { label: string; value: string | number; note?: string; accent?: boolean }) {
  return <div className={`metric-card ${accent ? 'metric-card--accent' : ''}`}><p>{label}</p><strong>{value}</strong>{note && <span>{note}</span>}</div>
}

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`surface ${className}`}>{children}</div>
}

export function EmptyState({ icon = <Info size={18} />, title, description }: { icon?: ReactNode; title: string; description: string }) {
  return <div className="empty-state"><span className="empty-state__icon">{icon}</span><h3>{title}</h3><p>{description}</p></div>
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'error'; children: ReactNode }) {
  const Icon = tone === 'warning' || tone === 'error' ? CircleAlert : tone === 'success' ? Check : Info
  return <div className={`notice notice--${tone}`}><Icon size={16} /><span>{children}</span></div>
}

export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel, busy = false }: { title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="dialog-close" onClick={onCancel} aria-label="Close"><X size={17} /></button><p className="eyebrow">Confirmation required</p><h2 id="dialog-title">{title}</h2><p>{description}</p><div className="dialog__actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={onConfirm} disabled={busy}>{busy && <LoaderCircle className="spin" size={15} />}{confirmLabel}<ArrowUpRight size={15} /></Button></div></div></div>
}
