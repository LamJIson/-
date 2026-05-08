// baicizhan_member_info.js
// 修改会员信息页面，解锁VIP状态

console.log("会员信息页面解锁脚本已加载");

// VIP配置
const VIP_CONFIG = {
    isVip: true,
    vipLevel: 1,                    // 会员等级
    expireTime: 1798732799000,      // 2026-12-31 23:59:59 的时间戳
    currentValue: 1000,             // 当前会员积分/成长值
    maxValue: 10000,                // 下一等级所需积分/成长值
    nextRecoveryAmount: 100,
    nextRecoveryTime: 1798732799000,
    recoveryInterval: 30            // 恢复间隔（天）
};

function modifyMemberInfo(body) {
    try {
        let data = JSON.parse(body);
        
        console.log("原始会员信息数据:", JSON.stringify(data));
        
        // 如果data为null或用户未登录，创建新的数据结构
        if (data.data === null) {
            console.log("创建新的会员信息记录");
            data.data = {};
            data.code = 1;
            data.message = "ok";
        }
        
        // 修改VIP相关字段
        if (data.data) {
            // 修改付费状态
            data.data.payed = true;                    // 已付费
            data.data.creditNum = 99999;               // 积分数量
            
            // 修改用户VIP信息
            if (!data.data.userVipInfo) {
                data.data.userVipInfo = {};
            }
            data.data.userVipInfo.currentValue = VIP_CONFIG.currentValue;
            data.data.userVipInfo.memberLevel = VIP_CONFIG.vipLevel;
            data.data.userVipInfo.maxValue = VIP_CONFIG.maxValue;
            data.data.userVipInfo.entitlementKey = "bcz.app.vip.v1";
            data.data.userVipInfo.expireTime = VIP_CONFIG.expireTime;
            data.data.userVipInfo.nextRecoveryAmount = VIP_CONFIG.nextRecoveryAmount;
            data.data.userVipInfo.nextRecoveryTime = VIP_CONFIG.nextRecoveryTime;
            data.data.userVipInfo.recoveryInterval = VIP_CONFIG.recoveryInterval;
            
            // 修改奖励相关
            if (data.data.getTodayReward === false) {
                data.data.getTodayReward = true;        // 今日奖励已领取
            }
            if (data.data.getMonthCreditReward === false) {
                data.data.getMonthCreditReward = true;   // 月度积分奖励已领取
            }
            
            // 设置今日奖励列表（如果需要）
            if (!data.data.todayRewardList) {
                data.data.todayRewardList = [
                    {
                        rewardType: "credit",
                        rewardValue: 100,
                        description: "每日签到奖励"
                    }
                ];
            }
            
            // 修改会员商品列表 - 将所有商品标记为已购买或显示已解锁
            if (data.data.memberSaleInfoList && Array.isArray(data.data.memberSaleInfoList)) {
                data.data.memberSaleInfoList = data.data.memberSaleInfoList.map(item => {
                    // 可以修改商品价格或标记
                    item.originPrice = 0;      // 原价设为0
                    item.price = 0;             // 现价设为0
                    item.tag = "已解锁";         // 修改标签
                    return item;
                });
            }
            
            console.log("修改后的会员信息:", JSON.stringify(data.data));
        }
        
        return JSON.stringify(data);
    } catch (e) {
        console.log(`解析失败: ${e.message}`);
        return body;
    }
}

function onResponse(context) {
    const body = $response.body;
    
    if (!body) {
        console.log("响应体为空");
        $done({});
        return;
    }
    
    console.log("拦截会员信息页面请求");
    const modifiedBody = modifyMemberInfo(body);
    
    if (modifiedBody !== body) {
        console.log("会员信息已修改，VIP状态已解锁");
    }
    
    $done({body: modifiedBody});
}

onResponse();