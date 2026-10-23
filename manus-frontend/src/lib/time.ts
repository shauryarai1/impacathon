export function formatLocalDateTime(value?: string): string {
  if (!value) return 'Submission time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid timestamp from API'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatRelativeTime(value?: string, now = Date.now()): string {
  if (!value) return 'Time not provided by API'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid timestamp from API'
  const seconds = Math.round((date.getTime() - now) / 1000)
  const absolute = Math.abs(seconds)
  const unit = absolute < 60 ? 'second' : absolute < 3600 ? 'minute' : absolute < 86400 ? 'hour' : 'day'
  const divisor = unit === 'second' ? 1 : unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(Math.round(seconds / divisor), unit)
}
