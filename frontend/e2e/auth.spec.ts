import { test, expect } from '@playwright/test';

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_NAME = 'Test User';

test.describe('Auth Flow', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('user can register a new account', async ({ page }) => {
    await page.goto('/login');

    // Toggle to register
    await page.getByText('Register').click();

    // Fill registration form
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('Your name').fill(TEST_NAME);
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');

    // Submit
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Your Groups')).toBeVisible();
  });

  test('user can login with existing account', async ({ page }) => {
    // First register
    await page.goto('/login');
    await page.getByText('Register').click();
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('Your name').fill(TEST_NAME);
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Logout
    await page.getByText('Sign Out').click();
    await expect(page).toHaveURL(/\/login/);

    // Login again
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should be back on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
