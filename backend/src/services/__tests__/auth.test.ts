import { signToken } from '../auth';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');
jest.mock('../../config', () => ({
  config: {
    JWT_SECRET: 'test-secret',
  },
}));

describe('auth service', () => {
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
