import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeploymentDriftBanner } from './DeploymentDriftBanner'

const useQueryMock = vi.fn()

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

function withMetaEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const env = import.meta.env as unknown as Record<string, unknown>
  const previous = new Map<string, unknown>()
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, env[key])
    if (value === undefined) {
      delete env[key]
    } else {
      env[key] = value
    }
  }

  try {
    return run()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete env[key]
      else env[key] = value
    }
  }
}

afterEach(() => {
  useQueryMock.mockReset()
  vi.restoreAllMocks()
})

describe('DeploymentDriftBanner', () => {
  it('swallows query crashes instead of taking down the app shell', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    useQueryMock.mockImplementation(() => {
      throw new Error('boom')
    })

    expect(() => render(<DeploymentDriftBanner />)).not.toThrow()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(consoleError).toHaveBeenCalled()
  })

  it('renders drift warning when backend and frontend SHAs differ', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useQueryMock.mockReturnValue({
      appBuildSha: 'backend-sha',
      deployedAt: '2026-03-09T00:00:00Z',
    })

    withMetaEnv({ VITE_APP_BUILD_SHA: 'frontend-sha' }, () => {
      render(<DeploymentDriftBanner />)
    })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('frontend-sha')
    expect(alert.textContent).toContain('backend-sha')
  })
})
