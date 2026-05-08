// baicizhan_all_vip.js
// 百词斩完整 VIP 解锁脚本

console.log("========================================");
console.log("百词斩 VIP 解锁脚本已加载");
console.log("VIP 有效期至: 2099-12-31 23:59:59");
console.log("========================================");

// ==================== 配置区域 ====================
const CONFIG = {
    // VIP 过期时间 - 2099年12月31日
    expireDate: "2099-12-31 23:59:59",
    expireTimestamp: 4102358399000,  // 2099-12-31 23:59:59 的时间戳
    
    // VIP 配置
    vipDays: 36500,                  // 约100年
    vipLevel: 1,
    wordLevel: "六级",
    creditNum: 99999,
    debug: true,
};

function log(message, data = null) {
    if (!CONFIG.debug) return;
    if (data) {
        console.log(`[百词斩VIP] ${message}`, JSON.stringify(data));
    } else {
        console.log(`[百词斩VIP] ${message}`);
    }
}

function getFormattedDate() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// ==================== API 修改函数 ====================

// 1. 用户信息 API
function modifyUserInfo(data) {
    log("修改用户信息");
    if (!data.data) data.data = {};
    data.data.is_vip = 1;
    data.data.is_try_vip = 1;
    data.data.vip_days = CONFIG.vipDays;
    data.data.vip_expire = CONFIG.expireDate;
    data.data.try_vip_expire = CONFIG.expireDate;
    data.data.word_level = CONFIG.wordLevel;
    data.data.buy_term_count = 999;
    return data;
}

// 2. 书本套餐VIP状态
function modifyBookPackageVipStatus(data) {
    log("修改书本套餐VIP状态");
    if (data.data === null) data.data = {};
    data.data.valid = true;
    data.data.vipDays = CONFIG.vipDays;
    data.data.expireDate = CONFIG.expireDate;
    data.data.isVip = true;
    data.data.vipLevel = "钻石会员";
    data.data.autoRenew = true;
    data.data.remainingDays = CONFIG.vipDays;
    return data;
}

// 3. 外刊VIP状态
function modifyForeignJournalVipStatus(data) {
    log("修改外刊VIP状态");
    if (data.data === null) data.data = {};
    data.data.valid = true;
    data.data.vipDays = CONFIG.vipDays;
    data.data.expireDate = CONFIG.expireDate;
    data.data.isVip = true;
    data.data.vipLevel = "外刊终身会员";
    data.data.autoRenew = true;
    data.data.remainingDays = CONFIG.vipDays;
    return data;
}

// 4. 会员信息页面 (strategy.baicizhan.com)
function modifyMemberInfoPage(data) {
    log("修改会员信息页面");
    
    if (data.data === null) data.data = {};
    
    data.data.payed = true;
    data.data.creditNum = CONFIG.creditNum;
    data.data.getTodayReward = true;
    data.data.getMonthCreditReward = true;
    
    if (!data.data.userVipInfo) data.data.userVipInfo = {};
    data.data.userVipInfo.currentValue = 10000;
    data.data.userVipInfo.memberLevel = 5;           // 最高会员等级
    data.data.userVipInfo.maxValue = 10000;
    data.data.userVipInfo.entitlementKey = "bcz.app.vip.v1";
    data.data.userVipInfo.expireTime = CONFIG.expireTimestamp;
    data.data.userVipInfo.nextRecoveryAmount = 0;
    data.data.userVipInfo.nextRecoveryTime = CONFIG.expireTimestamp;
    data.data.userVipInfo.recoveryInterval = 365;
    
    if (data.data.todayRewardList === null) {
        data.data.todayRewardList = [{
            rewardType: "credit",
            rewardValue: 100,
            description: "每日签到奖励"
        }];
    }
    
    if (data.data.memberSaleInfoList && Array.isArray(data.data.memberSaleInfoList)) {
        data.data.memberSaleInfoList = data.data.memberSaleInfoList.map(item => ({
            ...item,
            price: 0,
            originPrice: 0,
            tag: "终身会员已解锁"
        }));
    }
    
    return data;
}

