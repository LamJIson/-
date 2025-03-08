// 获取原始响应的 body
const body = $response.body ? JSON.parse($response.body) : {};

// 修改余额为“无限”
if (body.data) {
  body.data.balance = "999999"; // 设置余额为 999999
}

// 返回修改后的响应
$done({
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});
