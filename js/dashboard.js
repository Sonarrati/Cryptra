// Dashboard functionality - FIXED VERSION
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Dashboard loading started...');
    await loadUserData();
    await loadRecentActivity();
    await loadReferralStats();
});

async function loadUserData() {
    try {
        console.log('Starting user data load...');
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
            console.error('Auth error:', authError);
            window.location.href = 'login.html';
            return;
        }

        if (!user) {
            console.log('No user found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        console.log('User found:', user.id, user.email);

        // Get user profile with retry logic
        let userData;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error(`Attempt ${retryCount + 1} - Error fetching user data:`, error);
                
                if (error.code === 'PGRST116') {
                    // User doesn't exist in database, create profile
                    console.log('User profile not found, creating...');
                    await createUserProfile(user);
                    retryCount++;
                    continue;
                } else {
                    throw error;
                }
            }

            userData = data;
            break;
        }

        if (!userData) {
            throw new Error('Failed to load user data after retries');
        }

        console.log('User data loaded successfully:', userData);

        // Update UI with user data
        updateDashboardUI(userData);

        // Load check-in streak
        await loadCheckinStreak(user.id);

    } catch (error) {
        console.error('Critical error loading user data:', error);
        showErrorState();
    }
}

function updateDashboardUI(userData) {
    try {
        // Update balance
        const walletBalance = userData.wallet_balance || 0;
        const referralEarned = userData.referral_earned || 0;
        
        document.getElementById('walletBalance').textContent = formatCoins(walletBalance) + ' Coins';
        document.getElementById('cashValue').textContent = '≈ $' + coinsToCash(walletBalance);
        document.getElementById('referralEarnings').textContent = formatCoins(referralEarned);
        
        if (userData.referral_code) {
            document.getElementById('referralCodeDisplay').textContent = userData.referral_code;
        } else {
            document.getElementById('referralCodeDisplay').textContent = 'N/A';
        }

    } catch (error) {
        console.error('Error updating UI:', error);
    }
}

async function createUserProfile(user) {
    try {
        console.log('Creating user profile for:', user.id);
        
        const referralCode = generateReferralCode();
        const signupBonus = 2000;

        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    id: user.id,
                    email: user.email,
                    referral_code: referralCode,
                    wallet_balance: signupBonus,
                    referral_earned: 0,
                    kyc_status: 'pending',
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating user profile:', error);
            
            // If it's a duplicate error, maybe profile was created by another process
            if (error.code === '23505') {
                console.log('User profile already exists, continuing...');
                return;
            }
            throw error;
        }

        console.log('User profile created successfully:', data);

        // Record signup bonus transaction
        const { error: transactionError } = await supabase
            .from('coin_transactions')
            .insert([
                {
                    user_id: user.id,
                    source_type: 'signup',
                    coins_amount: signupBonus,
                    balance_after: signupBonus,
                    created_at: new Date().toISOString()
                }
            ]);

        if (transactionError) {
            console.error('Error recording signup transaction:', transactionError);
            // Don't throw, as user profile was created successfully
        }

        console.log('Signup bonus transaction recorded');
        return data;

    } catch (error) {
        console.error('Error in createUserProfile:', error);
        throw error;
    }
}

function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function loadRecentActivity() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('Loading recent activity for user:', user.id);

        const { data: transactions, error } = await supabase
            .from('coin_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error loading transactions:', error);
            // Show placeholder activity
            showPlaceholderActivity();
            return;
        }

        displayActivities(transactions);

    } catch (error) {
        console.error('Error loading recent activity:', error);
        showPlaceholderActivity();
    }
}

