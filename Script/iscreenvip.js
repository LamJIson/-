// 脚本内容
const url = $request.url;
const headers = $request.headers;
const body = $request.body;

// 修改 URL 参数
const modifiedUrl = url.replace(/vip=0/, 'vip=1');

// 修改 JSON 响应
const modifiedBody = JSON.stringify({
  "code": 0,
  "data": "",
  "ab": 1,
  "msg": "VIP unlocked"
});

// 发送修改后的请求
$done({
  url: modifiedUrl,
  headers: headers,
  body: modifiedBody
});