import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import yfinance as yf

st.set_page_config(page_title="Stock Analytics Dashboard", layout="wide")

# --------------------------
# THEME (DARK MAIN, LIGHT SIDEBAR)
# --------------------------
theme = st.sidebar.radio("Theme", ["Light Mode", "Dark Mode"])

if theme == "Dark Mode":
    st.markdown("""
    <style>
    .stApp {
        background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
    }

    .stApp * {
        color: white !important;
    }

    section[data-testid="stSidebar"] {
        background-color: white !important;
    }

    section[data-testid="stSidebar"] * {
        color: black !important;
    }

    div[data-testid="stMetric"] {
        background-color: rgba(255,255,255,0.08);
        padding: 15px;
        border-radius: 12px;
    }
    </style>
    """, unsafe_allow_html=True)

else:
    st.markdown("""
    <style>
    .stApp {
        background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
        color: black;
    }

    section[data-testid="stSidebar"] {
        background-color: white !important;
    }
    </style>
    """, unsafe_allow_html=True)

# --------------------------
# SIDEBAR
# --------------------------
st.sidebar.title("📊 Stock Dashboard")

data_source = st.sidebar.radio("Data Source", ["Live Market", "Upload CSV"])

analysis_option = st.sidebar.selectbox(
    "Analysis",
    [
        "Overview",
        "Candlestick",
        "Moving Average",
        "RSI",
        "MACD",
        "Volatility",
        "Returns",
        "Buy/Sell",
        "Risk",
        "ML Prediction"
    ]
)

# --------------------------
# SAFE NUMERIC
# --------------------------
def safe_numeric(df, col):
    data = df[col]
    if isinstance(data, pd.DataFrame):
        data = data.iloc[:, 0]
    return pd.to_numeric(data, errors="coerce")

# --------------------------
# LOAD DATA
# --------------------------
if data_source == "Live Market":

    ticker = st.sidebar.text_input("Ticker", "AAPL").upper()
    period = st.sidebar.selectbox("Period", ["3mo","6mo","1y","2y","5y"])

    df = yf.download(ticker, period=period, auto_adjust=True, progress=False)

    if df.empty:
        st.error("No data found")
        st.stop()

    df.reset_index(inplace=True)

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    date_col = "Date"
    price_col = "Close"
    high_col = "High"
    low_col = "Low"

else:
    file = st.sidebar.file_uploader("Upload CSV")

    if file is None:
        st.stop()

    df = pd.read_csv(file)
    df = df.loc[:, ~df.columns.duplicated()]

    date_col = st.sidebar.selectbox("Date", df.columns)
    num_cols = df.select_dtypes(include=['float64','int64']).columns

    price_col = st.sidebar.selectbox("Price", num_cols)
    high_col = st.sidebar.selectbox("High", num_cols)
    low_col = st.sidebar.selectbox("Low", num_cols)

# --------------------------
# PREPROCESS
# --------------------------
df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
df = df.sort_values(by=date_col)

df = df.fillna(method="ffill").fillna(method="bfill")

df[price_col] = safe_numeric(df, price_col)
df[high_col] = safe_numeric(df, high_col)
df[low_col] = safe_numeric(df, low_col)

# --------------------------
# KPI
# --------------------------
st.title("📈 Stock Analytics Dashboard")

col1, col2, col3 = st.columns(3)

col1.metric("📈 Latest Price", f"{df[price_col].iloc[-1]:.2f}")
col2.metric("🔺 Highest Price", f"{df[high_col].max():.2f}")
col3.metric("🔻 Lowest Price", f"{df[low_col].min():.2f}")

# --------------------------
# RISK CALCULATION (FIXED)
# --------------------------
df["Returns"] = df[price_col].pct_change()
df["Volatility"] = df["Returns"].rolling(20).std()

df["Risk_Score"] = df["Volatility"] / df["Volatility"].max()
df["Risk_Score"] = df["Risk_Score"].fillna(0)

