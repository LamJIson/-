// baicizhan_books_ultimate.js
// 完整的百词斩书本权限解锁脚本

console.log("百词斩书本权限终极解锁脚本");

// 配置需要解锁的书本ID列表（可选）
const UNLOCK_ALL_BOOKS = true;  // 解锁所有书本
const CUSTOM_BOOK_IDS = [];     // 指定解锁的书本ID，如 [302, 303, 304]

function getBookIdFromUrl(url) {
    const match = url.match(/bookId=(\d+)/);
    return match ? parseInt(match[1]) : null;
}

function shouldUnlockBook(bookId) {
    if (UNLOCK_ALL_BOOKS) return true;
    if (CUSTOM_BOOK_IDS.includes(bookId)) return true;
    return false;
}

function modifyUserReadBook(data, url) {
    const bookId = getBookIdFromUrl(url);
    
    if (!bookId) return data;
    
    console.log(`处理书本ID ${bookId} 的阅读权限`);
    
    if (!shouldUnlockBook(bookId)) {
        console.log(`书本ID ${bookId} 不在解锁列表中`);
        return data;
    }
    
    if (data.data === null) {
        // 创建新记录
        data.data = {
            isDone: 0,
            bookId: bookId,
            doneAt: null,
            lastReadTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
            startReadAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
            lastReadArticleId: 1,
            readChapterCount: 0,
            // 自定义字段
            canRead: true,
            vipUnlocked: true,
            permissionGranted: true
        };
    } else {
        // 修改现有记录
        data.data.isDone = data.data.isDone || 0;
        data.data.canRead = true;
        data.data.vipUnlocked = true;
        data.data.permissionGranted = true;
        
        // 如果没有开始阅读时间，设置一个
        if (!data.data.startReadAt) {
            data.data.startReadAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
        
        // 确保有最后阅读时间
        if (!data.data.lastReadTime) {
            data.data.lastReadTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
        
        // 确保有最后阅读的文章ID
        if (!data.data.lastReadArticleId) {
            data.data.lastReadArticleId = 1;
        }
    }
    
    return data;
}

function modifyBookList(data) {
    // 修改书本列表，标记VIP书本为可读
    if (data.data && data.data.books) {
        data.data.books = data.data.books.map(book => {
            book.is_vip = false;        // 将VIP书本标记为非VIP
            book.is_locked = false;      // 解锁所有书本
            book.can_preview = true;     // 允许预览
            return book;
        });
    }
    return data;
}

function modifyArticleContent(data) {
    // 修改文章内容权限
    if (data.data) {
        data.data.can_read = true;       // 允许阅读
        data.data.is_vip_content = false; // 标记为非VIP内容
        data.data.unlocked = true;        // 已解锁
    }
    return data;
}

function modifyResponse(body, url) {
    try {
        let data = JSON.parse(body);
        
        // 根据不同的API进行不同的修改
        if (url.includes('/get_user_read_book')) {
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
    
    console.log(`拦截请求: ${url}`);
    const modifiedBody = modifyResponse(body, url);
    
    if (modifiedBody !== body) {
        console.log("响应已修改，权限已解锁");
    }
    
    $done({body: modifiedBody});
}

onResponse();