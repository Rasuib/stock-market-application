import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import LoginPage from "../login/page"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

const signInMock = vi.fn()
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}))

const loginMock = vi.fn()
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ login: loginMock }),
}))

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

/** Helper: get the credentials submit button (not the GitHub one) */
const getSubmitButton = () => screen.getByRole("button", { name: /^sign in$/i })

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the email input", () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it("renders the password input", () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it("renders the sign-in button", () => {
    render(<LoginPage />)
    expect(getSubmitButton()).toBeInTheDocument()
  })

  it("shows 'Invalid email or password' when login returns false", async () => {
    loginMock.mockResolvedValueOnce(false)
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrongpassword" } })
    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password")
    })
  })

  it("shows generic error when login throws", async () => {
    loginMock.mockRejectedValueOnce(new Error("network failure"))
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } })
    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("An error occurred. Please try again.")
    })
  })

  it("disables the submit button and shows loading text while submitting", async () => {
    loginMock.mockReturnValueOnce(new Promise(() => {}))
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } })
    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /signing in/i })
      expect(btn).toBeDisabled()
    })
  })

  it("has a link to the signup page", () => {
    render(<LoginPage />)
    const signupLink = screen.getByRole("link", { name: /sign up/i })
    expect(signupLink).toHaveAttribute("href", "/signup")
  })

  it("has a link to the forgot-password page", () => {
    render(<LoginPage />)
    const forgotLink = screen.getByRole("link", { name: /forgot password/i })
    expect(forgotLink).toHaveAttribute("href", "/forgot-password")
  })

  it("renders a GitHub sign-in button", () => {
    render(<LoginPage />)
    expect(screen.getByRole("button", { name: /sign in with github/i })).toBeInTheDocument()
  })

  it("calls signIn with 'github' when the GitHub button is clicked", () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole("button", { name: /sign in with github/i }))
    expect(signInMock).toHaveBeenCalledWith("github", { callbackUrl: "/dashboard" })
  })

  it("redirects to /dashboard on successful login", async () => {
    loginMock.mockResolvedValueOnce(true)
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "correctpassword" } })
    fireEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard")
    })
  })
})
