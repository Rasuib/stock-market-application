import time
import streamlit as st
import yfinance as yf
import plotly.graph_objects as go
from streamlit_autorefresh import st_autorefresh
from news_fetcher import get_headlines
from sentiment import analyze_sentiment, sentiment_score

import streamlit as st

# --- Page Config ---
st.set_page_config(layout="wide")
st.title("📈 Global Real-Time Stock Dashboard")

# --- Authentication Setup ---
USERS = {
    "devansh": "1234",
    "admin": "adminpass"
}

# --- Login Logic ---
if "authenticated" not in st.session_state:
    st.session_state["authenticated"] = False

if not st.session_state["authenticated"]:
    st.subheader("🔐 Login to Continue")

    with st.form("login_form"):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        login_button = st.form_submit_button("Login")

        if login_button:
            if USERS.get(username) == password:
                st.session_state["authenticated"] = True
                st.rerun()  # Instantly move to dashboard
            else:
                st.error("❌ Invalid credentials.")

    st.stop()


# --- Session Initialization ---
if "ticker" not in st.session_state:
    st.session_state["ticker"] = ""
if "headlines" not in st.session_state:
    st.session_state["headlines"] = None
if "sentiment" not in st.session_state:
    st.session_state["sentiment"] = None
if "balance" not in st.session_state:
    st.session_state.balance = 100000.0  # ₹1L
if "positions" not in st.session_state:
    st.session_state.positions = []

def resolve_indian_ticker(base_symbol):
    """Attempt to resolve Indian stock on NSE (.NS) or BSE (.BO)"""
    for suffix in ['.NS', '.BO']:
        full_ticker = base_symbol + suffix
        try:
            test_df = yf.Ticker(full_ticker).history(period="1d")
            if not test_df.empty:
                return full_ticker
        except:
            continue
    return base_symbol  # fallback to original if nothing found

# --- Ticker Input ---
input_ticker = st.text_input("Enter Stock Ticker (e.g., AAPL, RELIANCE, GLENMARK):")
if input_ticker:
    cleaned = input_ticker.strip().replace("$", "").upper()
    aliases = {
        "APPLE": "AAPL", "GOOGLE": "GOOG", "TESLA": "TSLA",
        "NVIDIA": "NVDA", "RELIANCE": "RELIANCE", "RAYMOND": "RAYMOND"
    }
    cleaned = aliases.get(cleaned, cleaned)

    # Resolve for Indian stocks if only base name is given
    if cleaned.isalpha():
        resolved = resolve_indian_ticker(cleaned)
        if resolved != cleaned:
            st.info(f"✅ Resolved to: `{resolved}`")
        cleaned = resolved

    st.session_state["ticker"] = cleaned
    st.session_state["headlines"] = None
    st.session_state["sentiment"] = None

ticker = st.session_state["ticker"]
is_indian = ticker.endswith(".NS")

# 🔁 Auto-refresh only chart every 5 seconds
st_autorefresh(interval=5000, key="price_chart_refresh")

# --- News + Sentiment ---
if ticker and st.session_state["headlines"] is None:
    symbol_for_news = ticker.replace(".NS", "").replace(".BO", "")
    headlines = get_headlines(symbol_for_news)
    if headlines:
        st.session_state["headlines"] = headlines
        st.session_state["sentiment"] = analyze_sentiment(headlines)

if st.session_state["headlines"]:
    st.subheader(f"📰 News for {ticker}")
    for hl in st.session_state["headlines"]:
        st.markdown(f"- {hl}")

    st.subheader("🧠 Sentiment Analysis")
    results = st.session_state["sentiment"]
    for hl, res in zip(st.session_state["headlines"], results):
        label = res['label']
        score = res['score']
        st.markdown(f"- **{label.capitalize()}** ({score:.2f}) → _{hl}_")

    avg = sentiment_score(results)

    def interpret(score):
        if score >= 0.5: return "🟢 Strong Positive"
        if score > 0.1: return "🟡 Mild Positive"
        if score > -0.1: return "⚪ Neutral"
        if score > -0.5: return "🟠 Mild Negative"
        return "🔴 Strong Negative"

    st.success(f"📊 Avg Sentiment Score: {avg:.2f}")
    st.info(f"🧾 Interpreted: **{interpret(avg)}**")