avg_risk = df["Risk_Score"].mean()

if avg_risk < 0.3:
    risk_label = "Low 🟢"
elif avg_risk < 0.6:
    risk_label = "Medium 🟡"
else:
    risk_label = "High 🔴"

# --------------------------
# INSIGHTS
# --------------------------
st.markdown("## 🧠 Insights")

trend = "Uptrend 📈" if df[price_col].iloc[-1] > df[price_col].mean() else "Downtrend 📉"

st.markdown(f"""
<div style="background-color: rgba(255,255,255,0.1);
padding:15px;border-radius:10px;">
Trend: <b>{trend}</b><br>
Risk Score: <b>{avg_risk:.4f}</b><br>
Risk Level: <b>{risk_label}</b>
</div>
""", unsafe_allow_html=True)

template = "plotly_dark" if theme=="Dark Mode" else "plotly_white"

# --------------------------
# ANALYSIS
# --------------------------
if analysis_option == "Overview":
    fig = px.line(df, x=date_col, y=price_col)
    fig.update_layout(template=template)
    st.plotly_chart(fig)

elif analysis_option == "Candlestick":
    fig = go.Figure(data=[go.Candlestick(
        x=df[date_col],
        open=df["Open"],
        high=df["High"],
        low=df["Low"],
        close=df["Close"]
    )])
    fig.update_layout(template=template)
    st.plotly_chart(fig)
elif analysis_option == "Volatility":

    df["Returns"] = df[price_col].pct_change()
    df["Volatility"] = df["Returns"].rolling(20).std()

    fig = px.line(df, x=date_col, y="Volatility", title="Volatility Over Time")

    fig.update_layout(
        template=template,
        font=dict(color="white" if theme=="Dark Mode" else "black")
    )

    st.plotly_chart(fig, use_container_width=True)

elif analysis_option == "Returns":

    df["Returns"] = df[price_col].pct_change()

    fig = px.histogram(df, x="Returns", nbins=50, title="Returns Distribution")

    fig.update_layout(
        template=template,
        font=dict(color="white" if theme=="Dark Mode" else "black")
    )

    st.plotly_chart(fig, use_container_width=True)

elif analysis_option == "Moving Average":

    df["MA20"] = df[price_col].rolling(20).mean()
    df["MA50"] = df[price_col].rolling(50).mean()

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=df[date_col], y=df[price_col],
        name="Price"
    ))

    fig.add_trace(go.Scatter(
        x=df[date_col], y=df["MA20"],
        name="MA20"
    ))

    fig.add_trace(go.Scatter(
        x=df[date_col], y=df["MA50"],
        name="MA50"
    ))

    fig.update_layout(
        title="Moving Average Analysis",
        template=template,
        font=dict(color="white" if theme=="Dark Mode" else "black")
    )

    st.plotly_chart(fig, use_container_width=True)

elif analysis_option == "RSI":

    delta = df[price_col].diff()

    gain = np.where(delta > 0, delta, 0)
    loss = np.where(delta < 0, -delta, 0)

    avg_gain = pd.Series(gain).rolling(14).mean()
    avg_loss = pd.Series(loss).rolling(14).mean()

    rs = avg_gain / avg_loss
    df["RSI"] = 100 - (100 / (1 + rs))

    fig = px.line(df, x=date_col, y="RSI", title="RSI Indicator")

    fig.add_hline(y=70, line_dash="dash")
    fig.add_hline(y=30, line_dash="dash")

    fig.update_layout(
        template=template,
        font=dict(color="white" if theme=="Dark Mode" else "black")
    )

    st.plotly_chart(fig, use_container_width=True)

