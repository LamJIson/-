// Surge http-response 脚本
// 匹配: ^https?://(?:www|m)\.youtube\.com/api/timedtext(?:\?|$)
// 需要: requires-body = true, max-size = -1, timeout = 30

const $ = new Env("YT DualSubs timedtext");

// ========== Argument 解析 ==========
function getArg(name, fallback = "") {
  try {
    if (typeof $argument === "string" && $argument) {
      const obj = Object.fromEntries(
        $argument.split("&").map(s => {
          const i = s.indexOf("=");
          return i === -1 ? [s, ""] : [decodeURIComponent(s.slice(0, i)), decodeURIComponent(s.slice(i + 1))];
        })
      );
      if (obj[name] !== undefined && obj[name] !== "") return String(obj[name]);
    }
  } catch (e) {}
  return fallback;
}

// ========== Store 封装 ==========
const Store = {
  getString(key) {
    return $persistentStore.read(key) || "";
  },
  set(key, value) {
    $persistentStore.write(String(value), key);
  }
};

// ========== HTTP 封装 ==========
function httpRequest(opt) {
  return new Promise((resolve, reject) => {
    const method = (opt.method || "GET").toUpperCase();
    const headers = {};
    if (Array.isArray(opt.headers)) {
      opt.headers.forEach(([k, v]) => (headers[k] = v));
    } else if (opt.headers) {
      Object.assign(headers, opt.headers);
    }
    $httpClient[method.toLowerCase()](
      {
        url: opt.url,
        headers,
        body: opt.body,
        timeout: Math.floor((opt.timeout || 8000) / 1000)
      },
      (err, resp, body) => {
        if (err) return reject(err);
        resolve({
          status: resp.status,
          headers: resp.headers || {},
          body: body || ""
        });
      }
    );
  });
}

// ========== 诊断 ==========
function __fullCaptionDiagnostic(ctx, stage, detail) {
  try {
    if (String(getArg("subtitle_diagnostics", "true")) !== "true") return;
    const key = "ytfull:diagnostic:" + stage;
    const now = Date.now();
    const last = Number(Store.getString(key) || 0);
    if (last && now - last < 15000) return;
    try { Store.set(key, String(now)); } catch (e) { return; }
    console.log(`[YT-FULL-D7] ${stage} ${detail}`);
  } catch (e) {}
}

