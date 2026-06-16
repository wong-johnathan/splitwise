import { test, expect } from '@playwright/test';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let testEmail = '';

test.describe('Auth Flow', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('user can register a new account', async ({ page }) => {
    testEmail = `${uniqueId()}@example.com`;
    await page.goto('/login');

    // Toggle to register
    await page.getByText('Register').click();

    // Fill registration form
    await page.getByPlaceholder('you@example.com').fill(testEmail);
    await page.getByPlaceholder('Your name').fill('Test User');
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');

    // Submit
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Your Groups')).toBeVisible();
  });

  test('user can login with existing account', async ({ page }) => {
    // Create a fresh user with a unique email
    const email = `${uniqueId()}@example.com`;

    // Register
    await page.goto('/login');
    await page.getByText('Register').click();
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Your name').fill('Login Tester');
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Logout
    await page.getByText('Sign Out').click();
    await expect(page).toHaveURL(/\/login/);

    // Login again with the same account
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('At least 6 characters').fill('testpass123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should be back on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
