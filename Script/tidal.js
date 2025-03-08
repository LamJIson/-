// 获取原始响应的 body
const body = $response.body ? JSON.parse($response.body) : {};

// 修改响应内容，解锁 VIP
if (body) {
  body.status = "ACTIVE"; // 设置状态为 ACTIVE
  body.canGetTrial = true; // 允许试用
  body.premiumAccess = true; // 开启高级访问权限
  body.paymentType = "PAID"; // 设置支付类型为已支付
  body.paymentOverdue = false; // 设置支付未逾期
  body.highestSoundQuality = "HI_RES"; // 设置最高音质为 HI_RES

  // 修改订阅信息
  body.subscription = {
    type: "PREMIUM", // 设置订阅类型为 PREMIUM
    offlineGracePeriod: 30 // 设置离线宽限期为 30 天
  };

  // 将有效期设置为 2099 年
  body.validUntil = "2099-12-31T23:59:59.000Z";
}

// 返回修改后的响应
$done({
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});


// 获取原始响应的 body
const body = $response.body ? JSON.parse($response.body) : {};

// 如果返回 403 错误，替换为有效的播放信息
if (body.status === 403) {
  body = {
    "trackId": 338937814,
    "assetPresentation": "FULL",
    "audioQuality": "HI_RES",
    "manifestMimeType": "application/vnd.tidal.bt",
    "manifestHash": "abc123def456ghi789jkl012mno345",
    "manifest": "https://example.com/manifest.mpd",
    "albumReplayGain": 0.0,
    "albumPeakAmplitude": 1.0,
    "trackReplayGain": 0.0,
    "trackPeakAmplitude": 1.0,
    "playTimeInMinutes": 4,
    "urls": [
      {
        "codec": "MQA",
        "url": "https://example.com/audio.mqa",
        "encryptionType": "NONE"
      },
      {
        "codec": "FLAC",
        "url": "https://example.com/audio.flac",
        "encryptionType": "NONE"
      }
    ]
  };
}

// 返回修改后的响应
$done({
  body: JSON.stringify(body) // 将修改后的 body 转换为 JSON 字符串
});
