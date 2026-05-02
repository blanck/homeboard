// Yahoo Finance API via raw fetch (replaces yahoo-finance npm)

import {fetchJsonSafe} from '../utils/fetchSafe';

export const fetchQuotes = async (symbols) => {
  if (!symbols || symbols.length === 0) {
    return null;
  }

  const symbolsStr = symbols.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolsStr)}`;

  const data = await fetchJsonSafe(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (
    data &&
    data.quoteResponse &&
    data.quoteResponse.result
  ) {
      return data.quoteResponse.result.map((quote) => ({
        price: {
          symbol: quote.symbol,
          shortName: quote.shortName,
          currencySymbol: quote.currencySymbol || '$',
          regularMarketPrice: quote.regularMarketPrice,
          regularMarketChangePercent:
            quote.regularMarketChangePercent / 100, // normalize to 0-1
          regularMarketTime: quote.regularMarketTime
            ? new Date(quote.regularMarketTime * 1000).toISOString()
            : null,
          quoteType: quote.quoteType,
      },
    }));
  }
  return null;
};
