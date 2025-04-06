require('dotenv').config();
const axios = require('axios');
const { SMA, EMA, RSI, MACD, BollingerBands } = require('technicalindicators');

// === SETTING ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Forex Pairs
const forexPairs = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "EUR/CHF", "AUD/USD", "NZD/USD",
  "EUR/JPY", "GBP/JPY", "AUD/JPY"
];

// === FETCH FUNCTION ===
async function fetchForexData() {
  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD');
    return res.data.rates;
  } catch (error) {
    console.error("Error fetching Forex data:", error.message);
    return null;
  }
}

// === ANALISA FUNCTION ===
function simpleTechnicalAnalysis(prices) {
  const sma = SMA.calculate({ period: 14, values: prices });
  const ema = EMA.calculate({ period: 14, values: prices });
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

  return { sma, ema, rsi, macd, bb };
}

// === TELEGRAM FUNCTION ===
async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });
    console.log("Sinyal Forex berhasil dikirim!");
  } catch (error) {
    console.error("Gagal kirim Telegram:", error.message);
  }
}

// === MAIN EXECUTION ===
async function main() {
  let message = "Sinyal Trading Forex:\n\n";
  let hasSignal = false;

  const forexRates = await fetchForexData();
  if (forexRates) {
    for (const pair of forexPairs) {
      const [base, quote] = pair.split('/');
      try {
        if (forexRates[base] && forexRates[quote]) {
          const price = forexRates[quote] / forexRates[base];
          const prices = Array(30).fill(price); // Dummy data

          const analysis = simpleTechnicalAnalysis(prices);

          const latestRSI = analysis.rsi[analysis.rsi.length - 1];
          const latestSMA = analysis.sma[analysis.sma.length - 1];

          // Tentukan aksi
          let action = '';
          if (latestRSI && latestSMA) {
            if (latestRSI < 30 && price < latestSMA) {
              action = 'BUY';
            } else if (latestRSI > 70 && price > latestSMA) {
              action = 'SELL';
            }
          }

          if (action) {
            // Ambil nilai TP dan SL
            const tp = (action === 'BUY' ? price * 1.002 : price * 0.998).toFixed(4);
            const sl = (action === 'BUY' ? price * 0.998 : price * 1.002).toFixed(4);

            message += `<b>${pair}</b>\n📊 Crypto Signal\nAksi: <b>${action}</b>\nEntry: ${price.toFixed(4)}\nTP: ${tp}\nSL: ${sl}\n\n`;
            hasSignal = true;
          }

        } else {
          console.error(`Data kosong untuk pasangan ${pair}`);
        }
      } catch (error) {
        console.error(`Error processing Forex ${pair}:`, error.message);
      }
    }
  }

  if (!hasSignal) {
    message += "Tidak ada sinyal yang ditemukan.";
  }

  await sendTelegram(message);
}

main();
