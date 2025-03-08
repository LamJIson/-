// 获取原始响应的 body
const body = $response.body ? JSON.parse($response.body) : {};

// 如果 data 是数组，清空它（隐藏所有横幅）
if (body.data && Array.isArray(body.data)) {
  body.data = []; // 清空 data 数组
}

// 返回修改后的响应
$done({
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});