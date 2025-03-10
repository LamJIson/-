(function() {
    const modifiedJson = {
        code: 0,
        ab: 1,
        data: "eMyxcMtOcN4=",
        msg: "支付成功"
    };

    const modifiedUrl = $request.url.replace(/type=restore_failed2/, "type=restore_success");

    $done({
        response: {
            body: JSON.stringify(modifiedJson)
        },
        url: modifiedUrl
    });
})();