require('dotenv').config();
const axios = require('axios');
const { SMA, EMA, RSI, MACD, BollingerBands, ADX } = require('technicalindicators');

// === SETTING ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Forex Pairs
const forexPairs = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "EUR/CHF", "AUD/USD", "NZD/USD",
  "EUR/JPY", "GBP/JPY", "AUD/JPY"
];

// === FETCH FUNCTION (rebuild strategy) ===
async function fetchHistoricalRatesFromUSD(symbols) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  const url = `https://api.exchangerate.host/timeseries?start_date=${startDate}&end_date=${endDate}&base=USD&symbols=${symbols.join(',')}`;
  try {
    const res = await axios.get(url);
    return res.data.rates; // result is an object: { '2024-04-01': { EUR: 0.9, JPY: 110 }, ... }
  } catch (error) {
    console.error(`Gagal fetch data exchangerate.host:`, error.message);
    return null;
  }
}

// === ANALISA FUNCTION ===
function technicalAnalysis(prices) {
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
  const bb = BollingerBands.calculate({ period: 20, values: prices, stdDev: 2 });
  const adx = ADX.calculate({ close: prices, high: prices, low: prices, period: 14 });

  return { sma, ema, rsi, macd, bb, adx };
}

// === DECISION FUNCTION ===
function getTradeSignal({ rsi, bb, macd }, price) {
  const lastRSI = rsi[rsi.length - 1];
  const lastBB = bb[bb.length - 1];
  const lastMACD = macd[macd.length - 1];

  if (lastRSI < 30 && price < lastBB.lower && lastMACD.MACD > lastMACD.signal) {
    return 'BUY';
  } else if (lastRSI > 70 && price > lastBB.upper && lastMACD.MACD < lastMACD.signal) {
    return 'SELL';
  }
  return null;
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
  let message = "<b>Sinyal Trading Forex:</b>\n\n";
  let hasSignal = false;

  // ambil seluruh unique symbol dari pair
  const allSymbols = Array.from(
    new Set(forexPairs.flatMap(p => p.split('/')))
  );

  const historicalRates = await fetchHistoricalRatesFromUSD(allSymbols);
  if (!historicalRates) return;

  for (const pair of forexPairs) {
    const [base, quote] = pair.split('/');
    try {
      const prices = [];

      // hitung base/quote berdasarkan data dari USD
      for (const day of Object.keys(historicalRates)) {
        const rates = historicalRates[day];
        if (rates[base] && rates[quote]) {
          const baseToUSD = 1 / rates[base];
          const quoteToUSD = 1 / rates[quote];
          const price = quoteToUSD / baseToUSD;
          prices.push(price);
        }
      }

      if (prices.length < 30) {
        console.log(`Data tidak cukup untuk ${pair}`);
        continue;
      }

      const price = prices[prices.length - 1];
      const analysis = technicalAnalysis(prices);
      const signal = getTradeSignal(analysis, price);

      if (signal) {
        const tp = signal === 'BUY' ? price * 1.002 : price * 0.998;
        const sl = signal === 'BUY' ? price * 0.998 : price * 1.002;

        message += `
<b>${pair}</b>
📊 Aksi: <b>${signal}</b>
🎯 Entry: ${price.toFixed(4)}
🎯 TP: ${tp.toFixed(4)}
🛑 SL: ${sl.toFixed(4)}\n`;
        hasSignal = true;
      }
    } catch (err) {
      console.error(`Gagal proses ${pair}:`, err.message);
    }
  }

  if (!hasSignal) {
    message += "Tidak ada sinyal yang ditemukan.";
  }

  await sendTelegram(message);
}

main();
