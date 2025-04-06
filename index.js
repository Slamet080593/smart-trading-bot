const axios = require('axios');
const { SMA, EMA, MACD, RSI, Stochastic, ADX } = require('technicalindicators');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const forexPairs = [
  { from: 'EUR', to: 'USD' },
  { from: 'GBP', to: 'USD' },
  { from: 'USD', to: 'JPY' },
  { from: 'USD', to: 'CHF' },
  { from: 'EUR', to: 'CHF' },
  { from: 'AUD', to: 'USD' },
  { from: 'NZD', to: 'USD' },
  { from: 'EUR', to: 'JPY' },
  { from: 'GBP', to: 'JPY' },
  { from: 'AUD', to: 'JPY' }
];

const cryptoSymbols = [
  'bitcoin',
  'ethereum',
  'binancecoin',
  'solana',
  'ripple'
];

async function fetchForex(from, to) {
  try {
    const url = `https://api.exchangerate.host/timeseries?start_date=${getPastDate(50)}&end_date=${getTodayDate()}&base=${from}&symbols=${to}`;
    const { data } = await axios.get(url);
    if (!data.rates) throw new Error('Data kosong');
    const prices = Object.values(data.rates).map(r => r[to]);
    return prices;
  } catch (error) {
    console.error(`Error Forex ${from}/${to}: ${error.message}`);
    return null;
  }
}

async function fetchCrypto(symbol) {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}USDT&interval=1d&limit=50`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const closePrices = data.map(candle => parseFloat(candle[4]));
    return closePrices;
  } catch (error) {
    console.error(`Error Crypto ${symbol}: ${error.message}`);
    return null;
  }
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getPastDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function analyze(prices) {
  if (prices.length < 30) return null;
  const sma = SMA.calculate({ period: 20, values: prices });
  const ema = EMA.calculate({ period: 20, values: prices });
  const macd = MACD.calculate({ 
    values: prices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const rsi = RSI.calculate({ period: 14, values: prices });
  const stochastic = Stochastic.calculate({
    high: prices,
    low: prices,
    close: prices,
    period: 14,
    signalPeriod: 3
  });
  const adx = ADX.calculate({
    close: prices,
    high: prices,
    low: prices,
    period: 14
  });

  const lastPrice = prices[prices.length - 1];
  const lastEMA = ema[ema.length - 1];
  const lastSMA = sma[sma.length - 1];
  const lastRSI = rsi[rsi.length - 1];

  if (lastEMA > lastSMA && lastRSI < 70) {
    return { signal: "BUY", tp: (lastPrice * 1.01).toFixed(4), sl: (lastPrice * 0.99).toFixed(4) };
  } else if (lastEMA < lastSMA && lastRSI > 30) {
    return { signal: "SELL", tp: (lastPrice * 0.99).toFixed(4), sl: (lastPrice * 1.01).toFixed(4) };
  } else {
    return null;
  }
}

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    });
    console.log("Sinyal terkirim!");
  } catch (error) {
    console.error("Gagal kirim Telegram:", error.message);
  }
}

async function runBot() {
  let messages = [];

  for (const pair of forexPairs) {
    const prices = await fetchForex(pair.from, pair.to);
    if (prices) {
      const analysis = analyze(prices);
      if (analysis) {
        messages.push(`Forex ${pair.from}/${pair.to} - ${analysis.signal}\nTP: ${analysis.tp}, SL: ${analysis.sl}`);
      }
    }
  }

  for (const symbol of cryptoSymbols) {
    const prices = await fetchCrypto(symbol);
    if (prices) {
      const analysis = analyze(prices);
      if (analysis) {
        messages.push(`Crypto ${symbol.toUpperCase()} - ${analysis.signal}\nTP: ${analysis.tp}, SL: ${analysis.sl}`);
      }
    }
  }

  if (messages.length === 0) {
    await sendTelegram('Yah ga ada sinyal bosku.');
  } else {
    await sendTelegram(messages.join('\n\n'));
  }
}

runBot();
