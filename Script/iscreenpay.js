(function() {
    // 获取原始响应体
    const originalResponse = JSON.parse($response.body);

    // 修改 JSON 数据
    const modifiedJson = {
        code: originalResponse.code, // 保持 code 不变
        ab: 1,                       // 将 ab 改为 1，表示支付成功
        data: originalResponse.data, // 保持 data 不变
        msg: "支付成功"               // 将 msg 改为 "支付成功"
    };

    // 返回修改后的响应
    $done({
        response: {
            body: JSON.stringify(modifiedJson)
        }
    });
})();