function displayActivities(transactions) {
    const activityList = document.getElementById('recentActivity');
    if (!activityList) return;

    activityList.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        activityList.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon positive">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-description">No activity yet</div>
                    <div class="activity-date">Start earning to see your activity</div>
                </div>
                <div class="activity-amount positive">+0</div>
            </div>
        `;
        return;
    }

    transactions.forEach(transaction => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const icon = getActivityIcon(transaction.source_type);
        const description = getActivityDescription(transaction.source_type);
        const date = new Date(transaction.created_at).toLocaleDateString();
        const isPositive = transaction.coins_amount >= 0;
        const sign = isPositive ? '+' : '';
        
        activityItem.innerHTML = `
            <div class="activity-icon ${isPositive ? 'positive' : 'negative'}">
                ${icon}
            </div>
            <div class="activity-details">
                <div class="activity-description">${description}</div>
                <div class="activity-date">${date}</div>
            </div>
            <div class="activity-amount ${isPositive ? 'positive' : 'negative'}">
                ${sign}${formatCoins(transaction.coins_amount)}
            </div>
        `;
        
        activityList.appendChild(activityItem);
    });
}

function showPlaceholderActivity() {
    const activityList = document.getElementById('recentActivity');
    if (!activityList) return;

    activityList.innerHTML = `
        <div class="activity-item">
            <div class="activity-icon positive">
                <i class="fas fa-user-plus"></i>
            </div>
            <div class="activity-details">
                <div class="activity-description">Welcome to Cryptra!</div>
                <div class="activity-date">Just now</div>
            </div>
            <div class="activity-amount positive">+2,000</div>
        </div>
    `;
}

async function loadReferralStats() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('Loading referral stats for user:', user.id);

        // Get user's referral code first
        const { data: userData } = await supabase
            .from('users')
            .select('referral_code, referral_earned, wallet_balance')
            .eq('id', user.id)
            .single();

        if (!userData) return;

        // Count direct referrals
        const { data: referrals, error } = await supabase
            .from('users')
            .select('id')
            .eq('referred_by', userData.referral_code);

        if (error) {
            console.error('Error counting referrals:', error);
        }

        const referralCount = referrals ? referrals.length : 0;
        
        // Update UI
        updateReferralStats(referralCount, userData);

    } catch (error) {
        console.error('Error loading referral stats:', error);
        // Set default values
        document.getElementById('referralCount').textContent = '0';
        document.getElementById('totalEarned').textContent = '0';
    }
}

function updateReferralStats(referralCount, userData) {
    try {
        const referralCountElement = document.getElementById('referralCount');
        const totalEarnedElement = document.getElementById('totalEarned');
        
        if (referralCountElement) {
            referralCountElement.textContent = referralCount;
        }
        
        if (totalEarnedElement && userData) {
            const totalEarned = (userData.wallet_balance || 0) + (userData.referral_earned || 0);
            totalEarnedElement.textContent = formatCoins(totalEarned);
        }
    } catch (error) {
        console.error('Error updating referral stats:', error);
    }
}

async function loadCheckinStreak(userId) {
    try {
        // Simple streak tracking using localStorage
        let streakData;
        try {
            streakData = JSON.parse(localStorage.getItem(`checkin_streak_${userId}`) || '{"streak": 0, "lastCheckin": null}');
        } catch (e) {
            streakData = { streak: 0, lastCheckin: null };
        }
        
        const today = new Date().toDateString();
        const lastCheckin = streakData.lastCheckin ? new Date(streakData.lastCheckin).toDateString() : null;
        
        let currentStreak = streakData.streak || 0;
        
        // Reset streak if missed a day
        if (lastCheckin && lastCheckin !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastCheckin !== yesterday.toDateString()) {
                currentStreak = 0;
                // Update localStorage
                localStorage.setItem(`checkin_streak_${userId}`, JSON.stringify({
                    streak: 0,
                    lastCheckin: null
                }));
            }
        }
        
        // Update UI
        updateCheckinUI(currentStreak);

    } catch (error) {
        console.error('Error loading check-in streak:', error);
        updateCheckinUI(0);
    }
}

function updateCheckinUI(currentStreak) {
    try {
        const checkinStreakElement = document.getElementById('checkinStreak');
        const currentDayElement = document.getElementById('currentDay');
        
        if (checkinStreakElement) {
            checkinStreakElement.textContent = currentStreak;
        }
        if (currentDayElement) {
            currentDayElement.textContent = (currentStreak % 7) + 1;
        }
    } catch (error) {
        console.error('Error updating checkin UI:', error);
    }
}

function getActivityIcon(sourceType) {
    const icons = {
        'signup': 'fas fa-user-plus',
        'video': 'fas fa-video',
        'scratch': 'fas fa-scroll',
        'treasure': 'fas fa-gem',
        'referral': 'fas fa-users',
        'checkin': 'fas fa-calendar-check',
        'withdrawal': 'fas fa-money-bill-wave',
        'purchase': 'fas fa-shopping-cart',
        'spend': 'fas fa-coins'
    };
    
    const iconClass = icons[sourceType] || 'fas fa-coins';
    return `<i class="${iconClass}"></i>`;
}

function getActivityDescription(sourceType) {
    const descriptions = {
        'signup': 'Signup Bonus',
        'video': 'Watch Video Reward',
        'scratch': 'Scratch Card Win',
        'treasure': 'Treasure Box Reward',
        'referral': 'Referral Commission',
        'checkin': 'Daily Check-in',
        'withdrawal': 'Withdrawal',
        'purchase': 'Marketplace Purchase',
        'spend': 'Coin Spend'
    };
    
    return descriptions[sourceType] || 'Coin Transaction';
}

function copyReferralCode() {
    try {
        const codeElement = document.getElementById('referralCodeDisplay');
        if (!codeElement) {
            showNotification('Referral code not available', 'error');
            return;
        }
        
        const code = codeElement.textContent;
        if (!code || code === 'LOADING...' || code === 'N/A') {
            showNotification('Referral code not ready', 'warning');
            return;
        }
        
        navigator.clipboard.writeText(code).then(() => {
            showNotification('Referral code copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Referral code copied to clipboard!', 'success');
        });
    } catch (error) {
        console.error('Error copying referral code:', error);
        showNotification('Error copying referral code', 'error');
    }
}

function showErrorState() {
    // Set default values
    document.getElementById('walletBalance').textContent = '0 Coins';
    document.getElementById('cashValue').textContent = '≈ $0.00';
    document.getElementById('referralEarnings').textContent = '0';
    document.getElementById('referralCodeDisplay').textContent = 'ERROR';
    document.getElementById('referralCount').textContent = '0';
    document.getElementById('totalEarned').textContent = '0';
    document.getElementById('checkinStreak').textContent = '0';
    document.getElementById('currentDay').textContent = '1';
    
    showPlaceholderActivity();
}

// Utility functions (in case utils is not available)
function formatCoins(coins) {
    if (typeof coins !== 'number') return '0';
    return coins.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function coinsToCash(coins, rate = 10000) {
    if (typeof coins !== 'number') return '0.00';
    return (coins / rate).toFixed(2);
}

function showNotification(message, type = 'info') {
    // Simple notification implementation
    console.log(`${type.toUpperCase()}: ${message}`);
    alert(`${type.toUpperCase()}: ${message}`);
}

// Add dashboard styles
const dashboardStyles = `
    .balance-card {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        color: white;
        padding: 2rem;
        border-radius: 12px;
        margin: 2rem 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: var(--shadow);
    }

    .balance-info h3 {
        margin-bottom: 0.5rem;
        opacity: 0.9;
    }

    .balance-info h1 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
    }

    .balance-actions {
        display: flex;
        gap: 1rem;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin: 2rem 0;
    }

    .stat-card {
        background: var(--card-bg);
        padding: 1.5rem;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 1rem;
        box-shadow: var(--shadow);
    }

    .stat-icon {
        width: 50px;
        height: 50px;
        background: var(--primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.2rem;
    }

    .stat-info h4 {
        font-size: 1.5rem;
        margin-bottom: 0.25rem;
    }

    .stat-info p {
        color: var(--text-light);
        font-size: 0.9rem;
    }

    .section {
        margin: 3rem 0;
    }

    .section h2 {
        margin-bottom: 1.5rem;
        color: var(--text);
    }

    .earn-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
    }

    .earn-card {
        background: var(--card-bg);
        padding: 2rem;
        border-radius: 12px;
        text-align: center;
        text-decoration: none;
        color: var(--text);
        transition: transform 0.3s, box-shadow 0.3s;
        position: relative;
        box-shadow: var(--shadow);
    }

    .earn-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    }

    .earn-icon {
        width: 70px;
        height: 70px;
        background: var(--primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.5rem;
        margin: 0 auto 1rem;
    }

    .earn-card h3 {
        margin-bottom: 0.5rem;
    }

    .earn-card p {
        color: var(--text-light);
        margin-bottom: 1rem;
    }

    .earn-badge {
        background: var(--secondary);
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
    }

    .earn-badge.streak {
        background: var(--accent);
    }

    .activity-list {
        background: var(--card-bg);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: var(--shadow);
    }

    .activity-item {
        display: flex;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border);
    }

    .activity-item:last-child {
        border-bottom: none;
    }

    .activity-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 1rem;
        font-size: 1.1rem;
    }

    .activity-icon.positive {
        background: #d1fae5;
        color: #065f46;
    }

    .activity-icon.negative {
        background: #fee2e2;
        color: #dc2626;
    }

    .activity-details {
        flex: 1;
    }

    .activity-description {
        font-weight: 500;
        margin-bottom: 0.25rem;
    }

    .activity-date {
        font-size: 0.8rem;
        color: var(--text-light);
    }

    .activity-amount {
        font-weight: 600;
        font-size: 1.1rem;
    }

    .activity-amount.positive {
        color: var(--secondary);
    }

    .activity-amount.negative {
        color: #ef4444;
    }

    .referral-section {
        background: linear-gradient(135deg, var(--secondary) 0%, #0da271 100%);
        color: white;
        padding: 3rem;
        border-radius: 12px;
        margin: 3rem 0;
        text-align: center;
        box-shadow: var(--shadow);
    }

    .referral-content h2 {
        margin-bottom: 1rem;
    }

    .referral-content p {
        margin-bottom: 2rem;
        opacity: 0.9;
    }

    .referral-code {
        background: rgba(255,255,255,0.2);
        padding: 1.5rem;
        border-radius: 8px;
        margin-bottom: 2rem;
        display: inline-block;
    }

    .code-display {
        font-family: monospace;
        font-size: 1.5rem;
        font-weight: 700;
        margin: 1rem 0;
        background: rgba(255,255,255,0.9);
        color: var(--text);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        display: inline-block;
        min-width: 150px;
    }

    @media (max-width: 768px) {
        .balance-card {
            flex-direction: column;
            text-align: center;
            gap: 1.5rem;
        }

        .balance-actions {
            flex-direction: column;
            width: 100%;
        }

        .balance-actions .btn {
            width: 100%;
        }

        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }

        .earn-grid {
            grid-template-columns: 1fr;
        }
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = dashboardStyles;
document.head.appendChild(styleSheet);

// Make functions globally available
window.copyReferralCode = copyReferralCode;
