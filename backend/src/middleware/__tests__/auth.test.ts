import { requireAuth, optionalAuth } from '../auth';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

jest.mock('jsonwebtoken');
jest.mock('../../config', () => ({
  config: { JWT_SECRET: 'test-secret' },
}));

function mockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers: { ...headers } } as Partial<Request>;
}

function mockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('auth middleware', () => {
  describe('requireAuth', () => {
    it('should return 401 if no authorization header', () => {
      const req = mockReq({}) as any;
      const res = mockRes() as any;
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid authorization header' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if header does not start with Bearer', () => {
      const req = mockReq({ authorization: 'Basic abc123' }) as any;
      const res = mockRes() as any;
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', () => {
      const mockVerify = jest.mocked(jwt.verify);
      mockVerify.mockImplementation(() => { throw new Error('Invalid token'); });

      const req = mockReq({ authorization: 'Bearer invalid-token' }) as any;
      const res = mockRes() as any;
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with userId if token is valid', () => {
      const mockVerify = jest.mocked(jwt.verify);
      mockVerify.mockReturnValue({ userId: 42 } as any);

      const req = mockReq({ authorization: 'Bearer valid-token' }) as any;
      const res = mockRes() as any;
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(mockVerify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(req.userId).toBe(42);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should call next without userId if no auth header', () => {
      const req = mockReq({}) as any;
      const res = mockRes() as any;
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should set userId if valid token provided', () => {
      const mockVerify = jest.mocked(jwt.verify);
      mockVerify.mockReturnValue({ userId: 7 } as any);

      const req = mockReq({ authorization: 'Bearer good-token' }) as any;
      const res = mockRes() as any;
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(req.userId).toBe(7);
      expect(next).toHaveBeenCalled();
    });

    it('should call next without userId if token is invalid', () => {
      const mockVerify = jest.mocked(jwt.verify);
      mockVerify.mockImplementation(() => { throw new Error('bad'); });

      const req = mockReq({ authorization: 'Bearer bad-token' }) as any;
      const res = mockRes() as any;
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(req.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
