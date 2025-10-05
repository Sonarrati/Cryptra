// Referral system functionality - FIXED VERSION
document.addEventListener('DOMContentLoaded', async function() {
    await loadReferralData();
    await loadReferralTree();
    await loadCommissionHistory();
});

async function loadReferralData() {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.error('Auth error:', authError);
            return;
        }

        console.log('Loading referral data for user:', user.id);

        // Get user data
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error loading user data:', error);
            throw error;
        }

        // Update UI with user data
        if (userData) {
            document.getElementById('totalReferralEarnings').textContent = 
                utils.formatCoins(userData.referral_earned || 0) + ' Coins';
            document.getElementById('userReferralCode').textContent = userData.referral_code || 'ERROR';
            document.getElementById('referralLink').value = 
                `${window.location.origin}/pages/login.html?ref=${userData.referral_code}`;
            document.getElementById('userEarnings').textContent = 
                utils.formatCoins(userData.referral_earned || 0) + ' coins earned';
        }

        // Load referral stats
        await loadReferralStats(user.id, userData.referral_code);

    } catch (error) {
        console.error('Error loading referral data:', error);
        utils.showNotification('Error loading referral data', 'error');
        
        // Set default values
        document.getElementById('totalReferralEarnings').textContent = '0 Coins';
        document.getElementById('userReferralCode').textContent = 'ERROR';
        document.getElementById('userEarnings').textContent = '0 coins earned';
    }
}

async function loadReferralStats(userId, referralCode) {
    try {
        console.log('Loading referral stats for user:', userId, 'Code:', referralCode);

        // Count direct referrals using referral code
        const { data: directRefs, error: refError } = await supabase
            .from('users')
            .select('id, email, created_at, wallet_balance')
            .eq('referred_by', referralCode);

        if (refError) {
            console.error('Error counting referrals:', refError);
        }

        const referralCount = directRefs ? directRefs.length : 0;
        
        // Update UI elements
        const referralCountElement = document.getElementById('directReferrals');
        const totalNetworkElement = document.getElementById('totalNetwork');
        
        if (referralCountElement) {
            referralCountElement.textContent = referralCount;
        }

        // Calculate total network (simplified - levels 1+2)
        let totalNetwork = referralCount;
        if (directRefs && directRefs.length > 0) {
            // Get level 2 referrals
            const level2UserIds = directRefs.map(ref => ref.id);
            const { data: level2Refs } = await supabase
                .from('users')
                .select('id')
                .in('referred_by', level2UserIds);

            if (level2Refs) {
                totalNetwork += level2Refs.length;
            }
        }

        if (totalNetworkElement) {
            totalNetworkElement.textContent = totalNetwork;
        }

        // Load today's and monthly commissions (simplified)
        const today = new Date().toDateString();
        const thisMonth = new Date().getMonth();
        
        // These would normally come from database
        document.getElementById('todayCommissions').textContent = '0';
        document.getElementById('monthlyCommissions').textContent = utils.formatCoins(0);

    } catch (error) {
        console.error('Error loading referral stats:', error);
        // Set default values
        document.getElementById('directReferrals').textContent = '0';
        document.getElementById('totalNetwork').textContent = '0';
        document.getElementById('todayCommissions').textContent = '0';
        document.getElementById('monthlyCommissions').textContent = '0';
    }
}

