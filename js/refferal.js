// Referral system functionality
document.addEventListener('DOMContentLoaded', async function() {
    await loadReferralData();
    await loadReferralTree();
    await loadCommissionHistory();
});

async function loadReferralData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get user data
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // Update UI with user data
        document.getElementById('totalReferralEarnings').textContent = 
            utils.formatCoins(userData.referral_earned) + ' Coins';
        document.getElementById('userReferralCode').textContent = userData.referral_code;
        document.getElementById('referralLink').value = 
            `${window.location.origin}/pages/login.html?ref=${userData.referral_code}`;
        document.getElementById('userEarnings').textContent = 
            utils.formatCoins(userData.referral_earned) + ' coins earned';

        // Load referral stats
        await loadReferralStats(user.id);

    } catch (error) {
        console.error('Error loading referral data:', error);
        utils.showNotification('Error loading referral data', 'error');
    }
}

async function loadReferralStats(userId) {
    try {
        // Count direct referrals
        const { data: directRefs, error: refError } = await supabase
            .from('users')
            .select('id')
            .eq('referred_by', userId);

        if (!refError) {
            document.getElementById('directReferrals').textContent = directRefs.length;
        }

        // Count total network (simplified - in real app, this would be recursive)
        const { data: level2Refs } = await supabase
            .from('users')
            .select('id')
            .in('referred_by', directRefs?.map(u => u.id) || []);

        const totalNetwork = (directRefs?.length || 0) + (level2Refs?.length || 0);
        document.getElementById('totalNetwork').textContent = totalNetwork;

        // Load commission stats (simplified)
        const today = new Date().toDateString();
        const thisMonth = new Date().getMonth();
        
        // These would normally come from the database
        document.getElementById('todayCommissions').textContent = utils.formatCoins(0);
        document.getElementById('monthlyCommissions').textContent = utils.formatCoins(0);

    } catch (error) {
        console.error('Error loading referral stats:', error);
    }
}

async function loadReferralTree() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Load direct referrals (Level 1)
        const { data: directRefs, error } = await supabase
            .from('users')
            .select('id, email, created_at, wallet_balance')
            .eq('referred_by', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const level1Container = document.getElementById('level1Users');
        level1Container.innerHTML = '';

        if (directRefs.length === 0) {
            level1Container.innerHTML = '<div class="empty-level">No direct referrals yet</div>';
            return;
        }

        directRefs.forEach(ref => {
            const userNode = document.createElement('div');
            userNode.className = 'user-node';
            userNode.innerHTML = `
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-info">
                    <div class="user-name">${ref.email.split('@')[0]}</div>
                    <div class="user-join-date">Joined ${new Date(ref.created_at).toLocaleDateString()}</div>
                </div>
                <div class="user-stats">
                    <div class="user-balance">${utils.formatCoins(ref.wallet_balance)} coins</div>
                </div>
            `;
            level1Container.appendChild(userNode);
        });

    } catch (error) {
        console.error('Error loading referral tree:', error);
    }
}

async function loadCommissionHistory(filter = 'all') {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // In a real app, this would query the referral_commissions table
        // For now, we'll use mock data
        const mockCommissions = [
            {
                id: 1,
                source_user_id: 'user2',
                level: 1,
                coins_amount: 250,
                status: 'paid',
                date_created: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                source_user_id: 'user3',
                level: 1,
                coins_amount: 500,
                status: 'paid',
                date_created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 3,
                source_user_id: 'user4',
                level: 2,
                coins_amount: 100,
                status: 'paid',
                date_created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        displayCommissions(mockCommissions);

    } catch (error) {
        console.error('Error loading commission history:', error);
        document.getElementById('commissionList').innerHTML = 
            '<div class="commission-item">Error loading commission history</div>';
    }
}

function displayCommissions(commissions) {
    const commissionList = document.getElementById('commissionList');
    
    if (commissions.length === 0) {
        commissionList.innerHTML = '<div class="commission-item">No commissions yet</div>';
        return;
    }

    commissionList.innerHTML = '';

    commissions.forEach(commission => {
        const commissionItem = document.createElement('div');
        commissionItem.className = 'commission-item';
        
        commissionItem.innerHTML = `
            <div class="commission-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="commission-details">
                <div class="commission-description">
                    Level ${commission.level} Referral Commission
                </div>
                <div class="commission-date">
                    ${new Date(commission.date_created).toLocaleDateString()}
                </div>
            </div>
            <div class="commission-amount">
                +${utils.formatCoins(commission.coins_amount)}
            </div>
        `;
        
        commissionList.appendChild(commissionItem);
    });
}

function copyReferralCode() {
    const code = document.getElementById('userReferralCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        utils.showNotification('Referral code copied to clipboard!', 'success');
    });
}

function copyReferralLink() {
    const link = document.getElementById('referralLink');
    link.select();
    document.execCommand('copy');
    utils.showNotification('Referral link copied to clipboard!', 'success');
}

