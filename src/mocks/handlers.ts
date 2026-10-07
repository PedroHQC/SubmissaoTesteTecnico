// src/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';
import { MatchRecord } from '../types/LogContracts';
import { mockDb } from './db';
import { scenarioManager } from './scenarioConfig';

export const handlers = [
  // 1. CONSULTA DE RANKING
  http.get('/api/v1/ranking', async ({ request }) => {
    const scenario = scenarioManager.getScenario();
    await delay(await scenarioManager.applyLatency());

    if (scenario === 'SERVER_ERROR_500') {
      return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
    }
    if (scenario === 'CLIENT_ERROR_400') {
      return HttpResponse.json({ message: 'Invalid parameters' }, { status: 400 });
    }
    if (scenario === 'RANKING_FAILURE') {
      return new HttpResponse(null, { status: 503, statusText: 'Ranking Service Unavailable' });
    }
    if (scenario === 'TIMEOUT') await delay(5000);
    if (scenario === 'TIMEOUT' || scenario === 'CONNECTION_FAILURE') {
      return HttpResponse.error();
    }

    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 5;
    const sessionTime = Number(url.searchParams.get('sessionTime')) || 120;
    const enemySpawnInterval = Number(url.searchParams.get('enemySpawnInterval')) || 3;
    const currentPlayerId = url.searchParams.get('currentPlayerId') || '';
    const mode = url.searchParams.get('mode') || 'arena';
    if (scenario === 'OUT_OF_ORDER') await delay(page === 1 ? 900 : 50);

    if (scenario === 'EMPTY_LIST') {
      return HttpResponse.json({ data: [], page: 1, pageSize, totalItems: 0, totalPages: 1 });
    }

    const result = mockDb.queryRanking(
      sessionTime,
      enemySpawnInterval,
      page,
      pageSize,
      currentPlayerId,
      mode
    );
    return HttpResponse.json(result);
  }),

  // 2. CONSULTA DE HISTÓRICO
  http.get('/api/v1/history', async ({ request }) => {
    const scenario = scenarioManager.getScenario();
    await delay(await scenarioManager.applyLatency());

    if (scenario === 'SERVER_ERROR_500') {
      return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
    }
    if (scenario === 'CLIENT_ERROR_400') {
      return HttpResponse.json({ message: 'Invalid history parameters' }, { status: 400 });
    }
    if (scenario === 'HISTORY_FAILURE') {
      return new HttpResponse(null, { status: 503, statusText: 'History Service Unavailable' });
    }
    if (scenario === 'TIMEOUT') await delay(5000);
    if (scenario === 'TIMEOUT' || scenario === 'CONNECTION_FAILURE') {
      return HttpResponse.error();
    }

    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId') || '';
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 5;

    if (scenario === 'EMPTY_LIST') {
      return HttpResponse.json({ data: [], page: 1, pageSize, totalItems: 0, totalPages: 1 });
    }

    const result = mockDb.queryHistory(playerId, page, pageSize);
    return HttpResponse.json(result);
  }),

  // 3. REGISTRO DE PARTIDA CONCLUÍDA
  http.post('/api/v1/matches', async ({ request }) => {
    const scenario = scenarioManager.getScenario();
    await delay(await scenarioManager.applyLatency());

    if (scenario === 'POST_SERVICE_UNAVAILABLE_503') {
      return new HttpResponse(null, { status: 503, statusText: 'Match Gateway Down' });
    }

    if (scenario === 'POST_TIMEOUT_THEN_RECOVER') {
      // Salva no banco mas simula falha/timeout na rede do cliente
      const body = (await request.json()) as MatchRecord;
      mockDb.insertMatch(body);
      // Exceed the Axios timeout after committing: retries recover the existing ID.
      await delay(5000);
      return HttpResponse.error();
    }

    if (scenario === 'TIMEOUT') await delay(5000);
    if (scenario === 'TIMEOUT' || scenario === 'CONNECTION_FAILURE') {
      return HttpResponse.error();
    }

    const body = (await request.json()) as MatchRecord;
    const saved = mockDb.insertMatch(body);
    return HttpResponse.json(saved, { status: 201 });
  }),
];
