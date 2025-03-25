let body = $response.body;
let obj = JSON.parse(body);

// Modify the response to indicate success
obj.message = "提交商品信息成功，可以领取体验会员";
obj.code = 1; // Assuming 1 indicates success
obj.data = {
  "try_expire_time": "2099-12-31 23:59:59",
  "vip_expire_time": "2099-12-31 23:59:59",
  "can_try": true
};

$done({body: JSON.stringify(obj)});