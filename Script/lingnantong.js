const url = $request.url;
const method = $request.method;

if (method === "GET" && url.includes("/APPMall/advertisement/advertisement!adConfig.action")) {
    // 修改响应内容
    const modifiedResponse = {
        "isShowMsg": false,  // 关闭广告显示
        "time": null,  // 将时间设置为 null
        "data": {
            "throttleTime": "20",
            "adInfoList": [],  // 清空广告列表
            "adPosition": "APP_START_SCREEN",
            "countdownTime": "5"
        },
        "code": 0,
        "msg": ""
    };

    // 返回修改后的响应
    $done({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modifiedResponse)
    });
} else {
    // 其他请求直接放行
    $done({});
}
