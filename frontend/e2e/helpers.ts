const API_URL = 'http://localhost:4000';
const TEST_AUTH_SECRET = 'spliteasy-e2e-test-secret';

export async function authenticate(email?: string, displayName?: string) {
  const safeEmail = email || `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  const safeName = displayName || 'E2E Test User';

  const response = await fetch(`${API_URL}/api/auth/test-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-auth': TEST_AUTH_SECRET,
    },
    body: JSON.stringify({ email: safeEmail, name: safeName }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Test auth failed (${response.status}): ${body}`);
  }

  return response.json();
}
