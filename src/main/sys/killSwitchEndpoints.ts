import { lookup } from 'dns/promises'
import { isIP } from 'net'

interface KillSwitchEndpoint {
  ip: string
  port: number
  protocol: 'tcp' | 'udp'
}

interface ProxyAddress {
  server?: unknown
  port?: unknown
}

export async function getKillSwitchEndpoints(config: IMihomoConfig): Promise<KillSwitchEndpoint[]> {
  const providers = (config as unknown as Record<string, unknown>)['proxy-providers']
  if (providers != null && (typeof providers !== 'object' || Array.isArray(providers))) {
    throw new Error('Invalid proxy providers in the active profile')
  }
  const providerProxies: unknown[] = []
  for (const provider of Object.values(providers ?? {})) {
    if (!provider || typeof provider !== 'object' || Array.isArray(provider)) {
      throw new Error('Invalid proxy provider in the active profile')
    }
    const { type, payload } = provider as Record<string, unknown>
    if (type !== 'inline' || !Array.isArray(payload)) {
      throw new Error('Kill Switch requires inline proxy providers with a payload')
    }
    providerProxies.push(...payload)
  }
  const inlineProxies = config.proxies as unknown
  if (inlineProxies != null && !Array.isArray(inlineProxies)) {
    throw new Error('Invalid proxies in the active profile')
  }
  const proxies = [...(inlineProxies ?? []), ...providerProxies]
  if (proxies.length === 0) {
    throw new Error('No proxy server addresses found in the active profile')
  }

  const endpoints = new Map<string, KillSwitchEndpoint>()
  for (const rawProxy of proxies) {
    if (!rawProxy || typeof rawProxy !== 'object')
      throw new Error('Invalid proxy in active profile')
    const { server, port } = rawProxy as ProxyAddress
    if (
      typeof server !== 'string' ||
      !server ||
      !Number.isInteger(port) ||
      (port as number) < 1 ||
      (port as number) > 65535
    ) {
      throw new Error('A proxy server has no fixed host and port')
    }
    const addresses = isIP(server)
      ? [server]
      : (await lookup(server, { all: true })).map((a) => a.address)
    if (addresses.length === 0) throw new Error(`Could not resolve proxy server: ${server}`)
    for (const ip of addresses) {
      for (const protocol of ['tcp', 'udp'] as const) {
        const endpoint = { ip, port: port as number, protocol }
        endpoints.set(`${ip}:${port}:${protocol}`, endpoint)
      }
    }
  }
  if (endpoints.size > 256) throw new Error('The active profile has more than 256 proxy endpoints')
  return [...endpoints.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, endpoint]) => endpoint)
}
