require('dotenv').config();
const axios = require('axios');
const { SMA, EMA, RSI, MACD, BollingerBands } = require('technicalindicators');

// === SETTING ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

const forexPairs = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "EUR/CHF", "AUD/USD", "NZD/USD",
  "EUR/JPY", "GBP/JPY", "AUD/JPY"
];

// === FETCH HISTORICAL DATA ===
async function fetchHistoricalPrices(pair) {
  const symbol = pair.replace("/", "");
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1h&outputsize=60&apikey=${TWELVE_DATA_API_KEY}`;

  try {
    const res = await axios.get(url);
    const data = res.data?.values;
    if (!data) throw new Error(res.data.message || "No data");
    const prices = data.map(item => parseFloat(item.close)).reverse();
    return prices;
  } catch (err) {
    console.error(`❌ Error fetch ${pair}:`, err.message);
    return null;
  }
}

// === ANALISIS ===
function simpleTechnicalAnalysis(prices) {
  const sma50 = SMA.calculate({ period: 50, values: prices });
  const ema14 = EMA.calculate({ period: 14, values: prices });
  const rsi = RSI.calculate({ period: 14, values: prices });
  const macd = MACD.calculate({
    values: prices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const bb = BollingerBands.calculate({
    period: 20,
    values: prices,
    stdDev: 2
  });

  return { sma50, ema14, rsi, macd, bb };
}

// === TELEGRAM ===
async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
    console.log("✅ Sinyal dikirim");
  } catch (err) {
    console.error("❌ Gagal kirim Telegram:", err.message);
  }
}

// === SIGNAL LOGIC ===
function generateSignal(price, rsi, macd, bb) {
  const macdHist = macd[macd.length - 1]?.histogram || 0;
  const rsiVal = rsi[rsi.length - 1];
  const bbLast = bb[bb.length - 1];

  if (rsiVal < 30 && macdHist > 0 && price < bbLast.lower) {
    return "BUY";
  } else if (rsiVal > 70 && macdHist < 0 && price > bbLast.upper) {
    return "SELL";
  }
  return null;
}

// === MAIN ===
async function main() {
  let message = "📊 <b>Sinyal Trading Forex:</b>\n\n";
  let hasSignal = false;

  for (const pair of forexPairs) {
    const prices = await fetchHistoricalPrices(pair);
    if (!prices || prices.length < 30) continue;

    const analysis = simpleTechnicalAnalysis(prices);
    const price = prices[prices.length - 1];
    const signal = generateSignal(price, analysis.rsi, analysis.macd, analysis.bb);

    if (signal) {
      const tp = signal === 'BUY' ? price * 1.002 : price * 0.998;
      const sl = signal === 'BUY' ? price * 0.998 : price * 1.002;

      message += `
<b>${pair}</b>
Aksi: ${signal}
Entry: ${price.toFixed(4)}
TP: ${tp.toFixed(4)}
SL: ${sl.toFixed(4)}\n\n`;

      hasSignal = true;
    }
  }

  if (!hasSignal) {
    message += "Tidak ada sinyal yang ditemukan.";
  }

  await sendTelegram(message);
}

main();
