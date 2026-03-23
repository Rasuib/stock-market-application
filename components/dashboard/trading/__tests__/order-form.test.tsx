import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import OrderForm from "../order-form"

function defaultProps() {
  return {
    currentPrice: 150.0,
    currencySymbol: "$",
    quantity: 1,
    onQuantityChange: vi.fn(),
    orderType: "market" as const,
    onOrderTypeChange: vi.fn(),
    limitPrice: null,
    onLimitPriceChange: vi.fn(),
    thesis: "",
    onThesisChange: vi.fn(),
    canBuy: true,
    canSell: false,
    insufficientBalance: false,
    limitPriceValid: true,
    onPreview: vi.fn(),
  }
}

describe("OrderForm", () => {
  afterEach(() => {
    cleanup()
  })

  // 1. Renders market/limit order type toggles with correct aria attributes
  it("renders market/limit order type toggles with correct aria attributes", () => {
    render(<OrderForm {...defaultProps()} />)

    const radioGroup = screen.getByRole("radiogroup", { name: "Order type" })
    expect(radioGroup).toBeInTheDocument()

    const marketRadio = screen.getByRole("radio", { name: "Market" })
    const limitRadio = screen.getByRole("radio", { name: "Limit" })

    expect(marketRadio).toBeInTheDocument()
    expect(limitRadio).toBeInTheDocument()

    // Market is selected by default
    expect(marketRadio).toHaveAttribute("aria-checked", "true")
    expect(limitRadio).toHaveAttribute("aria-checked", "false")
  })

  // 2. Toggles between market and limit order types
  it("toggles between market and limit order types", () => {
    const props = defaultProps()
    render(<OrderForm {...props} />)

    const limitRadio = screen.getByRole("radio", { name: "Limit" })
    fireEvent.click(limitRadio)

    expect(props.onOrderTypeChange).toHaveBeenCalledWith("limit")
    expect(props.onLimitPriceChange).toHaveBeenCalledWith(150.0)

    const marketRadio = screen.getByRole("radio", { name: "Market" })
    fireEvent.click(marketRadio)

    expect(props.onOrderTypeChange).toHaveBeenCalledWith("market")
  })

  // 3. Shows limit price input only when limit order is selected
  it("shows limit price input only when limit order is selected", () => {
    const props = defaultProps()

    // Market order: no limit price input
    const { rerender } = render(<OrderForm {...props} />)
    expect(screen.queryByLabelText("Limit Price")).not.toBeInTheDocument()

    // Limit order: limit price input appears
    rerender(<OrderForm {...props} orderType="limit" limitPrice={150.0} />)
    const limitInput = screen.getByLabelText("Limit Price")
    expect(limitInput).toBeInTheDocument()
    expect(limitInput).toHaveValue(150.0)
  })

  // 4. Renders quantity input with estimated total
  it("renders quantity input with estimated total", () => {
    render(<OrderForm {...defaultProps()} quantity={5} />)

    const qtyInput = screen.getByLabelText("Quantity")
    expect(qtyInput).toBeInTheDocument()
    expect(qtyInput).toHaveValue(5)

    // 5 * 150.00 = 750
    expect(screen.getByText(/Est\. total:/)).toBeInTheDocument()
    expect(screen.getByText(/\$750/)).toBeInTheDocument()
  })

  // 5. Buy and sell buttons disabled when canBuy/canSell are false
  it("disables buy button when canBuy is false", () => {
    render(<OrderForm {...defaultProps()} canBuy={false} canSell={false} />)

    const buyButton = screen.getByRole("button", { name: /buy/i })
    const sellButton = screen.getByRole("button", { name: /sell/i })

    expect(buyButton).toBeDisabled()
    expect(sellButton).toBeDisabled()
  })

  it("enables buy button when canBuy is true and sell button when canSell is true", () => {
    render(<OrderForm {...defaultProps()} canBuy={true} canSell={true} />)

    const buyButton = screen.getByRole("button", { name: /buy/i })
    const sellButton = screen.getByRole("button", { name: /sell/i })

    expect(buyButton).toBeEnabled()
    expect(sellButton).toBeEnabled()
  })

  // 6. Calls onPreview("buy") and onPreview("sell") when buttons clicked
  it('calls onPreview("buy") when buy button is clicked', () => {
    const props = defaultProps()
    render(<OrderForm {...props} canBuy={true} />)

    const buyButton = screen.getByRole("button", { name: /buy/i })
    fireEvent.click(buyButton)

    expect(props.onPreview).toHaveBeenCalledWith("buy")
  })

  it('calls onPreview("sell") when sell button is clicked', () => {
    const props = defaultProps()
    render(<OrderForm {...props} canSell={true} />)

    const sellButton = screen.getByRole("button", { name: /sell/i })
    fireEvent.click(sellButton)

    expect(props.onPreview).toHaveBeenCalledWith("sell")
  })

  it("does not call onPreview when disabled buttons are clicked", () => {
    const props = defaultProps()
    render(<OrderForm {...props} canBuy={false} canSell={false} />)

    const buyButton = screen.getByRole("button", { name: /buy/i })
    const sellButton = screen.getByRole("button", { name: /sell/i })

    fireEvent.click(buyButton)
    fireEvent.click(sellButton)

    expect(props.onPreview).not.toHaveBeenCalled()
  })

  // 7. Shows insufficient balance warning when insufficientBalance is true
  it("shows insufficient balance warning when insufficientBalance is true", () => {
    render(<OrderForm {...defaultProps()} insufficientBalance={true} />)

    expect(
      screen.getByText("Not enough balance for this order.")
    ).toBeInTheDocument()
  })

  it("does not show insufficient balance warning when insufficientBalance is false", () => {
    render(<OrderForm {...defaultProps()} insufficientBalance={false} />)

    expect(
      screen.queryByText("Not enough balance for this order.")
    ).not.toBeInTheDocument()
  })

  // 8. Shows thesis character count warning
  it("shows character count warning when thesis is between 1 and 9 characters", () => {
    render(<OrderForm {...defaultProps()} thesis="abc" />)

    // 10 - 3 = 7 more characters needed
    expect(screen.getByText("7 more characters needed")).toBeInTheDocument()
  })

  it("does not show character count warning when thesis is empty", () => {
    render(<OrderForm {...defaultProps()} thesis="" />)

    expect(
      screen.queryByText(/more characters needed/)
    ).not.toBeInTheDocument()
  })

  it("does not show character count warning when thesis has 10 or more characters", () => {
    render(<OrderForm {...defaultProps()} thesis="Long enough" />)

    expect(
      screen.queryByText(/more characters needed/)
    ).not.toBeInTheDocument()
  })

  it("shows correct remaining count at boundary (1 character)", () => {
    render(<OrderForm {...defaultProps()} thesis="x" />)

    expect(screen.getByText("9 more characters needed")).toBeInTheDocument()
  })

  it("shows correct remaining count at boundary (9 characters)", () => {
    render(<OrderForm {...defaultProps()} thesis="abcdefghi" />)

    expect(screen.getByText("1 more characters needed")).toBeInTheDocument()
  })
})
