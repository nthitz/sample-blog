import { setTimeout as sleep } from 'node:timers/promises';

export async function simulateLatency(_name = 'simulated_latency'): Promise<void> {
  await sleep(1000);
}
