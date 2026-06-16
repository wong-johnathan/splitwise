import request from 'supertest';
import express from 'express';

jest.mock('../../db/pool', () => ({
  query: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = 1;
    next();
  },
  AuthRequest: {},
}));

describe('GET /users/search', () => {
  let app: express.Application;
  let mockQuery: jest.Mock;

  beforeAll(() => {
    mockQuery = require('../../db/pool').query;
    const usersRouter = require('../users').default;
    app = express();
    app.use(express.json());
    app.use('/', usersRouter);
  });

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns matching users for a search query', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 2, name: 'Alice Smith', email: 'alice@example.com' }],
    });

    const res = await request(app).get('/search?q=alice');

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]).toMatchObject({
      name: 'Alice Smith',
      email: 'alice@example.com',
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      expect.arrayContaining(['%alice%'])
    );
  });

  it('returns recent users when query is empty', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 3, name: 'Bob Jones', email: 'bob@example.com' },
        { id: 4, name: 'Carol White', email: 'carol@example.com' },
      ],
    });

    const res = await request(app).get('/search');

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('created_at DESC'),
      expect.any(Array)
    );
  });

  it('excludes the current user from results', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/search?q=test');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([1])
    );
  });

  it('returns empty array when no users match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/search?q=zzznomatch');

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });
});
