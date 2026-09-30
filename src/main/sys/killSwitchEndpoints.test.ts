import { describe, expect, it } from 'vitest'
import { getKillSwitchEndpoints } from './killSwitchEndpoints'

const profile = (proxies: unknown[], providers?: Record<string, unknown>): IMihomoConfig =>
  ({ proxies, 'proxy-providers': providers }) as unknown as IMihomoConfig

describe('Kill Switch endpoint collection', () => {
  it('allows only the configured server ports for both transport protocols', async () => {
    const endpoints = await getKillSwitchEndpoints(
      profile([
        { server: '203.0.113.10', port: 443 },
        { server: '203.0.113.10', port: 443 },
        { server: '2001:db8::10', port: 8443 }
      ])
    )
    expect(endpoints).toEqual([
      { ip: '2001:db8::10', port: 8443, protocol: 'tcp' },
      { ip: '2001:db8::10', port: 8443, protocol: 'udp' },
      { ip: '203.0.113.10', port: 443, protocol: 'tcp' },
      { ip: '203.0.113.10', port: 443, protocol: 'udp' }
    ])
  })

  it('refuses profiles whose outbound endpoints cannot be enumerated', async () => {
    await expect(getKillSwitchEndpoints(profile([], { remote: {} }))).rejects.toThrow(
      'proxy providers'
    )
    await expect(getKillSwitchEndpoints(profile([{ server: '203.0.113.10' }]))).rejects.toThrow(
      'fixed host and port'
    )
  })
})