async function loadReferralTree() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('Loading referral tree for user:', user.id);

        // Get user's referral code first
        const { data: userData } = await supabase
            .from('users')
            .select('referral_code')
            .eq('id', user.id)
            .single();

        if (!userData || !userData.referral_code) {
            console.error('No referral code found for user');
            return;
        }

        // Load direct referrals using referral code
        const { data: directRefs, error } = await supabase
            .from('users')
            .select('id, email, created_at, wallet_balance')
            .eq('referred_by', userData.referral_code)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading direct referrals:', error);
            throw error;
        }

        const level1Container = document.getElementById('level1Users');
        if (!level1Container) {
            console.error('Level 1 container not found');
            return;
        }

        level1Container.innerHTML = '';

        if (!directRefs || directRefs.length === 0) {
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
                    <div class="user-balance">${utils.formatCoins(ref.wallet_balance || 0)} coins</div>
                </div>
            `;
            level1Container.appendChild(userNode);
        });

    } catch (error) {
        console.error('Error loading referral tree:', error);
        const level1Container = document.getElementById('level1Users');
        if (level1Container) {
            level1Container.innerHTML = '<div class="empty-level">Error loading referrals</div>';
        }
    }
}

async function loadCommissionHistory(filter = 'all') {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('Loading commission history for user:', user.id);

        // In a real app, this would query the referral_commissions table
        // For demo, we'll create mock data that makes sense
        const mockCommissions = [
            {
                id: 1,
                source_user_id: 'user2',
                level: 1,
                coins_amount: 2500,
                status: 'paid',
                date_created: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                source_user_id: 'user3',
                level: 1,
                coins_amount: 1800,
                status: 'paid',
                date_created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 3,
                source_user_id: 'user4',
                level: 2,
                coins_amount: 900,
                status: 'paid',
                date_created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        displayCommissions(mockCommissions);

    } catch (error) {
        console.error('Error loading commission history:', error);
        const commissionList = document.getElementById('commissionList');
        if (commissionList) {
            commissionList.innerHTML = '<div class="commission-item">Error loading commission history</div>';
        }
    }
}

function displayCommissions(commissions) {
    const commissionList = document.getElementById('commissionList');
    if (!commissionList) {
        console.error('Commission list element not found');
        return;
    }
    
    if (!commissions || commissions.length === 0) {
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
    try {
        const codeElement = document.getElementById('userReferralCode');
        if (!codeElement) {
            utils.showNotification('Referral code element not found', 'error');
            return;
        }
        
        const code = codeElement.textContent;
        if (!code || code === 'LOADING...' || code === 'ERROR') {
            utils.showNotification('Referral code not available yet', 'warning');
            return;
        }
        
        // Use modern clipboard API with fallback
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                utils.showNotification('Referral code copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Clipboard error:', err);
                fallbackCopyText(code);
            });
        } else {
            fallbackCopyText(code);
        }

    } catch (error) {
        console.error('Error copying referral code:', error);
        utils.showNotification('Error copying referral code', 'error');
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        utils.showNotification('Referral code copied to clipboard!', 'success');
    } catch (err) {
        console.error('Fallback copy error:', err);
        utils.showNotification('Failed to copy referral code', 'error');
    }
    
    document.body.removeChild(textArea);
}

function copyReferralLink() {
    try {
        const linkInput = document.getElementById('referralLink');
        if (!linkInput) {
            utils.showNotification('Referral link element not found', 'error');
            return;
        }
        
        linkInput.select();
        linkInput.setSelectionRange(0, 99999); // For mobile devices
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(linkInput.value).then(() => {
                utils.showNotification('Referral link copied to clipboard!', 'success');
            });
        } else {
            document.execCommand('copy');
            utils.showNotification('Referral link copied to clipboard!', 'success');
        }
    } catch (error) {
        console.error('Error copying referral link:', error);
        utils.showNotification('Error copying referral link', 'error');
    }
}

function shareReferral() {
    try {
        const link = document.getElementById('referralLink').value;
        const code = document.getElementById('userReferralCode').textContent;
        const text = `Join Cryptra and start earning crypto rewards! Use my referral code: ${code}\n${link}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Join Cryptra - Earn Crypto Rewards',
                text: text,
                url: link
            }).then(() => {
                console.log('Share successful');
            }).catch(err => {
                console.error('Share error:', err);
                fallbackShare(text);
            });
        } else {
            fallbackShare(text);
        }
    } catch (error) {
        console.error('Error sharing referral:', error);
        utils.showNotification('Error sharing referral', 'error');
    }
}

function fallbackShare(text) {
    copyReferralLink();
    utils.showNotification('Referral link copied! You can now share it anywhere.', 'info');
}

function filterCommissions(filter) {
    try {
        // Update active filter button
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        loadCommissionHistory(filter);
    } catch (error) {
        console.error('Error filtering commissions:', error);
    }
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
        min-width: 200px;
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

    .referral-link p {
        margin-bottom: 1rem;
        color: var(--text);
    }

    .link-container {
        display: flex;
        gap: 0.5rem;
        max-width: 500px;
        margin: 0 auto;
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
        grid-column: 1 / -1;
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

    .error-message {
        background: #fee2e2;
        color: #dc2626;
        padding: 1rem;
        border-radius: 8px;
        text-align: center;
        margin: 1rem 0;
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

        .link-container {
            flex-direction: column;
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = referralStyles;
document.head.appendChild(styleSheet);
