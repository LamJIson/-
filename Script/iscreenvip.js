const url = $request.url;
const method = $request.method;
const headers = $request.headers;
const body = $request.body;

if (url.includes("verifyReceipt")) {
    // 解析请求体
    let modifiedBody = JSON.parse(body);

    // 修改响应体，模拟验证成功
    modifiedBody.status = 0; // 0 表示成功
    modifiedBody.latest_receipt_info = [
        {
            "product_id": "com.example.product",
            "expires_date": "2099-12-31 23:59:59 Etc/GMT"
        }
    ];

    // 返回修改后的响应
    $done({
        body: JSON.stringify(modifiedBody)
    });
} else {
    // 不修改其他请求
    $done({});
}
