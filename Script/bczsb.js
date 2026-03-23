// baicizhan_all_vip.js
// 处理所有VIP相关的API

console.log("百词斩VIP全面解锁脚本");

// VIP配置
const VIP_CONFIG = {
    valid: true,
    vipDays: 365,
    expireDate: "2026-12-31 23:59:59",
    isVip: true,
    vipLevel: "钻石会员",
    autoRenew: true,
    remainingDays: 365,
    is_try_vip: 1,
    vip_days: 365
};

function modifyUserInfo(data) {
    if (data.data) {
        data.data.is_vip = 1;
        data.data.is_try_vip = 1;
        data.data.vip_days = 365;
        data.data.vip_expire = VIP_CONFIG.expireDate;
        data.data.try_vip_expire = VIP_CONFIG.expireDate;
        data.data.word_level = "六级";
        data.data.buy_term_count = 999;
    }
    return data;
}

function modifyBookPackageVipStatus(data) {
    if (data.data === null) {
        data.data = {};
    }
    data.data.valid = VIP_CONFIG.valid;
    data.data.vipDays = VIP_CONFIG.vipDays;
    data.data.expireDate = VIP_CONFIG.expireDate;
    data.data.isVip = VIP_CONFIG.isVip;
    data.data.vipLevel = VIP_CONFIG.vipLevel;
    data.data.autoRenew = VIP_CONFIG.autoRenew;
    data.data.remainingDays = VIP_CONFIG.remainingDays;
    return data;
}

function modifyUserReadBook(data, url) {
    const bookIdMatch = url.match(/bookId=(\d+)/);
    const bookId = bookIdMatch ? bookIdMatch[1] : null;
    
    if (data.data === null) {
        data.data = {
            isDone: 0,
            bookId: bookId ? parseInt(bookId) : null,
            doneAt: null,
            lastReadTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
            startReadAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            lastReadArticleId: 1,
            readChapterCount: 0,
            canRead: true,
            vipUnlocked: true
        };
    } else {
        data.data.canRead = true;
        data.data.vipUnlocked = true;
    }
    return data;
}

function modifyBookList(data) {
    if (data.data && data.data.books) {
        data.data.books = data.data.books.map(book => {
            book.is_vip = false;
            book.is_locked = false;
            book.can_preview = true;
            return book;
        });
    }
    return data;
}

function modifyArticleContent(data) {
    if (data.data) {
        data.data.can_read = true;
        data.data.is_vip_content = false;
        data.data.unlocked = true;
    }
    return data;
}

function modifyResponse(body, url) {
    try {
        let data = JSON.parse(body);
        
        console.log(`处理API: ${url}`);
        
        // 根据不同的API进行修改
        if (url.includes('/get_user_info')) {
            data = modifyUserInfo(data);
        } else if (url.includes('/book_package_vip_status')) {
            data = modifyBookPackageVipStatus(data);
        } else if (url.includes('/get_user_read_book')) {
            data = modifyUserReadBook(data, url);
        } else if (url.includes('/get_books')) {
            data = modifyBookList(data);
        } else if (url.includes('/get_article_content') || url.includes('/get_chapter_content')) {
            data = modifyArticleContent(data);
        }
        
        // 统一设置成功状态
        if (data.code === 401 || data.code === 403) {
            data.code = 1;
            data.message = "success";
        }
        
        return JSON.stringify(data);
    } catch (e) {
        console.log(`处理失败: ${e.message}`);
        return body;
    }
}

function onResponse(context) {
    const url = $request.url;
    const body = $response.body;
    
    if (!body) {
        $done({});
        return;
    }
    
    const modifiedBody = modifyResponse(body, url);
    
    if (modifiedBody !== body) {
        console.log("响应已修改，VIP权限已解锁");
    }
    
    $done({body: modifiedBody});
}

onResponse();