let body = $response.body;
let obj = JSON.parse(body);

// Modify the response to indicate VIP status and reading permissions
obj.data.is_vip = 1;
obj.data.vip_expire = "2066-12-31 23:59:59"; // Set the expiration date to the end of 2099
obj.data.newer_discount_expire = "2099-12-31 23:59:59"; // Set the newer discount expiration date to the end of 2099
obj.data.is_try_vip = 1; // Set the try VIP status to 1
obj.data.try_vip_expire = "2066-12-31 23:59:59"; // Set the try VIP expiration date to the end of 2099
obj.data.vip_days = 365; // Set the VIP days to 365

$done({body: JSON.stringify(obj)});

let body = $response.body;
let obj = JSON.parse(body);


