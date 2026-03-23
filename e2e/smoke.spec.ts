import { test, expect } from "@playwright/test"

test.describe("Smoke Tests", () => {
  test("homepage loads with correct title", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Tradia/)
  })

  test("landing page renders hero section", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("text=Learn to Trade")).toBeVisible({ timeout: 10_000 })
    await expect(page.locator("text=Without the Risk")).toBeVisible()
  })

  test("landing page has CTA buttons", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("text=START TRADING FREE")).toBeVisible({ timeout: 10_000 })
    await expect(page.locator("text=SIGN IN")).toBeVisible()
  })

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms")
    await expect(page.locator("text=Terms of Use")).toBeVisible()
    await expect(page.locator("text=Educational Purpose")).toBeVisible()
  })

  test("skip nav link works with keyboard", async ({ page }) => {
    await page.goto("/")
    await page.keyboard.press("Tab")
    const skipLink = page.locator("a[href='#main-content']")
    await expect(skipLink).toBeFocused()
  })
})

test.describe("Auth Pages", () => {
  test("login page renders form", async ({ page }) => {
    await page.goto("/login")
    await expect(page).toHaveTitle(/Tradia/)
    await expect(page.locator("text=Welcome Back")).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.locator("button[type='submit']")).toBeVisible()
  })

  test("login page has GitHub OAuth button", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator("text=Sign in with GitHub")).toBeVisible()
  })

  test("login page has forgot password link", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator("text=Forgot password?")).toBeVisible()
  })

  test("signup page renders form", async ({ page }) => {
    await page.goto("/signup")
    await expect(page.locator("text=Join Tradia")).toBeVisible()
    await expect(page.getByLabel("Full Name")).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel(/^Password$/)).toBeVisible()
    await expect(page.getByLabel("Confirm Password")).toBeVisible()
    await expect(page.locator("button[type='submit']")).toBeVisible()
  })

  test("signup page has GitHub OAuth button", async ({ page }) => {
    await page.goto("/signup")
    await expect(page.locator("text=Sign up with GitHub")).toBeVisible()
  })

  test("login/signup navigation links work", async ({ page }) => {
    await page.goto("/login")
    await page.locator("text=Sign up").click()
    await expect(page).toHaveURL(/\/signup/)

    await page.locator("text=Sign in").click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password")
    await expect(page.getByLabel("Email")).toBeVisible()
  })

  test("login shows error with invalid credentials", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("nonexistent@example.com")
    await page.getByLabel("Password").fill("wrongpassword")
    await page.locator("button[type='submit']").click()

    // Should show error (either from API or client validation)
    await expect(page.locator("[role='alert']")).toBeVisible({ timeout: 10_000 })
  })
})

test.describe("Protected Routes", () => {
  test("dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard")
    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test("profile redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/profile")
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
