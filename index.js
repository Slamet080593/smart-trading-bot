require('dotenv').config();
const axios = require('axios');
const https = require('https');
const { SMA, EMA, RSI, MACD, BollingerBands } = require('technicalindicators');
const { Resolver } = require('dns').promises;

// === SETTING ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Forex Pairs
const forexPairs = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "EUR/CHF", "AUD/USD", "NZD/USD",
  "EUR/JPY", "GBP/JPY", "AUD/JPY"
];

// Crypto coins
const cryptoCoins = [
  "bitcoin", "ethereum", "binancecoin", "solana", "ripple"
];

// Mapping Crypto symbol to Binance symbol
const binanceSymbols = {
  "bitcoin": "BTCUSDT",
  "ethereum": "ETHUSDT",
  "binancecoin": "BNBUSDT",
  "solana": "SOLUSDT",
  "ripple": "XRPUSDT"
};

// Create Cloudflare DNS Resolver
const resolver = new Resolver();
resolver.setServers(['1.1.1.1']);

// === FETCH FUNCTIONS ===
async function fetchForexData() {
  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD');
    return res.data.rates;
  } catch (error) {
    console.error("Error fetching Forex data:", error.message);
    return null;
  }
}

async function fetchCryptoPrice(symbol) {
  try {
    const addresses = await resolver.resolve4('api.binance.com');
    const ip = addresses[0];

    const agent = new https.Agent({
      lookup: (hostname, options, callback) => {
        callback(null, ip, 4);
      }
    });

    const binanceSymbol = binanceSymbols[symbol];
    const res = await axios.get(`https://${ip}/api/v3/ticker/price?symbol=${binanceSymbol}`, {
      httpsAgent: agent,
      headers: { 'Host': 'api.binance.com' }
    });

    return parseFloat(res.data.price);
  } catch (error) {
    console.error(`Error Crypto ${symbol}: ${error.message}`);
    return null;
  }
}

// === ANALISA FUNCTIONS ===
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
    console.log("Sinyal terkirim!");
  } catch (error) {
    console.error("Gagal kirim Telegram:", error.message);
  }
}

// === MAIN EXECUTE ===
async function main() {
  let message = "Sinyal Trading:\n\n";
  let hasSignal = false;

  const forexRates = await fetchForexData();
  if (forexRates) {
    for (const pair of forexPairs) {
      const [base, quote] = pair.split('/');
      try {
        if (forexRates[base] && forexRates[quote]) {
          const price = forexRates[quote] / forexRates[base];
          // Dummy data 30 prices untuk simulasi
          const prices = Array(30).fill(price);
          const analysis = simpleTechnicalAnalysis(prices);

          message += `<b>${pair}</b> ➔ Price: ${price.toFixed(4)}\n`;
          hasSignal = true;
        } else {
          console.error(`Error Forex ${pair}: Data kosong`);
        }
      } catch (err) {
        console.error(`Error Forex ${pair}: ${err.message}`);
      }
    }
  }

  for (const coin of cryptoCoins) {
    const price = await fetchCryptoPrice(coin);
    if (price) {
      // Dummy data 30 prices untuk simulasi
      const prices = Array(30).fill(price);
      const analysis = simpleTechnicalAnalysis(prices);

      message += `<b>${coin.toUpperCase()}</b> ➔ Price: ${price.toFixed(2)}\n`;
      hasSignal = true;
    }
  }

  if (!hasSignal) {
    message += "Yah ga ada sinyal bosku.";
  }

  await sendTelegram(message);
}

main();
