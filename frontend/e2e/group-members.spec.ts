import { test, expect } from '@playwright/test';

const uniqueEmail = () => `members-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.describe('Group Members Flow', () => {
  test('Add Member dialog opens and search input renders', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');
    await page.getByText('Register').click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Your name').fill('Members Tester');
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Create a group first
    await page.getByRole('button', { name: 'New Group' }).click();
    await page.getByPlaceholder('e.g. Trip to Bali').fill('Member Test Group');
    await page.getByRole('button', { name: 'Create Group' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate into the group
    await page.getByText('Member Test Group').click();
    await expect(page).toHaveURL(/\/groups\/\d+/);

    // Open the dialog
    await page.getByRole('button', { name: 'Add Member' }).click();
    await expect(page.getByText('Add Member')).toBeVisible();
    await expect(page.getByPlaceholder('Search by name or email...')).toBeVisible();
  });

  test('Add Member dialog shows help text before searching', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');
    await page.getByText('Register').click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Your name').fill('Help Text Tester');
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: 'New Group' }).click();
    await page.getByPlaceholder('e.g. Trip to Bali').fill('Help Text Group');
    await page.getByRole('button', { name: 'Create Group' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByText('Help Text Group').click();
    await page.getByRole('button', { name: 'Add Member' }).click();
    await expect(page.getByText('Type to search users')).toBeVisible();
  });

  test('Add Member search accepts input', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');
    await page.getByText('Register').click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Your name').fill('Search Tester');
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: 'New Group' }).click();
    await page.getByPlaceholder('e.g. Trip to Bali').fill('Search Test Group');
    await page.getByRole('button', { name: 'Create Group' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByText('Search Test Group').click();
    await page.getByRole('button', { name: 'Add Member' }).click();

    const searchInput = page.getByPlaceholder('Search by name or email...');
    await searchInput.fill('nobody');
    await expect(searchInput).toHaveValue('nobody');
    // No other users in e2e environment — just confirm the search ran without crashing
    await expect(page.getByText('No users found')).toBeVisible({ timeout: 2000 });
  });

  test('new group creation shows member search field', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');
    await page.getByText('Register').click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Your name').fill('New Group Tester');
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: 'New Group' }).click();
    await expect(page).toHaveURL(/\/groups\/new/);
    await expect(page.getByPlaceholder('Search members to add...')).toBeVisible();
  });

  test('new group member search accepts input', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');
    await page.getByText('Register').click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Your name').fill('Search Input Tester');
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: 'New Group' }).click();
    const memberSearch = page.getByPlaceholder('Search members to add...');
    await memberSearch.fill('someone');
    await expect(memberSearch).toHaveValue('someone');
    // No other users in e2e — confirm no crash and shows no results
    await expect(page.getByText('No users found')).toBeVisible({ timeout: 2000 });
  });
});
