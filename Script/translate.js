
/*
 * YouTube 双语字幕翻译
 * Loon 运行环境适配层
 *
 * 参数：
 * subtitle_type=Translate
 * show_only_auto_translation=false
 */

var currentCtx = null;

function parseArguments(input) {
  var result = {};
  String(input || "").split("&").forEach(function (part) {
    if (!part) return;
    var index = part.indexOf("=");
    var key = index < 0 ? part : part.slice(0, index);
    var value = index < 0 ? "" : part.slice(index + 1);
    try { key = decodeURIComponent(key.replace(/\+/g, " ")); } catch (_) {}
    try { value = decodeURIComponent(value.replace(/\+/g, " ")); } catch (_) {}
    result[key] = value;
  });
  return result;
}

var argumentParams = parseArguments(
  typeof $argument === "undefined" ? "" : $argument
);

var Anywhere = {
  params: {
    get: function (name) {
      return Object.prototype.hasOwnProperty.call(argumentParams, name)
        ? argumentParams[name]
        : null;
    }
  },

  codec: {
    utf8: {
      decode: function (value) {
        return typeof value === "string" ? value : "";
      },
      encode: function (value) {
        return String(value == null ? "" : value);
      }
    }
  },

  store: {
    getString: function (key) {
      try {
        return $persistentStore.read(key) || "";
      } catch (_) {
        return "";
      }
    },
    set: function (key, value) {
      try {
        return $persistentStore.write(String(value), key);
      } catch (_) {
        return false;
      }
    }
  },

  http: {
    request: function (options) {
      return new Promise(function (resolve, reject) {
        $httpClient.get({
          url: options.url,
          headers: options.headers || {},
          timeout: options.timeout || 8000,
          "auto-redirect": true
        }, function (error, response, body) {
          if (error) {
            reject(error);
            return;
          }
          resolve({
            status: response ? response.status : 0,
            headers: response ? response.headers : {},
            body: body || ""
          });
        });
      });
    }
  },

  done: function () {
    if (!currentCtx) {
      $done({});
      return;
    }

    var headers = {};
    (currentCtx.headers || []).forEach(function (item) {
      if (item && item.length >= 2) {
        headers[String(item[0])] = String(item[1]);
      }
    });

    $done({
      body: currentCtx.body || "",
      headers: headers
    });
  }
};

function loonHeaderPairs(headers) {
  var pairs = [];
  if (!headers) return pairs;

  Object.keys(headers).forEach(function (key) {
    pairs.push([key, headers[key]]);
  });

  return pairs;
}

function loonMain() {
  if (typeof $response === "undefined" || !$response) {
    $done({});
    return;
  }

  currentCtx = {
    phase: "response",
    url: typeof $request !== "undefined" && $request
      ? $request.url
      : "",
    originalUrl: typeof $request !== "undefined" && $request
      ? $request.url
      : "",
    headers: loonHeaderPairs($response.headers),
    body: $response.body || ""
  };

  process(currentCtx).catch(function (error) {
    console.log("YouTube subtitle translation error: " + error);
    $done({});
  });
}
