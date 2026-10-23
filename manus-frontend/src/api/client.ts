import type { ApiEnvelope, DashboardMetrics, ReliefRequest, SuggestedMatch } from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export class ApiContractUnavailableError extends Error {
  constructor(operation: string) {
    super(`${operation} is waiting for the FastAPI contract. Add frontend-integration.md or the OpenAPI schema before connecting this action.`)
    this.name = 'ApiContractUnavailableError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const envelope = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || envelope.error) throw new Error(envelope.error?.message || envelope.message || `Request failed with status ${response.status}`)
  return envelope.data
}

/** Replace every placeholder path/payload with the supplied FastAPI OpenAPI contract. */
export const api = {
  baseUrl: API_BASE_URL,
  async loginCoordinator(_payload: { email: string; password: string }): Promise<{ session: string }> {
    throw new ApiContractUnavailableError('Coordinator authentication')
  },
  async getDashboardMetrics(): Promise<DashboardMetrics> { throw new ApiContractUnavailableError('Dashboard metrics') },
  async submitRequest(_payload: Omit<ReliefRequest, 'id' | 'status' | 'submittedAt'>): Promise<ReliefRequest> { throw new ApiContractUnavailableError('Submit request') },
  async verifyRequest(_id: string): Promise<ReliefRequest> { throw new ApiContractUnavailableError('Verify request') },
  async getSuggestedMatches(): Promise<SuggestedMatch[]> { throw new ApiContractUnavailableError('Suggested matches') },
  async callRaw<T>(path: string, init?: RequestInit): Promise<T> { return request<T>(path, init) },
}
