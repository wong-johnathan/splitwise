import { test, expect } from '@playwright/test';

const TEST_EMAIL = `group-${Date.now()}@example.com`;

test.describe('Groups Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Register a new user before each test
    await page.goto('/login');
    await page.getByText('Register').click();
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('Your name').fill('Group Tester');
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('user can create a new group', async ({ page }) => {
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
    await expect(page.getByText('No groups yet')).toBeVisible();
    await expect(page.getByText('Create Your First Group')).toBeVisible();
  });
});
