import { test, expect } from '@playwright/test';
import { authenticate } from './helpers';

test.describe('Groups Flow', () => {
  test('user can create a new group', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: 'New Group' }).click();
    await expect(page).toHaveURL(/\/groups\/new/);

    await page.getByPlaceholder('e.g. Trip to Bali').fill('Trip to Bali');
    await page.getByPlaceholder('e.g. Bali trip').fill('Summer 2025 trip');
    await page.getByRole('button', { name: 'Create Group' }).click();

    // Should redirect back to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Trip to Bali')).toBeVisible();
  });

  test('group list shows empty state when no groups exist', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto('/dashboard');
    await expect(page.getByText('No groups yet')).toBeVisible();
    await expect(page.getByText('Create Your First Group').first()).toBeVisible();
  });
});
