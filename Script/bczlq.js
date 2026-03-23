// Baicizhan Membership Status Monitor
// Monitors membership expiration and alerts when status changes

let body = $response.body;
let obj = JSON.parse(body);

if (obj.success && obj.data && obj.data.memberships) {
    let membership = obj.data.memberships[0];
    
    if (membership) {
        let expireTime = new Date(membership.expireTime);
        let now = new Date();
        let daysLeft = Math.ceil((expireTime - now) / (1000 * 60 * 60 * 24));
        
        // Check if membership is valid
        let isValid = membership.valid;
        
        // Format notification message
        let status = isValid ? "✅ ACTIVE" : "⚠️ EXPIRED";
        let message = `Status: ${status}\n`;
        message += `Type: ${membership.membershipType}\n`;
        message += `Expires: ${membership.expireTime}\n`;
        
        if (daysLeft > 0 && isValid) {
            message += `Days left: ${daysLeft} days`;
            
            // Alert if membership is expiring soon (within 7 days)
            if (daysLeft <= 7 && daysLeft > 0) {
                $notification.post(
                    "Membership Expiring Soon",
                    `${membership.membershipType}`,
                    `Your membership expires in ${daysLeft} days on ${membership.expireTime}`
                );
            }
        } else if (!isValid) {
            message += `Expired since: ${membership.expireTime}`;
            $notification.post(
                "Membership Expired",
                `${membership.membershipType}`,
                `Your membership has expired on ${membership.expireTime}`
            );
        }
        
        // Log to console
        console.log(`[Membership Status] ${message}`);
        
        // Store in persistent cache
        $persistentStore.write(JSON.stringify({
            status: isValid,
            expireTime: membership.expireTime,
            membershipType: membership.membershipType,
            lastCheck: new Date().toISOString(),
            daysLeft: daysLeft
        }), "baicizhan_membership");
        
    } else {
        console.log("[Membership Status] No membership found");
        $persistentStore.write(JSON.stringify({
            status: false,
            message: "No active membership"
        }), "baicizhan_membership");
    }
}

$done({body: JSON.stringify(obj)});