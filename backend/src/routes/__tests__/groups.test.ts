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

jest.mock('../../services/balance', () => ({
  simplifyDebts: jest.fn().mockReturnValue([]),
}));

describe('POST /groups/:id/members', () => {
  let app: express.Application;
  let mockQuery: jest.Mock;

  beforeAll(() => {
    mockQuery = require('../../db/pool').query;
    const groupsRouter = require('../groups').default;
    app = express();
    app.use(express.json());
    app.use('/', groupsRouter);
  });

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns 201 with member info for a valid user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [{}] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Alice', email: 'alice@example.com' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/5/members').send({ userId: 2 });

    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({
      id: 2,
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('returns 404 when the target user does not exist', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [{}] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/5/members').send({ userId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('returns 404 when the group does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/999/members').send({ userId: 2 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Group not found');
  });

  it('returns 403 when requester is not a group member', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/5/members').send({ userId: 2 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not a member of this group');
  });

  it('returns 400 when userId is missing', async () => {
    const res = await request(app).post('/5/members').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('userId is required');
  });
});
