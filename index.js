const axios = require('axios');
const ti = require('technicalindicators');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Forex & Crypto List
const forexPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'EURCHF', 'AUDUSD', 'NZDUSD', 'EURJPY', 'GBPJPY', 'AUDJPY'];
const cryptoCoins = ['bitcoin', 'ethereum', 'binancecoin', 'solana', 'ripple'];

async function fetchForexData(pair) {
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${pair}&interval=1h&outputsize=50&apikey=${process.env.FOREX_API_KEY}`;
    const response = await axios.get(url);
    if (response.data.values) {
      return response.data.values.map(candle => ({
        close: parseFloat(candle.close),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low)
      }));
    }
    console.error(`Error Forex ${pair}: Data kosong`);
    return null;
  } catch (error) {
    console.error(`Error Forex ${pair}:`, error.message);
    return null;
  }
}

async function fetchCryptoData(coin) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=1&interval=hourly`;
    const response = await axios.get(url);
    if (response.data.prices) {
      return response.data.prices.map(item => ({
        close: item[1]
      }));
    }
    console.error(`Error Crypto ${coin}: Data kosong`);
    return null;
  } catch (error) {
    console.error(`Error Crypto ${coin}:`, error.message);
    return null;
  }
}

function analyzeData(data) {
  if (!data || data.length < 20) return null;

  const closes = data.map(c => c.close);
  const highs = data.map(c => c.high || c.close);
  const lows = data.map(c => c.low || c.close);

  const rsi = ti.RSI.calculate({ values: closes, period: 14 });
  const macd = ti.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  const lastRsi = rsi[rsi.length - 1];
  const lastMacd = macd[macd.length - 1];

  if (lastRsi < 30 && lastMacd.histogram > 0) {
    return 'BUY';
  } else if (lastRsi > 70 && lastMacd.histogram < 0) {
    return 'SELL';
  } else {
    return null;
  }
}

async function main() {
  const signals = [];

  // Forex
  for (const pair of forexPairs) {
    const data = await fetchForexData(pair);
    const signal = analyzeData(data);
    if (signal) {
      signals.push(`Forex ${pair}: ${signal}`);
    }
  }

  // Crypto
  for (const coin of cryptoCoins) {
    const data = await fetchCryptoData(coin);
    const signal = analyzeData(data);
    if (signal) {
      signals.push(`Crypto ${coin}: ${signal}`);
    }
  }

  const message = signals.length > 0 ? `Sinyal Trading:\n\n${signals.join('\n')}` : 'Yah ga ada sinyal bosku.';
  await sendTelegram(message);
}

async function sendTelegram(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    });
    console.log('Sinyal terkirim!');
  } catch (error) {
    console.error('Gagal kirim Telegram:', error.message);
  }
}

main();
