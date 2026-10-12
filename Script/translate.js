/*
 * YouTube 双语字幕翻译
 * Loon HTTP Response Script
 *
 * 参数示例：
 * subtitle_type=Translate&show_only_auto_translation=false
 */

let __loonFinished = false;

const __loonContext = {
  phase: "response",
  url: ($request && $request.url) || "",
  originalUrl: ($request && $request.url) || "",
  headers: objectHeadersToArray(($response && $response.headers) || {}),
  body: toUint8Array(($response && $response.body) || "")
};

const Anywhere = {
  params: {
    get(name) {
      return getArgument(name);
    }
  },

  codec: {
    utf8: {
      decode(value) {
        return utf8Decode(value);
      },

      encode(value) {
        return utf8Encode(value);
      }
    }
  },

  store: {
    getString(key) {
      try {
        return $persistentStore.read(String(key)) || "";
      } catch (_) {
        return "";
      }
    },

    set(key, value) {
      try {
        return $persistentStore.write(
          String(value == null ? "" : value),
          String(key)
        );
      } catch (_) {
        return false;
      }
    }
  },

  http: {
    request(options) {
      return loonHttpRequest(options);
    }
  },

  done() {
    if (__loonFinished) return;
    __loonFinished = true;

    const headers = arrayHeadersToObject(__loonContext.headers || []);
    const body = utf8Decode(__loonContext.body || new Uint8Array());

    deleteHeader(headers, "content-length");
    deleteHeader(headers, "content-encoding");
    deleteHeader(headers, "transfer-encoding");

    $done({
      headers,
      body
    });
  }
};

(async function () {
  try {
    await process(__loonContext);

    // 原脚本在不需要修改响应时会直接 return，
    // Loon 中必须显式调用 $done({}) 放行。
    if (!__loonFinished) {
      __loonFinished = true;
      $done({});
    }
  } catch (error) {
    console.log(
      "[YouTube Dual Subtitle] " +
      String(error && error.stack ? error.stack : error)
    );

    if (!__loonFinished) {
      __loonFinished = true;
      $done({});
    }
  }
})();

function getArgument(name) {
  const argument =
    typeof $argument === "string"
      ? $argument
      : "";

  const query = argument.replace(/^\?/, "").split("&");

  for (let i = 0; i < query.length; i++) {
    if (!query[i]) continue;

    const equalIndex = query[i].indexOf("=");
    const rawKey =
      equalIndex >= 0
        ? query[i].slice(0, equalIndex)
        : query[i];

    const rawValue =
      equalIndex >= 0
        ? query[i].slice(equalIndex + 1)
        : "";

    if (decodeArgument(rawKey) === name) {
      return decodeArgument(rawValue);
    }
  }

  return null;
}

function decodeArgument(value) {
  value = String(value == null ? "" : value).replace(/\+/g, " ");

  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

function objectHeadersToArray(headers) {
  const result = [];

  if (!headers || typeof headers !== "object") {
    return result;
  }

  Object.keys(headers).forEach(function (name) {
    result.push([
      String(name),
      String(headers[name] == null ? "" : headers[name])
    ]);
  });

  return result;
}

function arrayHeadersToObject(headers) {
  const result = {};

  (headers || []).forEach(function (header) {
    if (!header || !header[0]) return;

    result[String(header[0])] =
      String(header[1] == null ? "" : header[1]);
  });

  return result;
}

function deleteHeader(headers, targetName) {
  const lowerTarget = String(targetName).toLowerCase();

  Object.keys(headers || {}).forEach(function (name) {
    if (String(name).toLowerCase() === lowerTarget) {
      delete headers[name];
    }
  });
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (
    typeof ArrayBuffer !== "undefined" &&
    value instanceof ArrayBuffer
  ) {
    return new Uint8Array(value);
  }

  if (
    value &&
    value.buffer instanceof ArrayBuffer
  ) {
    return new Uint8Array(
      value.buffer,
      value.byteOffset || 0,
      value.byteLength
    );
  }

  return utf8Encode(
    String(value == null ? "" : value)
  );
}

function utf8Encode(value) {
  value = String(value == null ? "" : value);

  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value);
  }

  const encoded = unescape(encodeURIComponent(value));
  const output = new Uint8Array(encoded.length);

  for (let i = 0; i < encoded.length; i++) {
    output[i] = encoded.charCodeAt(i);
  }

  return output;
}

function utf8Decode(value) {
  if (typeof value === "string") {
    return value;
  }

  const bytes = toRawUint8Array(value);

  if (typeof TextDecoder !== "undefined") {
    try {
      return new TextDecoder("utf-8").decode(bytes);
    } catch (_) {}
  }

  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  try {
    return decodeURIComponent(escape(binary));
  } catch (_) {
    return binary;
  }
}

function toRawUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (
    typeof ArrayBuffer !== "undefined" &&
    value instanceof ArrayBuffer
  ) {
    return new Uint8Array(value);
  }

  if (
    value &&
    value.buffer instanceof ArrayBuffer
  ) {
    return new Uint8Array(
      value.buffer,
      value.byteOffset || 0,
      value.byteLength
    );
  }

  const stringValue = String(value == null ? "" : value);
  const output = new Uint8Array(stringValue.length);

  for (let i = 0; i < stringValue.length; i++) {
    output[i] = stringValue.charCodeAt(i) & 0xff;
  }

  return output;
}

function loonHttpRequest(options) {
  options = options || {};

  return new Promise(function (resolve, reject) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = arrayHeadersToObject(options.headers || []);

    const params = {
      url: String(options.url || ""),
      headers,
      timeout: Number(options.timeout || 10000),
      "binary-mode": true,
      "auto-redirect": options.redirect !== "manual"
    };

    if (options.body !== undefined && options.body !== null) {
      params.body = options.body;
    }

    let requestMethod = method.toLowerCase();

    if (
      !["get", "post", "put", "delete", "patch", "head", "options"]
        .includes(requestMethod)
    ) {
      requestMethod = "get";
    }

    const client = $httpClient[requestMethod];

    if (typeof client !== "function") {
      reject(new Error("Unsupported HTTP method: " + method));
      return;
    }

    client(params, function (error, response, data) {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      response = response || {};

      resolve({
        status: Number(
          response.status ||
          response.statusCode ||
          0
        ),

        headers: objectHeadersToArray(response.headers || {}),
        body: toUint8Array(data || "")
      });
    });
  });
}

/*
 * 将你原来的 async function process(ctx) { ... }
 * 从这里开始完整粘贴，不需要改主体结构。
 */

async function process(ctx) {
  // 这里替换为你问题中发来的完整 process(ctx) 函数
}
