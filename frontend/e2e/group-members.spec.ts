import { test, expect } from '@playwright/test';
import { authenticate } from './helpers';

test.describe('Group Members Flow', () => {
  test('Add Member dialog opens and search input renders', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    // Create a group first
    await page.goto('/groups/new');
    await page.getByPlaceholder('e.g. Trip to Bali').fill('Member Test Group');
    await page.getByRole('button', { name: 'Create Group' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate into the group
    await page.getByText('Member Test Group').click();
    await expect(page).toHaveURL(/\/groups\/\d+/);

    // Open the dialog
    await page.getByRole('button', { name: 'Add Member' }).click();
    await expect(page.getByRole('heading', { name: 'Add Member' })).toBeVisible();
    await expect(page.getByPlaceholder('Search by name or email...')).toBeVisible();
  });

  test('Add Member dialog shows help text before searching', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto('/groups/new');
    await page.getByPlaceholder('e.g. Trip to Bali').fill('Help Text Group');
    await page.getByRole('button', { name: 'Create Group' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByText('Help Text Group').click();
    await page.getByRole('button', { name: 'Add Member' }).click();
    await expect(page.getByText('Type to search users')).toBeVisible();
  });

  test('Add Member search accepts input', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto('/groups/new');
    await page.getByPlaceholder('e.g. Trip to Bali').fill('Search Test Group');
    await page.getByRole('button', { name: 'Create Group' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByText('Search Test Group').click();
    await page.getByRole('button', { name: 'Add Member' }).click();

    const searchInput = page.getByPlaceholder('Search by name or email...');
    await searchInput.fill('nobody');
    await expect(searchInput).toHaveValue('nobody');
    await expect(page.getByText('No users found')).toBeVisible({ timeout: 5000 });
  });

  test('new group creation shows member search field', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto('/groups/new');
    await expect(page).toHaveURL(/\/groups\/new/);
    await expect(page.getByPlaceholder('Search members to add...')).toBeVisible();
  });

  test('new group member search accepts input', async ({ page }) => {
    const { token } = await authenticate();
    await page.addInitScript((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto('/groups/new');
    const memberSearch = page.getByPlaceholder('Search members to add...');
    await memberSearch.fill('someone');
    await expect(memberSearch).toHaveValue('someone');
    await expect(page.getByText('No users found')).toBeVisible({ timeout: 5000 });
  });
});
