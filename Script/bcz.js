let obj = JSON.parse($response.body);

// 修改响应数据以调整用户信息
obj.data.vip_days = 365; // 假设设置为一年的 VIP 天数
obj.data.is_vip = 1; // 假设设置为 VIP 用户
obj.data.vip_expire = "2099-12-31 23:59:59"; // 设置 VIP 到期时间为遥远的未来

$done({body: JSON.stringify(obj)});
