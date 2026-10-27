// The page a phone gets after scanning the setup QR code. Plain HTML + JS so
// any phone browser works; it talks to the tablet's setup server only.

const STRINGS = {
  en: {
    title: 'Homeboard setup',
    intro: 'Connect accounts here instead of typing on the wall display. Changes apply right away.',
    connected: 'Connected',
    notConnected: 'Not connected',
    connect: 'Connect',
    reconnect: 'Reconnect',
    spotifyDesc: 'Search Spotify and add playlists to the music buttons.',
    tibberDesc: 'Car battery, Homevolt and other devices linked in the Tibber app.',
    tokenTitle: 'Tibber prices',
    tokenDesc: 'Personal access token for electricity prices and live power. Get one at developer.tibber.com.',
    tokenPlaceholder: 'Paste token',
    save: 'Save',
    lmDesc: 'Coffee machine status and on/off.',
    email: 'Email',
    password: 'Password',
    logIn: 'Log in',
    pickMachine: 'Pick a machine',
    working: 'Working...',
    done: 'Done',
    failed: 'Something went wrong',
    footer: 'Keep the setup screen open on the wall display while you do this.',
  },
  sv: {
    title: 'Homeboard-inställning',
    intro: 'Anslut konton här i stället för att skriva på väggskärmen. Ändringar gäller direkt.',
    connected: 'Ansluten',
    notConnected: 'Inte ansluten',
    connect: 'Anslut',
    reconnect: 'Anslut igen',
    spotifyDesc: 'Sök på Spotify och lägg till spellistor på musikknapparna.',
    tibberDesc: 'Bilens batteri, Homevolt och andra enheter kopplade i Tibber-appen.',
    tokenTitle: 'Tibber-priser',
    tokenDesc: 'Personlig åtkomsttoken för elpriser och effekt i realtid. Skapa en på developer.tibber.com.',
    tokenPlaceholder: 'Klistra in token',
    save: 'Spara',
    lmDesc: 'Kaffemaskinens status och av/på.',
    email: 'E-post',
    password: 'Lösenord',
    logIn: 'Logga in',
    pickMachine: 'Välj maskin',
    working: 'Arbetar...',
    done: 'Klart',
    failed: 'Något gick fel',
    footer: 'Låt inställningsvyn vara öppen på väggskärmen medan du gör detta.',
  },
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

// connected: label of the account that just finished an OAuth round trip
export const renderSetupPage = ({base, lang, connected, error}) => {
  const t = STRINGS[lang] || STRINGS.en;
  const banner = error
    ? `<div class="banner bad">${escapeHtml(error)}</div>`
    : connected
      ? `<div class="banner good">${escapeHtml(connected)}: ${t.connected}</div>`
      : '';
  return `<!doctype html>
<html lang="${lang === 'sv' ? 'sv' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #111; color: #eee; font: 16px/1.4 -apple-system, system-ui, sans-serif; }
  main { max-width: 520px; margin: 0 auto; padding: 20px 16px 40px; }
  h1 { font-size: 22px; margin: 4px 0 6px; }
  .intro, .footer { color: #999; font-size: 14px; }
  .card { background: #1c1c1e; border-radius: 14px; padding: 16px; margin: 14px 0; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  h2 { font-size: 18px; margin: 0; }
  .desc { color: #999; font-size: 14px; margin: 6px 0 12px; }
  .pill { font-size: 13px; padding: 3px 10px; border-radius: 10px; background: #333; color: #aaa; white-space: nowrap; }
  .pill.on { background: #1f4d2a; color: #7ee08f; }
  .detail { color: #7ee08f; font-size: 14px; margin-top: 4px; }
  a.btn, button { display: block; width: 100%; box-sizing: border-box; text-align: center; border: 0; border-radius: 10px;
    padding: 14px; font-size: 17px; font-weight: 600; color: #fff; background: #0a84ff; text-decoration: none; margin-top: 8px; }
  a.btn.spotify { background: #1db954; }
  a.btn.secondary, button.secondary { background: #333; }
  input { width: 100%; box-sizing: border-box; padding: 13px; margin-top: 8px; border-radius: 10px; border: 1px solid #333;
    background: #000; color: #eee; font-size: 17px; }
  .banner { border-radius: 10px; padding: 12px; margin: 12px 0; font-weight: 600; }
  .banner.good { background: #1f4d2a; color: #b9f3c3; }
  .banner.bad { background: #5a1f1f; color: #ffc4c4; }
  .msg { font-size: 14px; margin-top: 8px; color: #ffb4b4; min-height: 1em; }
  .machines button { background: #333; }
</style>
</head>
<body>
<main>
  <h1>${t.title}</h1>
  <div class="intro">${t.intro}</div>
  ${banner}

  <div class="card">
    <div class="row"><h2>Spotify</h2><span class="pill" id="spotify-pill"></span></div>
    <div class="desc">${t.spotifyDesc}</div>
    <a class="btn spotify" id="spotify-btn" href="${base}/spotify">${t.connect}</a>
  </div>

  <div class="card">
    <div class="row"><h2>Tibber</h2><span class="pill" id="tibber-pill"></span></div>
    <div class="desc">${t.tibberDesc}</div>
    <div class="detail" id="tibber-detail"></div>
    <a class="btn" id="tibber-btn" href="${base}/tibber">${t.connect}</a>
  </div>

  <div class="card">
    <div class="row"><h2>${t.tokenTitle}</h2><span class="pill" id="token-pill"></span></div>
    <div class="desc">${t.tokenDesc}</div>
    <div class="detail" id="token-detail"></div>
    <form id="token-form">
      <input name="token" type="password" autocomplete="off" placeholder="${t.tokenPlaceholder}">
      <button type="submit">${t.save}</button>
      <div class="msg"></div>
    </form>
  </div>

  <div class="card">
    <div class="row"><h2>La Marzocco</h2><span class="pill" id="lm-pill"></span></div>
    <div class="desc">${t.lmDesc}</div>
    <div class="detail" id="lm-detail"></div>
    <form id="lm-form">
      <input name="email" type="email" autocomplete="username" placeholder="${t.email}">
      <input name="password" type="password" autocomplete="current-password" placeholder="${t.password}">
      <button type="submit">${t.logIn}</button>
      <div class="msg"></div>
    </form>
    <div class="machines" id="lm-machines"></div>
  </div>

  <div class="footer">${t.footer}</div>
</main>
<script>
  var BASE = ${JSON.stringify(base)};
  var T = ${JSON.stringify({connected: t.connected, notConnected: t.notConnected, connect: t.connect, reconnect: t.reconnect, working: t.working, done: t.done, failed: t.failed, pickMachine: t.pickMachine})};

  function pill(id, on) {
    var el = document.getElementById(id);
    el.textContent = on ? T.connected : T.notConnected;
    el.className = on ? 'pill on' : 'pill';
  }
  function text(id, value) { document.getElementById(id).textContent = value || ''; }

  function refresh() {
    fetch(BASE + '/status').then(function (r) { return r.json(); }).then(function (s) {
      pill('spotify-pill', s.spotify);
      document.getElementById('spotify-btn').textContent = s.spotify ? T.reconnect : T.connect;
      pill('tibber-pill', s.tibber);
      text('tibber-detail', s.tibberDevices);
      document.getElementById('tibber-btn').textContent = s.tibber ? T.reconnect : T.connect;
      pill('token-pill', s.tibberToken);
      text('token-detail', s.tibberHome);
      pill('lm-pill', s.lamarzocco);
      text('lm-detail', s.lamarzoccoMachine);
    }).catch(function () {});
  }

  // Bodies are percent-encoded JSON so they stay ASCII on the wire
  function post(path, data) {
    return fetch(BASE + path, {method: 'POST', body: encodeURIComponent(JSON.stringify(data))})
      .then(function (r) { return r.json(); });
  }

  function wire(formId, path, onResult) {
    var form = document.getElementById(formId);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = form.querySelector('.msg');
      var button = form.querySelector('button');
      var data = {};
      Array.prototype.forEach.call(form.querySelectorAll('input'), function (i) { data[i.name] = i.value.trim(); });
      msg.textContent = T.working;
      button.disabled = true;
      post(path, data).then(function (res) {
        msg.textContent = res.ok ? T.done : (res.error || T.failed);
        if (res.ok) Array.prototype.forEach.call(form.querySelectorAll('input[type=password]'), function (i) { i.value = ''; });
        if (onResult) onResult(res);
        refresh();
      }).catch(function () {
        msg.textContent = T.failed;
      }).then(function () { button.disabled = false; });
    });
  }

  wire('token-form', '/tibber-token');
  wire('lm-form', '/lamarzocco', function (res) {
    var box = document.getElementById('lm-machines');
    box.innerHTML = '';
    if (!res.machines || res.machines.length < 2) return;
    var label = document.createElement('div');
    label.className = 'desc';
    label.textContent = T.pickMachine;
    box.appendChild(label);
    res.machines.forEach(function (m) {
      var b = document.createElement('button');
      b.textContent = m.name;
      b.onclick = function () {
        post('/lamarzocco-machine', {serial: m.serial}).then(function () { box.innerHTML = ''; refresh(); });
      };
      box.appendChild(b);
    });
  });

  refresh();
  setInterval(refresh, 4000);
  if (location.search) history.replaceState(null, '', location.pathname);
</script>
</body>
</html>`;
};
