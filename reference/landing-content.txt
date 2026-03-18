import streamlit as st
from PIL import Image

# --- Page Config ---
st.set_page_config(
    page_title="Tradia - Stock Analysis for Beginners",
    page_icon="📊",
    layout="wide",
)

# --- App Header ---
st.markdown("""
    <h1 style='text-align: center; font-size: 3rem;'>📊 Tradia</h1>
    <h4 style='text-align: center; color: gray;'>Learn to Invest. Simulate Real Trades. Analyze Market Sentiment.</h4>
    <hr>
""", unsafe_allow_html=True)

# --- Introduction Section ---
col1, col2 = st.columns([2, 1])
with col1:
    st.markdown("""
        ### 🔍 What is Tradia?

        **Tradia** is a beginner-friendly and inclusive platform that:
        - Analyzes global & Indian stocks using **real-time sentiment analysis**
        - Provides a **virtual simulation** environment to practice trading
        - Offers predictions using **AI-powered LSTM models**
        - Makes stock investing **approachable for women and first-time investors**

        > “The market decides who wins or loses — we empower you to learn before you risk.”
    """)
with col2:
    st.image("https://www.kulfiy.com/wp-content/uploads/Brand-Awareness-e1626181070423.png.webp", width=450)

st.markdown("---")

# --- Features Section ---
st.markdown("### 🧰 Built With")
st.write("Streamlit, yFinance, TensorFlow/Keras, Plotly, BeautifulSoup, HuggingFace FinBERT")

st.markdown("### 🚀 Key Features")
features = [
    "📈 Real-Time Stock Sentiment Analysis",
    "🧠 LSTM-based Stock Price Prediction",
    "💹 Simulated Buy/Sell Trading with Feedback",
    "🇮🇳 NSE & BSE Compatibility",
    "📊 Interactive Plotly Charts",
    "🔐 Secure Login for Personalized Experience"
]
for f in features:
    st.markdown(f"- {f}")

# --- Workflow Section ---
with st.expander("🛠️ How it Works"):
    st.markdown("""
    1. Enter the stock ticker or choose from Indian stocks (NSE/BSE)
    2. View **real-time sentiment**, news headlines, and predictions
    3. Try the **simulation** to buy/sell virtually
    4. Get feedback on whether your trade was good!
    5. Track multiple stocks in one dashboard
    """)

# --- CTA Button ---
st.markdown("---")
st.markdown("<h3 style='text-align: center;'>📥 Ready to Begin?</h3>", unsafe_allow_html=True)

# Centering the button using empty columns
col1, col2, col3 = st.columns([4, 2, 4])  # Adjust weights as needed
with col2:
    go = st.button("👉 Go to Dashboard", use_container_width=True)
    if go:
        st.switch_page("pages/app.py")  # Must be in 'pages/' folder

# --- Footer ---
st.markdown("---")
st.markdown(
    "<p style='text-align: center; color: gray;'>© 2025 Tradia | Built with ❤️ by Devansh Shahane</p>",
    unsafe_allow_html=True
)