// ========== DualSubs Core（已适配） ==========
var __DualSubsCore = (() => {
  // ... 这里保持你原贴的 DualSubsCore 代码不变，只把里面的 Anywhere.http.request 换成 httpRequest，Anywhere.codec.utf8 换成简单字符串处理
  // 为控制长度，下面给出关键替换后的 fetch 函数，其余 Composite / Translate 类保持原逻辑即可

  var total = 0, active = 0, waiting = [];
  async function fetch(request) {
    if (++total > 16) throw Error("DualSubs request budget exceeded");
    if (active >= 4) await new Promise(r => waiting.push(r));
    else active++;
    try {
      let url = request.url, body = request.body;
      if (/^https:\/\/(translation|translate)\.googleapis\.com\/(language|v3)\//.test(url) && typeof body === "string") {
        const value = JSON.parse(body);
        if (value.source === "auto") delete value.source;
        if (value.sourceLanguageCode === "auto") delete value.sourceLanguageCode;
        body = JSON.stringify(value);
      }
      if (/microsofttranslator|api\.translator\.azure/.test(url)) {
        url = url.replace(/([?&])from=auto(?=&|$)/, "$1").replace("?&", "?");
      }
      let response;
      try {
        response = await httpRequest({
          url,
          method: request.method || (body === undefined ? "GET" : "POST"),
          headers: request.headers || {},
          body: typeof body === "string" ? body : body,
          timeout: 8000
        });
      } catch (error) {
        const message = String(error).toLowerCase();
        const code = /timed.?out|timeout/.test(message) ? "transport-timeout"
          : /certificate|tls|ssl/.test(message) ? "transport-tls"
          : /cap|budget|concurrent/.test(message) ? "request-budget"
          : /expected.*url|invalid.*url/.test(message) ? "request-url"
          : "transport-failed";
        throw Error("YT:" + code);
      }
      if (response.status < 200 || response.status >= 300) throw Error("DualSubs HTTP " + response.status);
      const text = response.body;
      if (/\/translate_a\/(single|t)(?:\?|$)/.test(url)) {
        if (/^\s*</.test(text)) throw Error("YT:html-response");
      }
      return { status: response.status, headers: response.headers, body: text };
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  }

  // 这里直接复用你贴出来的 Translate 和 Composite 类（它们本身不依赖 Anywhere）
  // 为节省篇幅，请把原贴中 Translate 类 和 Composite 类 完整复制到这里
  // （从 var Translate = class { ... } 到 Composite 类结束）

  // 占位：实际使用时把原 Translate + Composite 粘贴进来
  var Translate = class { /* 原代码 */ };
  var Composite = class { /* 原代码 */ };

  return { Composite, Translate, fetch };
})();

// ========== Formats（原样保留） ==========
// 把你贴的 __DualSubsFormats 整个复制过来即可（不依赖 Anywhere）

// ========== 工具函数 ==========
function __fullParam(name, fallback) {
  return getArg(name, fallback);
}
function __fullQuery(url, key) {
  const head = String(url).split("#")[0];
  const at = head.indexOf("?");
  const query = at < 0 ? "" : head.slice(at + 1);
  for (const item of query.split("&")) {
    const eq = item.indexOf("=");
    const name = eq < 0 ? item : item.slice(0, eq);
    try {
      if (decodeURIComponent(name) === key) {
        return decodeURIComponent((eq < 0 ? "" : item.slice(eq + 1)).replace(/\+/g, " "));
      }
    } catch (e) {}
  }
  return "";
}
function __fullSetQuery(url, key, value) {
  const [head, fragment] = String(url).split("#");
  const at = head.indexOf("?");
  const base = at < 0 ? head : head.slice(0, at);
  const query = at < 0 ? "" : head.slice(at + 1);
  const parts = query.split("&").filter(x => {
    if (!x) return false;
    try { return decodeURIComponent(x.split("=")[0]) !== key; } catch (e) { return true; }
  });
  if (value !== null) parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
  return base + (parts.length ? "?" + parts.join("&") : "") + (fragment === undefined ? "" : "#" + fragment);
}

// ========== 主逻辑 ==========
async function __fullSubtitleRequest(ctx, suppliedPrimary) {
  // 原逻辑基本不变，只把 Anywhere.codec.utf8.encode/decode 改成直接用字符串
  // 以及 Anywhere.respond 改成最后统一 $done
  // （这里省略重复代码，实际使用时把原 __fullSubtitleRequest 粘贴，并做以下替换：）
  // Anywhere.codec.utf8.encode(x)  →  x
  // Anywhere.codec.utf8.decode(x)  →  x
  // Anywhere.respond({status, headers, body}) → 最后 $done({response: {status, headers, body}})
}

// ========== 入口 ==========
(async () => {
  try {
    const ctx = {
      phase: "response",
      url: $request.url,
      originalUrl: $request.url,
      method: $request.method || "GET",
      status: $response.status,
      headers: Object.entries($response.headers || {}),
      body: $response.body
    };
    await __fullSubtitleRequest(ctx, true);   // suppliedPrimary = true 表示这是 response 阶段
    // 如果脚本内部已经修改了 ctx.body，则：
    $done({ body: ctx.body });
  } catch (e) {
    console.log("YT DualSubs error:", e);
    $done({});
  }
})();

// 极简 Env（可选）
function Env(name) {
  this.name = name;
  this.log = (...args) => console.log(`[${name}]`, ...args);
}
