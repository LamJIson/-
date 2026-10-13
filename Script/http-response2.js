// ===== Surge http-response =====
// 匹配规则建议：
// ^https?://(?:www|m)\.youtube\.com/api/timedtext(?:\?|$)
// requires-body = true
// max-size = -1
// timeout = 30
// argument 示例：
// subtitle_type=Translate&subtitle_target_language=zh-CN&subtitle_position=Forward&show_only_auto_translation=false&translation_vendor=Google&subtitle_diagnostics=true

/******************** 工具层 ********************/
function getArg(name, fallback = "") {
  try {
    if (typeof $argument === "string" && $argument) {
      const map = Object.fromEntries(
        $argument.split("&").map(s => {
          const i = s.indexOf("=");
          return i < 0
            ? [decodeURIComponent(s), ""]
            : [decodeURIComponent(s.slice(0, i)), decodeURIComponent(s.slice(i + 1))];
        })
      );
      if (map[name] !== undefined && map[name] !== "") return String(map[name]);
    }
  } catch (_) {}
  return fallback;
}

const Store = {
  getString(k) {
    return $persistentStore.read(k) || "";
  },
  set(k, v) {
    $persistentStore.write(String(v), k);
  },
  delete(k) {
    $persistentStore.write("", k);
  },
  keys() {
    // Surge 没有直接列出全部 key 的 API，这里返回空数组，缓存清理逻辑会退化
    return [];
  }
};

function httpRequest(opt) {
  return new Promise((resolve, reject) => {
    const method = (opt.method || "GET").toUpperCase();
    const headers = {};
    if (Array.isArray(opt.headers)) {
      opt.headers.forEach(([k, v]) => (headers[k] = v));
    } else if (opt.headers) {
      Object.assign(headers, opt.headers);
    }
    const timeout = Math.max(1, Math.floor((opt.timeout || 8000) / 1000));
    $httpClient[method.toLowerCase()](
      { url: opt.url, headers, body: opt.body, timeout },
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

/******************** 诊断 ********************/
function __fullCaptionDiagnostic(ctx, stage, detail) {
  try {
    if (String(getArg("subtitle_diagnostics", "true")) !== "true") return;
    const key = "ytfull:diagnostic:" + stage;
    const now = Date.now();
    const last = Number(Store.getString(key) || 0);
    if (last && now - last < 15000) return;
    try { Store.set(key, String(now)); } catch (_) { return; }
    console.log(`[YT-FULL-D7] ${stage} ${detail}`);
  } catch (_) {}
}

/******************** DualSubs Core（已替换 Anywhere.http / codec） ********************/
var __DualSubsCore = (() => {
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

  // ===== 以下直接复用你原贴的 Translate 类 + Composite 类 =====
  // 把原贴中从 “var Translate = class {” 到 Composite 类结束 的完整代码粘贴到这里
  // （它们本身不依赖 Anywhere，可原样使用）

  var Translate = class { /* 请把原贴 Translate 类完整粘贴到这里 */ };
  var Composite = class { /* 请把原贴 Composite 类完整粘贴到这里 */ };

  return { Composite, Translate, fetch };
})();

/******************** Formats（原样保留） ********************/
// 把原贴中的 __DualSubsFormats 完整粘贴到这里（不依赖 Anywhere）

/******************** 工具函数 ********************/
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
    } catch (_) {}
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
    try { return decodeURIComponent(x.split("=")[0]) !== key; } catch (_) { return true; }
  });
  if (value !== null) parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
  return base + (parts.length ? "?" + parts.join("&") : "") + (fragment === undefined ? "" : "#" + fragment);
}

/******************** 主逻辑（原贴 __fullTranslate + __fullSubtitleRequest 已适配） ********************/
// 把原贴中的 async function __fullTranslate(ctx) { ... } 完整粘贴过来
// 并做以下全局替换：
//   Anywhere.params.get(...)          → getArg(...)
//   Anywhere.store.getString / set    → Store.getString / Store.set
//   Anywhere.codec.utf8.decode(x)     → x          （body 已是 string）
//   Anywhere.codec.utf8.encode(x)     → x
//   Anywhere.done()                   → （在入口统一 $done）
//   respond(...) 里 ctx.body = body   → ctx.body = body（保持）

// 同样把 __fullSubtitleRequest 也粘贴过来，做相同替换

/******************** 入口 ********************/
(async () => {
  try {
    const ctx = {
      phase: "response",
      url: $request.url,
      originalUrl: $request.url,
      method: $request.method || "GET",
      status: $response.status,
      headers: Object.entries($response.headers || {}),
      body: $response.body          // Surge 默认是 string
    };

    // 调用原 process 逻辑
    const type = String(getArg("subtitle_type", "Translate"));
    __fullCaptionDiagnostic(ctx, "response", `type=${type} status=${Number(ctx.status)} bytes=${(ctx.body?.length || 0)}`);
    if (Number(ctx.status) >= 300 || !ctx.body?.length) {
      __fullCaptionDiagnostic(ctx, "result", "skip=empty-or-error");
      return $done({});
    }

    if (type === "Official") {
      // 需要 __fullSubtitleRequest 已适配
      // await __fullSubtitleRequest(ctx, true);
      // 暂时走 Translate 路径
    }

    if (type !== "Translate") {
      __fullCaptionDiagnostic(ctx, "result", "skip=other-mode");
      return $done({});
    }

    // 调用已适配的 __fullTranslate
    // await __fullTranslate(ctx);

    __fullCaptionDiagnostic(ctx, "result", `state=${ctx.__fullSubtitleReason || "unchanged"} failure=${ctx.__fullTranslationFailure || "none"}`);

    // 如果脚本内部修改了 ctx.body，就返回
    if (ctx.body !== undefined && ctx.body !== $response.body) {
      $done({ body: ctx.body });
    } else {
      $done({});
    }
  } catch (e) {
    console.log("YT DualSubs error:", e);
    $done({});
  }
})();
