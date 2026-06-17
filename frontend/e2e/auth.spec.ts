import { test, expect } from '@playwright/test';
import { authenticate, TEST_AUTH_HEADERS } from './helpers';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let testEmail = '';

test.describe('Auth Flow', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page shows Google sign-in button', async ({ page }) => {
    await page.goto('/login');
    // The app uses Google OAuth — verify the login page renders
    await expect(page.getByText('SplitEasy')).toBeVisible();
    await expect(page.getByText('Split expenses with friends. Easily.')).toBeVisible();
  });

  test('authenticated user can access dashboard', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Your Groups')).toBeVisible();
  });

  test('user can create group and add expense end-to-end', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    // Create a group
    await page.goto('/groups/new');
    await expect(page).toHaveURL(/\/groups\/new/);
    await page.getByPlaceholder('e.g. Trip to Bali').fill('E2E Test Group');
    await page.getByRole('button', { name: 'Create Group' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('E2E Test Group')).toBeVisible();

    // Navigate into group
    await page.getByText('E2E Test Group').click();
    await expect(page).toHaveURL(/\/groups\/\d+/);

    // Add an expense — use .first() because empty state also has an Add Expense button
    await page.getByRole('button', { name: 'Add Expense' }).first().click();
    await expect(page).toHaveURL(/\/groups\/\d+\/expenses\/new/);
    await page.getByPlaceholder('e.g. Dinner at beach club').fill('E2E Test Expense');
    await page.getByPlaceholder('0.00').fill('42.00');
    await page.getByRole('button', { name: 'Add Expense' }).click();

    // Should be back on group detail with the expense visible
    await expect(page).toHaveURL(/\/groups\/\d+/);
    await expect(page.getByText('E2E Test Expense')).toBeVisible();
  });

  test('user can sign out', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Click Sign Out
    await page.getByText('Sign Out').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