elif analysis_option == "MACD":

    ema12 = df[price_col].ewm(span=12, adjust=False).mean()
    ema26 = df[price_col].ewm(span=26, adjust=False).mean()

    df["MACD"] = ema12 - ema26
    df["Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=df[date_col], y=df["MACD"],
        name="MACD"
    ))

    fig.add_trace(go.Scatter(
        x=df[date_col], y=df["Signal"],
        name="Signal"
    ))

    fig.update_layout(
        title="MACD Indicator",
        template=template,
        font=dict(color="white" if theme=="Dark Mode" else "black")
    )

    st.plotly_chart(fig, use_container_width=True)

elif analysis_option == "Buy/Sell":

    df["MA20"] = df[price_col].rolling(20).mean()
    df["MA50"] = df[price_col].rolling(50).mean()

    df["Signal"] = np.where(df["MA20"] > df["MA50"], 1, 0)
    df["Position"] = df["Signal"].diff()

    fig = go.Figure()

    # Price line
    fig.add_trace(go.Scatter(
        x=df[date_col], y=df[price_col],
        name="Price"
    ))

    # Buy signals
    fig.add_trace(go.Scatter(
        x=df[df["Position"] == 1][date_col],
        y=df[df["Position"] == 1][price_col],
        mode="markers",
        marker=dict(color="green", size=10),
        name="Buy Signal"
    ))

    # Sell signals
    fig.add_trace(go.Scatter(
        x=df[df["Position"] == -1][date_col],
        y=df[df["Position"] == -1][price_col],
        mode="markers",
        marker=dict(color="red", size=10),
        name="Sell Signal"
    ))

    fig.update_layout(
        title="Buy / Sell Signals",
        template=template,
        font=dict(color="white" if theme=="Dark Mode" else "black")
    )

    st.plotly_chart(fig, use_container_width=True)

elif analysis_option == "ML Prediction":

    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import mean_squared_error, r2_score

    df["Target"] = df[price_col].shift(-1)
    df = df.dropna()

    X = df[[price_col]]
    y = df["Target"]

    model = LinearRegression()
    model.fit(X, y)

    predictions = model.predict(X)

    rmse = np.sqrt(mean_squared_error(y, predictions))
    r2 = r2_score(y, predictions)

    st.write(f"📉 RMSE: {rmse:.4f}")
    st.write(f"📊 R² Score: {r2:.4f}")

    # Plot
    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=df[date_col], y=y,
        name="Actual"
    ))

    fig.add_trace(go.Scatter(
        x=df[date_col], y=predictions,
        name="Predicted"
    ))

    fig.update_layout(
        title="ML Prediction (Actual vs Predicted)",
        template=template,
        font=dict(color="white" if theme=="Dark Mode" else "black")
    )

    st.plotly_chart(fig, use_container_width=True)


    

elif analysis_option == "Risk":
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=avg_risk,
        title={'text': "Risk Meter"},
        gauge={
            'axis': {'range': [0, 1]},
            'steps': [
                {'range': [0, 0.3], 'color': "green"},
                {'range': [0.3, 0.6], 'color': "yellow"},
                {'range': [0.6, 1], 'color': "red"}
            ]
        }
    ))
    st.plotly_chart(fig)

elif analysis_option == "ML Prediction":
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import mean_squared_error

    df["Target"] = df[price_col].shift(-1)
    df = df.dropna()

    X = df[[price_col]]
    y = df["Target"]

    model = LinearRegression().fit(X,y)
    pred = model.predict(X)

    st.write("RMSE:", np.sqrt(mean_squared_error(y,pred)))

elif analysis_option == "LSTM Prediction":
    import tensorflow as tf
    from sklearn.preprocessing import MinMaxScaler

    data = df[[price_col]].values
    scaler = MinMaxScaler()
    data = scaler.fit_transform(data)

    X,y=[],[]
    for i in range(50,len(data)):
        X.append(data[i-50:i])
        y.append(data[i])

    X,y=np.array(X),np.array(y)

    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(50),
        tf.keras.layers.Dense(1)
    ])
    model.compile("adam","mse")
    model.fit(X,y,epochs=3,verbose=0)

    st.success("LSTM Prediction Completed ✅")