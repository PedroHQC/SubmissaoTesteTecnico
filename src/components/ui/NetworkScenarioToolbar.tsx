import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NetworkScenario, scenarioManager } from '../../mocks/scenarioConfig';
import { mockDb } from '../../mocks/db';
import { matchSyncQueue } from '../../services/matchSyncQueue';
import { JuicyButton } from './JuicyButton';
const scenarios: NetworkScenario[] = [
  'SUCCESS',
  'EMPTY_LIST',
  'SLOW_NETWORK',
  'OUT_OF_ORDER',
  'TIMEOUT',
  'CONNECTION_FAILURE',
  'SERVER_ERROR_500',
  'CLIENT_ERROR_400',
  'RANKING_FAILURE',
  'HISTORY_FAILURE',
  'POST_TIMEOUT_THEN_RECOVER',
  'POST_SERVICE_UNAVAILABLE_503',
];
export function NetworkScenarioToolbar() {
  const [scenario, setScenario] = useState(scenarioManager.getScenario);
  const [notice, setNotice] = useState('');
  const client = useQueryClient();
  return (
    <div className="network-options">
      <p>
        Ranking and match history use a simulated local API. These scenarios do not change gameplay.
      </p>
      <label htmlFor="network-scenario">Network scenario</label>
      <select
        id="network-scenario"
        value={scenario}
        onChange={(event) => {
          const value = event.target.value as NetworkScenario;
          scenarioManager.setScenario(value);
          setScenario(value);
          void client.invalidateQueries();
        }}
      >
        {scenarios.map((value) => (
          <option value={value} key={value}>
            {value.split('_').join(' ')}
          </option>
        ))}
      </select>
      <JuicyButton
        onClick={() => {
          void matchSyncQueue.flushPending().then(() => {
            void client.invalidateQueries();
            setNotice(
              matchSyncQueue.getPending().length
                ? 'Uploads are still pending.'
                : 'All matches are synced.'
            );
          });
        }}
      >
        Retry pending uploads
      </JuicyButton>
      <JuicyButton
        onClick={() => {
          scenarioManager.reset();
          mockDb.reset();
          setScenario('SUCCESS');
          void client.invalidateQueries();
          setNotice('Network and confirmed records reset. Pending matches are preserved.');
        }}
      >
        Reset demo records and network
      </JuicyButton>
      <p role="status">{notice}</p>
    </div>
  );
}
