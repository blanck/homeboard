// Yahoo Finance chart endpoint, one request per symbol. The batch v7 quote
// endpoint has required a login cookie since 2023 and answers 401.

import {fetchJsonSafe} from '../utils/fetchSafe';

const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  CHF: 'CHF',
};

const fetchQuote = async (symbol) => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const data = await fetchJsonSafe(url, {headers: {'User-Agent': 'Mozilla/5.0'}});
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) return null;
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  return {
    price: {
      symbol: meta.symbol || symbol,
      shortName: meta.shortName || meta.longName || symbol,
      currencySymbol: CURRENCY_SYMBOLS[meta.currency] || meta.currency || '',
      regularMarketPrice: meta.regularMarketPrice,
      // 0-1 fraction, like the old quote API after normalising
      regularMarketChangePercent: prev ? (meta.regularMarketPrice - prev) / prev : 0,
      regularMarketTime: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
      quoteType: meta.instrumentType,
    },
  };
};

export const fetchQuotes = async (symbols) => {
  if (!symbols || symbols.length === 0) return null;
  const quotes = (await Promise.all(symbols.map(fetchQuote))).filter(Boolean);
  return quotes.length ? quotes : null;
};
