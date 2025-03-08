// 获取原始响应的 body
const body = $response.body ? JSON.parse($response.body) : {};

// 修改免费次数为“无限”
if (body.data) {
  body.data.rest = "9999"; // 剩余次数
  body.data.total = "9999"; // 总次数
}

// 返回修改后的响应
$done({
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});
