let body = $response.body;
let obj = JSON.parse(body);

// Modify the response to set the expiration times to the end of 2099
obj.data.try_expire_time = "2099-12-31 23:59:59";
obj.data.vip_expire_time = "2024-12-31 23:59:59";
obj.data.can_try = true; // Optionally, set can_try to true if needed

$done({body: JSON.stringify(obj)});