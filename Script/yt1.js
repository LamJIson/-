var YT_KEY_STORE = "youtube:initplayback:keys:v1";
var YT_REFRESH_STORE = "youtube:initplayback:refresh:v1";

function ytLoadKeys() {
  try {
    var raw = Anywhere.store.getString(YT_KEY_STORE);
    var value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter(function (item) {
      return item && typeof item.clientKey === "string" && typeof item.encryptKey === "string";
    }).slice(0, 4) : [];
  } catch (_) { return []; }
}

function ytSaveKeys(keys) {
  try { Anywhere.store.set(YT_KEY_STORE, JSON.stringify(keys.slice(0, 4))); } catch (_) {}
}

function ytField(entries, field) {
  if (!Array.isArray(entries)) return null;
  for (var i = entries.length - 1; i >= 0; i--) {
    if (entries[i].field === field && entries[i].wire === 2 && entries[i].value instanceof Uint8Array) return entries[i].value;
  }
  return null;
}

function ytNested(bytes, fields) {
  var current = bytes;
  for (var i = 0; i < fields.length; i++) {
    current = ytField(Anywhere.codec.protobuf.decode(current), fields[i]);
    if (!current) return null;
  }
  return current;
}

function ytCaptureKeys(body) {
  try {
    var onesie = ytNested(body, [1, 16, 7, 138536474, 146311580]);
    if (!onesie) return false;
    var entries = Anywhere.codec.protobuf.decode(onesie);
    var client = ytField(entries, 1);
    var encrypt = ytField(entries, 2);
    if (!client || !client.length || !encrypt || !encrypt.length) return false;
    var pair = {
      clientKey: Anywhere.codec.base64.encode(client),
      encryptKey: Anywhere.codec.base64.encode(encrypt)
    };
    var keys = ytLoadKeys().filter(function (item) {
      return item.clientKey !== pair.clientKey || item.encryptKey !== pair.encryptKey;
    });
    keys.unshift(pair);
    ytSaveKeys(keys);
    Anywhere.store.delete(YT_REFRESH_STORE);
    return true;
  } catch (_) { return false; }
}

function ytInitClientKey(body) {
  try { return ytNested(body, [3, 5]); } catch (_) { return null; }
}

function ytEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  var different = 0;
  for (var i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}

function ytProxyHeaders(headers) {
  var blocked = /^(?:host|content-length|connection|transfer-encoding|proxy-connection|keep-alive|upgrade|te|trailer|content-encoding|x-youtube-hot-hash-data)$/i;
  return (headers || []).filter(function (pair) { return !blocked.test(String(pair[0] || "")); });
}

async function ytRefreshLogEvent(ctx) {
  try {
    var response = await Anywhere.http.request({
      url: ctx.url,
      method: ctx.method || "POST",
      headers: ytProxyHeaders(ctx.headers),
      body: ctx.body,
      timeout: 10000,
      redirect: "follow"
    });
    if (response.status >= 200 && response.status < 300 && response.body) ytCaptureKeys(response.body);
    Anywhere.respond({status: response.status, headers: response.headers || [], body: response.body || new Uint8Array()});
  } catch (_) {
    return;
  }
}

async function process(ctx) {
  var url = String(ctx.url || "");
  if (ctx.phase === "response") {
    if (/\/youtubei\/v1\/(?:config|log_event)(?:\?|$)/.test(url) && ctx.body && ctx.body.length) {
      ytCaptureKeys(ctx.body);
    }
    return;
  }
  if (ctx.phase !== "request") return;
  if (/^https?:\/\/[\w-]+\.googlevideo\.com\/initplayback.+&ack/.test(url)) {
    var requestKey = ctx.body && ctx.body.length ? ytInitClientKey(ctx.body) : null;
    var keys = ytLoadKeys();
    for (var i = 0; requestKey && i < keys.length; i++) {
      try {
        if (ytEqual(requestKey, Anywhere.codec.base64.decode(keys[i].encryptKey))) return;
      } catch (_) {}
    }
    try { Anywhere.store.set(YT_REFRESH_STORE, "1"); } catch (_) {}
    Anywhere.respond({status: 200, headers: [["content-type", "text/plain"]], body: new Uint8Array()});
    return;
  }
  if (/\/youtubei\/v1\/log_event(?:\?|$)/.test(url)) {
    var refresh = false;
    try { refresh = Anywhere.store.getString(YT_REFRESH_STORE) === "1"; } catch (_) {}
    if (!ytLoadKeys().length || refresh) await ytRefreshLogEvent(ctx);
  }
}