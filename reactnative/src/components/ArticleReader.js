import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking} from 'react-native';
import {WebView} from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {translate} from '../utils/translations';
import {formatPublishedTime} from '../utils/formatting';
import {
  EXTRACT_PAGE,
  HIDE_ADS_SCRIPT,
  LIVE_EXTRACT_SCRIPT,
  buildReaderHtml,
  extractCall,
  stripScripts,
} from '../utils/readerView';

// Past this the page is treated as unreadable and shown as-is
const EXTRACT_TIMEOUT_MS = 15000;
// Chrome's reduced Android tablet UA; some sites turn away okhttp's default
const FETCH_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// Android injects scripts only after the whole page (ads included) has
// loaded, so the cleanup and live extractor are pushed in on a timer instead
const INJECT_INTERVAL_MS = 1000;
const INJECT_FOR_MS = 90000;

const isWebLink = (url) => /^https?:/i.test(url || '');
const isReadable = (url) => isWebLink(url) && !/\.pdf($|[?#])/i.test(url);
// Same story despite redirects that add www, a slash or tracking params
const pageKey = (url) =>
  String(url || '')
    .replace(/^https?:\/\/(www\.)?/i, '')
    .split(/[?#]/)[0]
    .replace(/\/$/, '');

const ArticleReader = ({article, lang, onClose}) => {
  const [mode, setMode] = useState('reader');
  const [readerHtml, setReaderHtml] = useState(null);
  // Script that hands the fetched HTML to the hidden parser
  const [extractJs, setExtractJs] = useState(null);
  const [pageUrl, setPageUrl] = useState(article.url);
  const [loading, setLoading] = useState(true);
  // Reading the article out of the original page after the fetch failed
  const [liveExtract, setLiveExtract] = useState(false);
  const touchedRef = useRef(false);
  const originalRef = useRef(null);
  // Bumped per page load so in-page navigation gets the timer again
  const [loadCount, setLoadCount] = useState(0);
  const extracting = mode === 'reader' && !readerHtml;

  useEffect(() => {
    setMode('reader');
    setReaderHtml(null);
    setPageUrl(article.url);
    setLoading(true);
    setLiveExtract(false);
  }, [article]);

  // A real browser gets past the bot walls (401/403) that turn away a plain
  // fetch, so the page opens as usual and the reader is pulled out of it
  const fallBack = useCallback(() => {
    touchedRef.current = false;
    setLiveExtract(true);
    setLoading(true);
    setMode('original');
  }, []);

  // Only the HTML is downloaded (a few dozen KB gzipped); the live page with
  // its ads and images can take a minute on the tablet's wifi
  useEffect(() => {
    if (!extracting) return undefined;
    setExtractJs(null);
    if (!isReadable(article.url)) {
      setMode('original');
      return undefined;
    }
    const controller = new AbortController();
    const fail = () => !controller.signal.aborted && fallBack();
    const timer = setTimeout(() => {
      controller.abort();
      fallBack();
    }, EXTRACT_TIMEOUT_MS);
    fetch(article.url, {
      headers: {'User-Agent': FETCH_USER_AGENT, Accept: 'text/html,application/xhtml+xml'},
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text().then((text) => {
          if (!controller.signal.aborted) setExtractJs(extractCall(stripScripts(text), res.url || article.url));
        });
      })
      .catch(fail);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [extracting, article, fallBack]);

  useEffect(() => {
    if (mode !== 'original') return undefined;
    const script = liveExtract ? HIDE_ADS_SCRIPT + LIVE_EXTRACT_SCRIPT : HIDE_ADS_SCRIPT;
    const inject = setInterval(() => originalRef.current?.injectJavaScript(script), INJECT_INTERVAL_MS);
    const stop = setTimeout(() => {
      clearInterval(inject);
      setLiveExtract(false);
    }, INJECT_FOR_MS);
    return () => {
      clearInterval(inject);
      clearTimeout(stop);
    };
  }, [mode, liveExtract, loadCount]);

  const parseMessage = (event) => {
    try {
      return JSON.parse(event.nativeEvent.data);
    } catch {
      return null;
    }
  };

  const toReaderHtml = (msg) => {
    const meta = [article.source?.name, article.publishedAt && formatPublishedTime(article.publishedAt)]
      .filter(Boolean)
      .join(' · ');
    return buildReaderHtml({article, html: msg.html, byline: msg.byline, meta});
  };

  const onExtracted = (event) => {
    const msg = parseMessage(event);
    if (!msg) return;
    if (msg.type === 'article' && msg.html) setReaderHtml(toReaderHtml(msg));
    else fallBack();
  };

  // Switches to the reader only if the page is still untouched; once someone
  // is reading or has followed a link, the result just waits behind the toggle
  const onLiveExtracted = (event) => {
    const msg = parseMessage(event);
    if (!msg) return;
    setLiveExtract(false);
    const touched = touchedRef.current;
    if (msg.type !== 'article' || !msg.html) return;
    if (touched && pageKey(event.nativeEvent.url) !== pageKey(article.url)) return;
    setReaderHtml(toReaderHtml(msg));
    if (!touched) setMode('reader');
  };

  // Links tapped in reader view open the real page here rather than leaving
  // a JavaScript-less copy that cannot follow them
  const onReaderNavigate = (req) => {
    if (req.url === 'about:blank' || req.url.startsWith('data:') || req.url === article.url) return true;
    if (isWebLink(req.url)) {
      setPageUrl(req.url);
      setLoading(true);
      setMode('original');
    }
    return false;
  };

  // App links (intent:, market:, app stores) would leave the dashboard
  const onOriginalNavigate = (req) => isWebLink(req.url) || req.url === 'about:blank';

  const showOriginal = mode === 'original';

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.source} numberOfLines={1}>
          {article.source?.name || ''}
        </Text>
        <View style={styles.toggle}>
          {['reader', 'original'].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              onPress={() => {
                if (m === 'original') setLoading(true);
                setMode(m);
              }}>
              <Icon
                name={m === 'reader' ? 'book-open-variant' : 'web'}
                size={18}
                color={mode === m ? '#ffffff' : '#9a9ab8'}
              />
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {translate(m === 'reader' ? 'readerView' : 'originalPage', lang)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => Linking.openURL(pageUrl)}
          hitSlop={8}>
          <Icon name="open-in-new" size={22} color="#9a9ab8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Icon name="close" size={30} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {showOriginal ? (
          // onTouchStart only observes, so the WebView still scrolls
          <View style={styles.body} onTouchStart={() => (touchedRef.current = true)}>
            <WebView
              key={pageUrl}
              ref={originalRef}
              source={{uri: pageUrl}}
              injectedJavaScriptBeforeContentLoaded={HIDE_ADS_SCRIPT}
              injectedJavaScript={HIDE_ADS_SCRIPT}
              onMessage={liveExtract ? onLiveExtracted : undefined}
              onShouldStartLoadWithRequest={onOriginalNavigate}
              setSupportMultipleWindows={false}
              mediaPlaybackRequiresUserAction
              onLoadStart={() => setLoadCount((n) => n + 1)}
              onLoadProgress={({nativeEvent}) => nativeEvent.progress > 0.4 && setLoading(false)}
              onLoadEnd={() => setLoading(false)}
              style={styles.web}
            />
          </View>
        ) : readerHtml ? (
          <WebView
            source={{html: readerHtml, baseUrl: article.url}}
            javaScriptEnabled={false}
            onShouldStartLoadWithRequest={onReaderNavigate}
            style={styles.web}
          />
        ) : extractJs ? (
          // Hidden parser for the fetched HTML; runs nothing from the page
          <View style={styles.extractor} pointerEvents="none">
            <WebView
              source={{html: EXTRACT_PAGE}}
              injectedJavaScript={extractJs}
              onMessage={onExtracted}
              onError={fallBack}
              style={styles.web}
            />
          </View>
        ) : null}
        {(!showOriginal && !readerHtml) || (showOriginal && loading) ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="large" color="#9a9ab8" />
            <Text style={styles.loadingText}>{translate('loadingArticle', lang)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 10,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a44',
  },
  source: {
    flex: 1,
    color: '#9a9ab8',
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#22223a',
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#3a3a5e',
  },
  toggleText: {
    color: '#9a9ab8',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  iconBtn: {
    padding: 8,
  },
  // Big target: this is how people get back to the dashboard
  closeBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3a3a5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  web: {
    flex: 1,
    backgroundColor: '#16162a',
  },
  extractor: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#16162a',
  },
  loadingText: {
    color: '#9a9ab8',
    fontSize: 15,
  },
});

export default ArticleReader;
