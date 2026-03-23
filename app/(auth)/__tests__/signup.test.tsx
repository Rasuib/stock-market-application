import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import SignupPage from "../signup/page"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

const signInMock = vi.fn()
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}))

const signupMock = vi.fn()
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ signup: signupMock }),
}))

// Mock next/link to render a plain <a> so we can query href
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function getSubmitButton() {
  return screen.getAllByRole("button", { name: /create account/i })[0]
}

function fillForm(overrides: Partial<Record<"name" | "email" | "bio" | "password" | "confirmPassword", string>> = {}) {
  const values = {
    name: "Test User",
    email: "test@example.com",
    bio: "A short bio",
    password: "password123",
    confirmPassword: "password123",
    ...overrides,
  }

  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: values.name } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: values.email } })
  fireEvent.change(screen.getByLabelText(/bio/i), { target: { value: values.bio } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: values.password } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: values.confirmPassword } })
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the form with name, email, bio, password, and confirm password inputs", () => {
    render(<SignupPage />)

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it("shows error when passwords do not match", async () => {
    render(<SignupPage />)

    fillForm({ password: "password123", confirmPassword: "differentpassword" })
    fireEvent.click(getSubmitButton())

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match")
    expect(signupMock).not.toHaveBeenCalled()
  })

  it("shows error when password is too short (< 6 chars)", async () => {
    render(<SignupPage />)

    fillForm({ password: "abc", confirmPassword: "abc" })
    fireEvent.click(getSubmitButton())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password must be at least 6 characters"
    )
    expect(signupMock).not.toHaveBeenCalled()
  })

  it('redirects to /verify-email when signup returns "verify"', async () => {
    signupMock.mockResolvedValue("verify")
    render(<SignupPage />)

    fillForm()
    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(signupMock).toHaveBeenCalledWith("Test User", "test@example.com", "password123", "A short bio")
      expect(pushMock).toHaveBeenCalledWith("/verify-email")
    })
  })

  it("has a link to the login page", () => {
    render(<SignupPage />)

    const loginLink = screen.getByRole("link", { name: /sign in/i })
    expect(loginLink).toBeInTheDocument()
    expect(loginLink).toHaveAttribute("href", "/login")
  })

  it("has a GitHub OAuth button that calls signIn", () => {
    render(<SignupPage />)

    const githubButton = screen.getByRole("button", { name: /sign up with github/i })
    expect(githubButton).toBeInTheDocument()

    fireEvent.click(githubButton)
    expect(signInMock).toHaveBeenCalledWith("github", { callbackUrl: "/dashboard" })
  })
})
