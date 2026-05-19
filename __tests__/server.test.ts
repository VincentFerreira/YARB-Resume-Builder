import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';

// Tests use the real cvs/ directory — each test that writes cleans up after itself.

let createdId: string;

// ── Health check ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// ── CV CRUD ───────────────────────────────────────────────────────────────────

describe('GET /cvs', () => {
  it('returns 200 with an array', async () => {
    const res = await request(app).get('/cvs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /cvs', () => {
  afterAll(async () => {
    if (createdId) {
      await request(app).delete(`/cvs/${createdId}`);
    }
  });

  it('creates a CV and returns metadata with an id', async () => {
    const res = await request(app)
      .post('/cvs')
      .send({ name: 'Test CV', data: { currentLanguage: 'fr' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test CV');
    expect(typeof res.body.createdAt).toBe('number');
    createdId = res.body.id;
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/cvs')
      .send({ data: { currentLanguage: 'fr' } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when data is missing', async () => {
    const res = await request(app)
      .post('/cvs')
      .send({ name: 'No Data CV' });
    expect(res.status).toBe(400);
  });
});

describe('GET /cvs/:id', () => {
  let localId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/cvs')
      .send({ name: 'Load Test', data: { currentLanguage: 'en' } });
    localId = res.body.id;
  });

  afterAll(async () => {
    if (localId) await request(app).delete(`/cvs/${localId}`);
  });

  it('returns the full CV record', async () => {
    const res = await request(app).get(`/cvs/${localId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(localId);
    expect(res.body.name).toBe('Load Test');
    expect(res.body.data.currentLanguage).toBe('en');
  });

  it('returns 400 for an invalid UUID', async () => {
    const res = await request(app).get('/cvs/not-a-uuid');
    expect(res.status).toBe(400);
  });

});

describe('PUT /cvs/:id', () => {
  let localId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/cvs')
      .send({ name: 'Before Update', data: { currentLanguage: 'fr' } });
    localId = res.body.id;
  });

  afterAll(async () => {
    if (localId) await request(app).delete(`/cvs/${localId}`);
  });

  it('updates the CV name and returns updated metadata', async () => {
    const res = await request(app)
      .put(`/cvs/${localId}`)
      .send({ name: 'After Update' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('After Update');
    expect(typeof res.body.updatedAt).toBe('number');
  });

  it('returns 400 for an invalid UUID', async () => {
    const res = await request(app).put('/cvs/bad-id').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown valid UUID', async () => {
    const res = await request(app)
      .put('/cvs/00000000-0000-0000-0000-000000000000')
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /cvs/:id', () => {
  let localId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/cvs')
      .send({ name: 'To Delete', data: {} });
    localId = res.body.id;
  });

  it('deletes the CV and returns success', async () => {
    const res = await request(app).delete(`/cvs/${localId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('returns 404 after the CV has been deleted', async () => {
    const res = await request(app).delete(`/cvs/${localId}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid UUID', async () => {
    const res = await request(app).delete('/cvs/not-a-uuid');
    expect(res.status).toBe(400);
  });
});