// 5. 书本阅读状态
function modifyUserReadBook(data, url) {
    log("修改书本阅读权限");
    const bookIdMatch = url.match(/bookId=(\d+)/);
    const bookId = bookIdMatch ? parseInt(bookIdMatch[1]) : null;
    
    if (data.data === null) {
        data.data = {
            isDone: 0,
            bookId: bookId,
            doneAt: null,
            lastReadTime: getFormattedDate(),
            startReadAt: getFormattedDate(),
            lastReadArticleId: 1,
            readChapterCount: 0,
            canRead: true,
            vipUnlocked: true,
            vipExpireDate: CONFIG.expireDate
        };
    } else {
        data.data.canRead = true;
        data.data.vipUnlocked = true;
        data.data.vipExpireDate = CONFIG.expireDate;
        if (!data.data.lastReadTime) data.data.lastReadTime = getFormattedDate();
        if (!data.data.startReadAt) data.data.startReadAt = getFormattedDate();
        if (!data.data.lastReadArticleId) data.data.lastReadArticleId = 1;
    }
    return data;
}

// 6. 书本列表
function modifyBookList(data) {
    log("修改书本列表");
    if (data.data && data.data.books && Array.isArray(data.data.books)) {
        data.data.books = data.data.books.map(book => ({
            ...book,
            is_vip: false,
            is_locked: false,
            can_preview: true,
            vip_only: false
        }));
    }
    return data;
}

// 7. 文章/章节内容
function modifyArticleContent(data) {
    log("修改文章内容权限");
    if (data.data) {
        data.data.can_read = true;
        data.data.is_vip_content = false;
        data.data.unlocked = true;
        data.data.vip_only = false;
    }
    return data;
}

// ==================== URL 匹配和处理 ====================

const URL_RULES = [
    { pattern: /get_user_info/, handler: modifyUserInfo },
    { pattern: /book_package_vip_status/, handler: modifyBookPackageVipStatus },
    { pattern: /foreign_journal_vip_status/, handler: modifyForeignJournalVipStatus },
    { pattern: /get_member_info_page/, handler: modifyMemberInfoPage },
    { pattern: /get_user_read_book/, handler: modifyUserReadBook, needsUrl: true },
    { pattern: /get_books/, handler: modifyBookList },
    { pattern: /get_article_content|get_chapter_content/, handler: modifyArticleContent }
];

function findHandler(url) {
    for (const rule of URL_RULES) {
        if (rule.pattern.test(url)) {
            return rule;
        }
    }
    return null;
}

function processResponse(body, url) {
    try {
        let data = JSON.parse(body);
        log("处理 URL: " + url);
        
        const rule = findHandler(url);
        
        if (rule) {
            if (rule.needsUrl) {
                data = rule.handler(data, url);
            } else {
                data = rule.handler(data);
            }
        } else {
            log("未匹配到规则，跳过");
            return body;
        }
        
        // 统一修正状态码
        if (data.code === 401 || data.code === 403 || data.code === -1 || data.code === 0) {
            data.code = 1;
        }
        if (data.message === "no user, need login" || !data.message) {
            data.message = "success";
        }
        
        log("✅ 修改完成，VIP 有效期至: " + CONFIG.expireDate);
        return JSON.stringify(data);
        
    } catch (e) {
        log("处理失败: " + e.message);
        return body;
    }
}

// ==================== Surge 入口 ====================

function onResponse() {
    const url = $request.url;
    const body = $response.body;
    
    log("拦截请求: " + url);
    
    if (!body) {
        log("响应体为空");
        $done({});
        return;
    }
    
    const modifiedBody = processResponse(body, url);
    
    if (modifiedBody !== body) {
        log("🎉 VIP 终身会员已解锁 (2099-12-31)");
    }
    
    $done({body: modifiedBody});
}

onResponse();