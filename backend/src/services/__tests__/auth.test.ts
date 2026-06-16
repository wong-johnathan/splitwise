import { hashPassword, comparePassword, signToken } from '../auth';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');
jest.mock('../../config', () => ({
  config: {
    JWT_SECRET: 'test-secret',
  },
}));

describe('auth service', () => {
  describe('hashPassword', () => {
    it('should return a hashed string', async () => {
      const hash = await hashPassword('password123');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe('password123');
    });

    it('should produce different hashes for same input (different salts)', async () => {
      const hash1 = await hashPassword('samepass');
      const hash2 = await hashPassword('samepass');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      const hash = await hashPassword('mypassword');
      const result = await comparePassword('mypassword', hash);
      expect(result).toBe(true);
    });

    it('should return false for wrong passwords', async () => {
      const hash = await hashPassword('correctpass');
      const result = await comparePassword('wrongpass', hash);
      expect(result).toBe(false);
    });
  });

  describe('signToken', () => {
    it('should call jwt.sign with userId and secret', () => {
      const mockSign = jest.mocked(jwt.sign);
      mockSign.mockReturnValue('fake-token' as any);

      const token = signToken(42);

      expect(mockSign).toHaveBeenCalledWith({ userId: 42 }, 'test-secret', { expiresIn: '7d' });
      expect(token).toBe('fake-token');
    });
  });
});
