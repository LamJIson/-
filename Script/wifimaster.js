let body = $response.body;

try {
  const obj = JSON.parse(body);

  obj.message = "";
  obj.code = 0;

  if (!obj.data || typeof obj.data !== "object") {
    obj.data = {};
  }

  obj.data.resp_type = 2;
  obj.data.data = "";
  obj.data.resp_msg = "";

  // 保留服务器返回的 version，避免 App 因版本不一致反复请求
  body = JSON.stringify(obj);
} catch (error) {
  console.log("广告配置处理失败：" + error);
}

$done({ body });