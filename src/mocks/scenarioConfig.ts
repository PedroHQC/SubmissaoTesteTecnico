// src/mocks/scenarioConfig.ts
export type NetworkScenario =
  | 'SUCCESS'
  | 'EMPTY_LIST'
  | 'SLOW_NETWORK'
  | 'OUT_OF_ORDER'
  | 'CONNECTION_FAILURE'
  | 'TIMEOUT'
  | 'SERVER_ERROR_500'
  | 'CLIENT_ERROR_400'
  | 'RANKING_FAILURE'
  | 'HISTORY_FAILURE'
  | 'POST_TIMEOUT_THEN_RECOVER'
  | 'POST_SERVICE_UNAVAILABLE_503';

const SCENARIO_STORAGE_KEY = 'pb_active_network_scenario_v1';

export const scenarioManager = {
  getScenario(): NetworkScenario {
    try {
      return (localStorage.getItem(SCENARIO_STORAGE_KEY) as NetworkScenario) || 'SUCCESS';
    } catch {
      return 'SUCCESS';
    }
  },

  setScenario(scenario: NetworkScenario): void {
    localStorage.setItem(SCENARIO_STORAGE_KEY, scenario);
  },

  reset(): void {
    localStorage.setItem(SCENARIO_STORAGE_KEY, 'SUCCESS');
  },

  // Latência configurável com suporte a valor determinístico para testes
  fixedDelayMs: null as number | null,

  async applyLatency(minMs = 150, maxMs = 300): Promise<number> {
    const fixed = localStorage.getItem('pb_test_latency_ms');
    if (fixed !== null) return Number(fixed);
    if (this.fixedDelayMs !== null) {
      return this.fixedDelayMs;
    }
    const current = this.getScenario();
    if (current === 'SLOW_NETWORK') {
      return Math.floor(Math.random() * 2500) + 1500; // 1.5s a 4s
    }
    return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  },
};