# --- Price Chart ---
if ticker:
    st.subheader(f"📈 {ticker} Price Chart (Auto-refresh every 5s)")

    time_range = st.selectbox(
        "Select Time Range",
        ["1D", "5D", "1M", "6M", "1Y", "5Y", "ALL"],
        index=0,
        key="period_selector"
    )

    period_map = {
        "1D": "1d", "5D": "5d", "1M": "1mo", "6M": "6mo",
        "1Y": "1y", "5Y": "5y", "ALL": "max"
    }

    interval_map = {
        "1D": "5m", "5D": "15m", "1M": "1d", "6M": "1d",
        "1Y": "1d", "5Y": "1wk", "ALL": "1mo"
    }

    selected_period = period_map[time_range]
    selected_interval = interval_map[time_range]

    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=selected_period, interval=selected_interval)

        if df.empty:
            st.warning("⚠️ No data available for this time range or stock.")
        else:
            current = df["Close"].iloc[-1]
            open_ = df["Close"].iloc[0]
            pct_change = ((current - open_) / open_) * 100

            st.metric(f"💲 {ticker} Price", f"{current:.2f}", f"{pct_change:.2f}%")

            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=df.index, y=df["Close"],
                mode="lines+markers", name="Price",
                line=dict(color="deepskyblue", width=2)
            ))
            fig.update_layout(
                title=f"{ticker} Price Chart ({time_range})",
                xaxis_title="Time",
                yaxis_title="Price (INR/₹)" if is_indian else "Price (USD)",
                height=450, template="plotly_dark"
            )
            st.plotly_chart(fig, use_container_width=True, key=f"{ticker}_{time_range}")
            st.caption(f"⏱️ Updated at {time.strftime('%H:%M:%S')}")
            # --- Trading Simulation Section ---
            st.subheader("🎯 Try Simulated Trading")

            col1, col2, col3 = st.columns(3)
            with col1:
                qty = st.number_input("Quantity", min_value=1, value=1, step=1)

            with col2:
                if st.button("💰 Buy"):
                    cost = qty * current
                    if cost <= st.session_state.balance:
                        st.session_state.balance -= cost
                        st.session_state.positions.append({
                            "type": "Buy",
                            "qty": qty,
                            "price": current,
                            "time": time.strftime("%H:%M:%S")
                        })
                        st.success(f"✅ Bought {qty} shares at ₹{current:.2f}")
                    else:
                        st.error("Insufficient funds.")

            with col3:
                if st.button("📤 Sell"):
                    owned = sum(p['qty'] for p in st.session_state.positions if p['type'] == "Buy") - \
                            sum(p['qty'] for p in st.session_state.positions if p['type'] == "Sell")
                    if qty <= owned:
                        st.session_state.balance += qty * current
                        st.session_state.positions.append({
                            "type": "Sell",
                            "qty": qty,
                            "price": current,
                            "time": time.strftime("%H:%M:%S")
                        })
                        st.success(f"✅ Sold {qty} shares at ₹{current:.2f}")
                    else:
                        st.error("Not enough shares to sell.")

            # Display current wallet
            st.markdown(f"💼 **Simulated Wallet Balance:** ₹{st.session_state.balance:,.2f}")

            # Display trade history
            if st.session_state.positions:
                st.subheader("📒 Trade History with Decision Evaluation")

                for i, t in enumerate(reversed(st.session_state.positions), 1):
                    qty = t["qty"]
                    price = t["price"]
                    action = t["type"]
                    time_ = t["time"]

                    # Evaluate real-time P/L
                    pnl = (current - price) if action == "Buy" else (price - current)
                    status = (
                        "🟢 Good Decision" if pnl > 0.5 else
                        "⚪ Neutral" if abs(pnl) <= 0.5 else
                        "🔴 Bad Decision"
                    )
                    direction = "↑" if pnl >= 0 else "↓"

                    # Emoji and line
                    emoji = "🟢" if action == "Buy" else "🔴"
                    st.markdown(
                        f"{emoji} {action} {qty} @ ₹{price:.2f} — {time_}  \n"
                        f"      📊 Now: ₹{current:.2f} | P/L: ₹{pnl:.2f} {direction} → **{status}**"
                    )

            # Evaluate decisions
            if st.button("📋 Evaluate My Decision"):
                profit = 0
                qty_owned = 0
                for trade in st.session_state.positions:
                    if trade["type"] == "Buy":
                        profit -= trade["qty"] * trade["price"]
                        qty_owned += trade["qty"]
                    elif trade["type"] == "Sell":
                        profit += trade["qty"] * trade["price"]
                        qty_owned -= trade["qty"]

                profit += qty_owned * current
                evaluation = "🟢 Good Decision" if profit > 0 else "🔴 Bad Decision" if profit < 0 else "⚪ Neutral"
                st.metric("💡 Net P&L (Simulated)", f"₹{profit:.2f}")
                st.info(f"📈 Decision Evaluation: **{evaluation}**")

            # --- Buy/Sell Button ---
            # -------------------------------
            # 📊 Multi-Stock Comparison Block
            # -------------------------------

            st.header("📊 Compare Multiple Stocks")
            multi_tickers = st.multiselect(
                "Select stocks to compare (NSE or Global):",
                options=["RELIANCE.NS", "TCS.NS", "INFY.NS", "AAPL", "TSLA", "GOOG", "NIFTYBEES.NS"],
                default=["RELIANCE.NS", "TCS.NS"]
            )

            if multi_tickers:
                period = "5d"
                interval = "1h"
                fig = go.Figure()

                for tick in multi_tickers:
                    try:
                        data = yf.Ticker(tick).history(period=period, interval=interval)
                        if not data.empty:
                            fig.add_trace(go.Scatter(
                                x=data.index,
                                y=data["Close"],
                                mode="lines",
                                name=tick
                            ))
                    except Exception as e:
                        st.warning(f"⚠️ Failed to load {tick}: {e}")

                fig.update_layout(
                    title="Multi-Stock Price Comparison (5D, 1H)",
                    xaxis_title="Time",
                    yaxis_title="Price",
                    height=500,
                    template="plotly_dark"
                )
                st.plotly_chart(fig, use_container_width=True)

                if st.checkbox("Show Sentiment for Selected Stocks"):
                    for tick in multi_tickers:
                        base = tick.replace(".NS", "").replace(".BO", "")
                        headlines = get_headlines(base)
                        if headlines:
                            sentiment = analyze_sentiment(headlines)
                            avg = sentiment_score(sentiment)
                            st.markdown(f"📰 **{tick} → Sentiment Score: `{avg:.2f}`**")
                        else:
                            st.markdown(f"📰 **{tick} → No news found**")

    except Exception as e:
        st.error(f"❌ Error loading chart: {e}")
