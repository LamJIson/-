// 获取原始请求的 body（如果存在）
const body = $request.body ? JSON.parse($request.body) : {};

// 修改 body 中的字段
body.code = "200";
body.data = {
  total: "10",
  used: "0" // 将 used 设置为 0，模拟未使用
};
body.time = Math.floor(Date.now() / 1000).toString(); // 使用当前时间戳
body.encrypt = "Wi98rP7pwSJdWwz9JTEkhX=="; // 保持加密字段不变

// 发送修改后的请求
$done({
  headers: $request.headers, // 保持原始请求头不变
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});