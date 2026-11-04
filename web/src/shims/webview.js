// Iframe stand-in for the react-native-webview subset ArticleReader uses.
// Page scripts never get this app's origin: scripted frames are sandboxed to an
// opaque origin, and the same-origin reader frame has scripts disabled.
import React, {forwardRef, useEffect, useImperativeHandle, useRef} from 'react';
import {View} from 'react-native';

let nextId = 0;

// Lets injected code sit inside an inline <script> without closing it early
const inlineScript = (js) => `<script>${String(js).replace(/<\//g, '<\\/')}</script>`;

const bridge = (id) =>
  inlineScript(
    `window.ReactNativeWebView={postMessage:function(d){parent.postMessage({hbWebView:${id},data:String(d)},'*')}};`,
  );

const frameStyle = {border: 0, width: '100%', height: '100%', display: 'block', background: 'transparent'};

export const WebView = forwardRef(function WebView(
  {
    source,
    injectedJavaScript,
    javaScriptEnabled = true,
    onMessage,
    onShouldStartLoadWithRequest,
    onLoadStart,
    onLoadEnd,
    style,
  },
  ref,
) {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = ++nextId;
  const frameRef = useRef(null);
  const html = source?.html;
  const uri = source?.uri;

  // Cross-origin frames cannot take injected code; the reader treats that as no result
  useImperativeHandle(ref, () => ({injectJavaScript: () => {}, reload: () => {}}), []);

  useEffect(() => {
    if (!onMessage) return undefined;
    const handler = (e) => {
      if (e.source !== frameRef.current?.contentWindow || e.data?.hbWebView !== idRef.current) return;
      onMessage({nativeEvent: {data: e.data.data, url: uri || ''}});
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage, uri]);

  useEffect(() => {
    onLoadStart?.({nativeEvent: {url: uri || ''}});
    // Only mount-time changes of the page count as a new load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, uri]);

  // Link taps in the script-less reader go to the app, like onShouldStartLoadWithRequest
  const onLoad = () => {
    onLoadEnd?.({nativeEvent: {url: uri || ''}});
    if (html == null || javaScriptEnabled) return;
    const doc = frameRef.current?.contentDocument;
    doc?.addEventListener('click', (e) => {
      const link = e.target.closest && e.target.closest('a[href]');
      if (!link) return;
      e.preventDefault();
      onShouldStartLoadWithRequest?.({url: link.href});
    });
  };

  let frame;
  if (html != null && javaScriptEnabled) {
    frame = (
      <iframe
        ref={frameRef}
        title="webview"
        sandbox="allow-scripts"
        srcDoc={bridge(idRef.current) + html + (injectedJavaScript ? inlineScript(injectedJavaScript) : '')}
        onLoad={onLoad}
        style={frameStyle}
      />
    );
  } else if (html != null) {
    frame = (
      <iframe ref={frameRef} title="webview" sandbox="allow-same-origin" srcDoc={html} onLoad={onLoad} style={frameStyle} />
    );
  } else if (uri) {
    frame = (
      <iframe
        ref={frameRef}
        title="webview"
        sandbox="allow-scripts allow-same-origin allow-forms"
        src={uri}
        onLoad={onLoad}
        style={frameStyle}
      />
    );
  }
  return <View style={style}>{frame}</View>;
});

export default WebView;