function shareReferral() {
    const link = document.getElementById('referralLink').value;
    const text = `Join Cryptra and start earning crypto rewards! Use my referral code: ${document.getElementById('userReferralCode').textContent}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Join Cryptra',
            text: text,
            url: link
        });
    } else {
        // Fallback for browsers that don't support Web Share API
        copyReferralLink();
        utils.showNotification('Referral link copied! You can now share it.', 'info');
    }
}

function filterCommissions(filter) {
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadCommissionHistory(filter);
}

// Add referral-specific styles
const referralStyles = `
    .referral-stats {
        margin: 2rem 0;
    }

    .stat-card.large {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        color: white;
        padding: 2rem;
        border-radius: 12px;
        margin-bottom: 2rem;
        box-shadow: var(--shadow);
    }

    .stat-main h3 {
        opacity: 0.9;
        margin-bottom: 0.5rem;
    }

    .stat-main h1 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .stat-item {
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

    .referral-share {
        background: var(--card-bg);
        padding: 2rem;
        border-radius: 8px;
        margin: 2rem 0;
        box-shadow: var(--shadow);
    }

    .referral-share h2 {
        margin-bottom: 1.5rem;
        text-align: center;
        color: var(--text);
    }

    .referral-code-large {
        text-align: center;
        margin-bottom: 2rem;
    }

    .code-display {
        font-family: monospace;
        font-size: 2rem;
        font-weight: 700;
        margin: 1rem 0;
        background: var(--background);
        color: var(--text);
        padding: 1rem 2rem;
        border-radius: 8px;
        display: inline-block;
        border: 2px dashed var(--primary);
    }

    .share-buttons {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
    }

    .referral-link {
        text-align: center;
    }

    .link-container {
        display: flex;
        gap: 0.5rem;
        max-width: 500px;
        margin: 1rem auto;
    }

    .link-container .form-input {
        flex: 1;
    }

    .commission-structure {
        background: var(--card-bg);
        padding: 2rem;
        border-radius: 8px;
        margin: 2rem 0;
        box-shadow: var(--shadow);
    }

    .commission-structure h2 {
        margin-bottom: 1.5rem;
        text-align: center;
        color: var(--text);
    }

    .levels-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
    }

    .level-item {
        background: var(--background);
        padding: 1.5rem;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 1rem;
        border: 1px solid var(--border);
    }

    .level-number {
        width: 40px;
        height: 40px;
        background: var(--primary);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 1.1rem;
    }

    .level-info h4 {
        margin-bottom: 0.25rem;
        color: var(--text);
    }

    .level-info p {
        color: var(--text-light);
        font-size: 0.9rem;
    }

    .referral-tree {
        background: var(--card-bg);
        padding: 2rem;
        border-radius: 8px;
        margin: 2rem 0;
        box-shadow: var(--shadow);
    }

    .referral-tree h2 {
        margin-bottom: 1.5rem;
        text-align: center;
        color: var(--text);
    }

    .tree-container {
        position: relative;
    }

    .tree-level {
        margin-bottom: 2rem;
    }

    .level-label {
        font-weight: 600;
        color: var(--text-light);
        margin-bottom: 1rem;
        text-align: center;
    }

    .user-node {
        background: var(--background);
        padding: 1rem;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 1rem;
        border: 1px solid var(--border);
        max-width: 300px;
        margin: 0 auto;
    }

    .user-node.current-user {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        color: white;
        border: none;
    }

    .user-avatar {
        width: 50px;
        height: 50px;
        background: var(--secondary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.2rem;
    }

    .current-user .user-avatar {
        background: white;
        color: var(--primary);
    }

    .user-info {
        flex: 1;
    }

    .user-name {
        font-weight: 600;
        margin-bottom: 0.25rem;
    }

    .user-join-date,
    .user-earnings {
        font-size: 0.8rem;
        opacity: 0.8;
    }

    .user-stats {
        text-align: right;
    }

    .user-balance {
        font-weight: 600;
        color: var(--secondary);
    }

    .current-user .user-balance {
        color: white;
    }

    .level-users {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
    }

    .empty-level {
        text-align: center;
        color: var(--text-light);
        font-style: italic;
        padding: 2rem;
        background: var(--background);
        border-radius: 8px;
        border: 1px dashed var(--border);
    }

    .tree-connector {
        height: 40px;
        border-left: 2px solid var(--border);
        margin: 0 auto;
        width: 2px;
    }

    .commission-history {
        margin: 2rem 0;
    }

    .commission-history h2 {
        margin-bottom: 1.5rem;
        color: var(--text);
    }

    .history-filters {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
    }

    .filter-btn {
        padding: 0.5rem 1rem;
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: 20px;
        color: var(--text);
        cursor: pointer;
        transition: all 0.3s;
    }

    .filter-btn.active,
    .filter-btn:hover {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
    }

    .commission-list {
        background: var(--card-bg);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: var(--shadow);
    }

    .commission-item {
        display: flex;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border);
    }

    .commission-item:last-child {
        border-bottom: none;
    }

    .commission-item.loading {
        justify-content: center;
        color: var(--text-light);
    }

    .commission-icon {
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

    .commission-details {
        flex: 1;
    }

    .commission-description {
        font-weight: 500;
        margin-bottom: 0.25rem;
    }

    .commission-date {
        font-size: 0.8rem;
        color: var(--text-light);
    }

    .commission-amount {
        font-weight: 600;
        color: var(--secondary);
        font-size: 1.1rem;
    }

    @media (max-width: 768px) {
        .code-display {
            font-size: 1.5rem;
            padding: 0.75rem 1.5rem;
        }

        .share-buttons {
            flex-direction: column;
        }

        .share-buttons .btn {
            width: 100%;
        }

        .levels-grid {
            grid-template-columns: 1fr;
        }

        .level-users {
            grid-template-columns: 1fr;
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = referralStyles;
document.head.appendChild(styleSheet);
