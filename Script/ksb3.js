// 获取原始响应的 body
const body = $response.body ? JSON.parse($response.body) : {};

// 如果 data.list 是数组，清空它（隐藏所有推荐内容）
if (body.data && body.data.list && Array.isArray(body.data.list)) {
  body.data.list = []; // 清空 list 数组
}

// 返回修改后的响应
$done({
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});
