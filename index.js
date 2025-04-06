const axios = require('axios');
const { SMA, RSI, MACD, Stochastic } = require('technicalindicators');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const forexPairs = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "EUR/CHF",
  "AUD/USD", "NZD/USD", "EUR/JPY", "GBP/JPY", "AUD/JPY"
];

const cryptoList = [
  "bitcoin", "ethereum", "binance-coin", "solana", "ripple"
];

// Helper untuk fetch data
async function fetchCryptoData(symbol) {
  try {
    const response = await axios.get(`https://api.coincap.io/v2/assets/${symbol}`);
    return parseFloat(response.data.data.priceUsd);
  } catch (error) {
    console.error(`Error Crypto ${symbol}: ${error.message}`);
    return null;
  }
}

async function fetchForexData(pair) {
  try {
    const [base, quote] = pair.split('/');
    const response = await axios.get(`https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`);
    return response.data.rates[quote];
  } catch (error) {
    console.error(`Error Forex ${pair}: ${error.message}`);
    return null;
  }
}

// Analisa teknikal
function analyze(priceHistory) {
  if (priceHistory.length < 20) return 'WAIT';

  const rsi = RSI.calculate({ values: priceHistory, period: 14 });
  const macd = MACD.calculate({
    values: priceHistory,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const sma5 = SMA.calculate({ values: priceHistory, period: 5 });
  const stoch = Stochastic.calculate({
    high: priceHistory,
    low: priceHistory,
    close: priceHistory,
    period: 14,
    signalPeriod: 3
  });

  const latestRSI = rsi[rsi.length - 1];
  const latestMACD = macd[macd.length - 1];
  const latestSMA5 = sma5[sma5.length - 1];
  const latestStoch = stoch[stoch.length - 1];

  let signals = [];

  if (latestRSI < 30) signals.push('BUY');
  else if (latestRSI > 70) signals.push('SELL');

  if (latestMACD && latestMACD.histogram > 0) signals.push('BUY');
  else if (latestMACD && latestMACD.histogram < 0) signals.push('SELL');

  if (priceHistory[priceHistory.length - 1] > latestSMA5) signals.push('BUY');
  else if (priceHistory[priceHistory.length - 1] < latestSMA5) signals.push('SELL');

  if (latestStoch && latestStoch.k < 20) signals.push('BUY');
  else if (latestStoch && latestStoch.k > 80) signals.push('SELL');

  const buySignals = signals.filter(x => x === 'BUY').length;
  const sellSignals = signals.filter(x => x === 'SELL').length;

  if (buySignals > sellSignals) return 'BUY';
  else if (sellSignals > buySignals) return 'SELL';
  else return 'WAIT';
}

// Kirim ke Telegram
async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    });
    console.log("Sinyal terkirim!");
  } catch (error) {
    console.error(`Gagal kirim Telegram: ${error.message}`);
  }
}

// Main process
async function main() {
  let messages = [];

  // Forex
  for (const pair of forexPairs) {
    const price = await fetchForexData(pair);
    if (price) {
      const fakeHistory = Array(50).fill(price * (1 + (Math.random() - 0.5) * 0.02));
      const signal = analyze(fakeHistory);
      if (signal !== 'WAIT') {
        messages.push(`Forex ${pair}: ${signal}`);
      }
    }
  }

  // Crypto
  for (const coin of cryptoList) {
    const price = await fetchCryptoData(coin);
    if (price) {
      const fakeHistory = Array(50).fill(price * (1 + (Math.random() - 0.5) * 0.02));
      const signal = analyze(fakeHistory);
      if (signal !== 'WAIT') {
        messages.push(`Crypto ${coin}: ${signal}`);
      }
    }
  }

  if (messages.length === 0) {
    await sendTelegram("Yah ga ada sinyal bosku.");
  } else {
    await sendTelegram("Auto generated by SmartBot:\n\n" + messages.join('\n'));
  }
}

main();
