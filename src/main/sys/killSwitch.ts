import axios from 'axios'
import { getAppConfig, patchAppConfig } from '../config/app'
import { generateProfile, getRuntimeConfig } from '../core/factory'
import { getKillSwitchEndpoints } from './killSwitchEndpoints'
import { helperRequest, helperSocketPath } from './sysproxy'

export interface KillSwitchStatus {
  enabled: boolean
  healthy: boolean
  error?: string
}

async function getKillSwitchRequest(): Promise<{
  tunnel: string
  endpoints: Awaited<ReturnType<typeof getKillSwitchEndpoints>>
}> {
  const config = await getRuntimeConfig()
  if (config.tun?.enable !== true) throw new Error('Enable TUN before enabling Kill Switch')
  const tunnel = config.tun.device
  if (typeof tunnel !== 'string' || !/^utun[0-9]{1,5}$/.test(tunnel)) {
    throw new Error('Kill Switch requires a fixed utun device name')
  }
  return { tunnel, endpoints: await getKillSwitchEndpoints(config) }
}

export async function getKillSwitchStatus(repair = false): Promise<KillSwitchStatus> {
  if (process.platform !== 'darwin') throw new Error('Kill Switch is supported only on macOS')
  const request = () =>
    axios.get<KillSwitchStatus>('http://localhost/kill-switch', {
      socketPath: helperSocketPath,
      timeout: 3000
    })
  const response = repair ? await helperRequest(request) : await request()
  const { killSwitchEnabled } = await getAppConfig()
  if (killSwitchEnabled !== response.data.enabled) {
    await patchAppConfig({ killSwitchEnabled: response.data.enabled })
  }
  return response.data
}

export async function setKillSwitch(enabled: boolean): Promise<KillSwitchStatus> {
  if (process.platform !== 'darwin') throw new Error('Kill Switch is supported only on macOS')
  if (enabled) {
    const request = await getKillSwitchRequest()
    // Keep checking the helper even if activation partially succeeds and its reply fails.
    await patchAppConfig({ killSwitchEnabled: true })
    await helperRequest(() =>
      axios.post('http://localhost/kill-switch', request, { socketPath: helperSocketPath })
    )
  } else {
    await helperRequest(() =>
      axios.delete('http://localhost/kill-switch', { socketPath: helperSocketPath })
    )
  }
  const status = await getKillSwitchStatus()
  if (enabled && !status.healthy) throw new Error(status.error || 'Kill Switch is not active')
  return status
}

export async function refreshKillSwitchIfEnabled(regenerateProfile = false): Promise<void> {
  if (process.platform !== 'darwin') return
  if (!(await getAppConfig()).killSwitchEnabled) return
  let status: KillSwitchStatus
  try {
    status = await getKillSwitchStatus()
  } catch (error) {
    // Legacy macOS packages contain the previous helper without this endpoint.
    if (axios.isAxiosError(error) && error.response?.status === 404) return
    throw error
  }
  if (!status.enabled) return
  if (regenerateProfile) await generateProfile()
  const request = await getKillSwitchRequest()
  await helperRequest(() =>
    axios.put('http://localhost/kill-switch', request, { socketPath: helperSocketPath })
  )
}
