// Dashboard functionality
document.addEventListener('DOMContentLoaded', async function() {
    await loadUserData();
    await loadRecentActivity();
    await loadReferralStats();
});

async function loadUserData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Get user profile
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // Update UI with user data
        document.getElementById('walletBalance').textContent = utils.formatCoins(userData.wallet_balance) + ' Coins';
        document.getElementById('cashValue').textContent = '≈ $' + utils.coinsToCash(userData.wallet_balance);
        document.getElementById('referralEarnings').textContent = utils.formatCoins(userData.referral_earned);
        document.getElementById('referralCodeDisplay').textContent = userData.referral_code;

        // Load check-in streak
        loadCheckinStreak(user.id);

    } catch (error) {
        console.error('Error loading user data:', error);
        utils.showNotification('Error loading dashboard data', 'error');
    }
}

async function loadRecentActivity() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: transactions, error } = await supabase
            .from('coin_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        const activityList = document.getElementById('recentActivity');
        activityList.innerHTML = '';

        if (transactions.length === 0) {
            activityList.innerHTML = '<div class="activity-item">No activity yet</div>';
            return;
        }

        transactions.forEach(transaction => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            const icon = getActivityIcon(transaction.source_type);
            const description = getActivityDescription(transaction.source_type, transaction.coins_amount);
            const date = new Date(transaction.created_at).toLocaleDateString();
            
            activityItem.innerHTML = `
                <div class="activity-icon">${icon}</div>
                <div class="activity-details">
                    <div class="activity-description">${description}</div>
                    <div class="activity-date">${date}</div>
                </div>
                <div class="activity-amount ${transaction.coins_amount >= 0 ? 'positive' : 'negative'}">
                    ${transaction.coins_amount >= 0 ? '+' : ''}${utils.formatCoins(transaction.coins_amount)}
                </div>
            `;
            
            activityList.appendChild(activityItem);
        });

    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

async function loadReferralStats() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Count direct referrals
        const { data: referrals, error } = await supabase
            .from('users')
            .select('id')
            .eq('referred_by', user.id);

        if (error) throw error;

        document.getElementById('referralCount').textContent = referrals?.length || 0;

        // Calculate total earned (simplified - in real app, sum from referral_commissions)
        const { data: userData } = await supabase
            .from('users')
            .select('referral_earned, wallet_balance')
            .eq('id', user.id)
            .single();

        if (userData) {
            document.getElementById('totalEarned').textContent = utils.formatCoins(userData.wallet_balance + userData.referral_earned);
        }

    } catch (error) {
        console.error('Error loading referral stats:', error);
    }
}

async function loadCheckinStreak(userId) {
    // This would typically come from the database
    // For now, we'll use localStorage
    const streakData = JSON.parse(localStorage.getItem(`checkin_streak_${userId}`) || '{"streak": 0, "lastCheckin": null}');
    
    const today = new Date().toDateString();
    const lastCheckin = streakData.lastCheckin ? new Date(streakData.lastCheckin).toDateString() : null;
    
    let currentStreak = streakData.streak;
    
    // Reset streak if missed a day
    if (lastCheckin && lastCheckin !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastCheckin !== yesterday.toDateString()) {
            currentStreak = 0;
        }
    }
    
    document.getElementById('checkinStreak').textContent = currentStreak;
    document.getElementById('currentDay').textContent = (currentStreak % 7) + 1;
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
        'purchase': 'fas fa-shopping-cart'
    };
    
    return `<i class="${icons[sourceType] || 'fas fa-coins'}"></i>`;
}

function getActivityDescription(sourceType, amount) {
    const descriptions = {
        'signup': 'Signup Bonus',
        'video': 'Watch Video Reward',
        'scratch': 'Scratch Card Win',
        'treasure': 'Treasure Box Reward',
        'referral': 'Referral Commission',
        'checkin': 'Daily Check-in',
        'withdrawal': 'Withdrawal',
        'purchase': 'Marketplace Purchase'
    };
    
    return descriptions[sourceType] || 'Coin Transaction';
}

function copyReferralCode() {
    const code = document.getElementById('referralCodeDisplay').textContent;
    navigator.clipboard.writeText(code).then(() => {
        utils.showNotification('Referral code copied to clipboard!', 'success');
    });
}

// Add CSS for dashboard components
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

    .activity-item.loading {
        justify-content: center;
        color: var(--text-light);
    }

    .activity-icon {
        width: 40px;
        height: 40px;
        background: var(--primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        margin-right: 1rem;
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
