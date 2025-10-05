// Wallet functionality
document.addEventListener('DOMContentLoaded', async function() {
    await loadWalletData();
    await loadTransactionHistory();
});

async function loadWalletData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // Update balance displays
        document.getElementById('totalBalance').textContent = utils.formatCoins(userData.wallet_balance) + ' Coins';
        document.getElementById('totalCash').textContent = '≈ $' + utils.coinsToCash(userData.wallet_balance);
        document.getElementById('availableBalance').textContent = utils.formatCoins(userData.wallet_balance) + ' Coins';
        document.getElementById('referralBalance').textContent = utils.formatCoins(userData.referral_earned) + ' Coins';

        // Load pending withdrawal amount
        const { data: pendingWithdrawal } = await supabase
            .from('withdrawals')
            .select('coins_used')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .single();

        const pendingAmount = pendingWithdrawal ? pendingWithdrawal.coins_used : 0;
        document.getElementById('pendingBalance').textContent = utils.formatCoins(pendingAmount) + ' Coins';

    } catch (error) {
        console.error('Error loading wallet data:', error);
        utils.showNotification('Error loading wallet data', 'error');
    }
}

async function loadTransactionHistory(filter = 'all') {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        let query = supabase
            .from('coin_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // Apply filters
        if (filter === 'earned') {
            query = query.gte('coins_amount', 0);
        } else if (filter === 'spent') {
            query = query.lt('coins_amount', 0);
        } else if (filter === 'withdrawal') {
            query = query.eq('source_type', 'withdrawal');
        }

        const { data: transactions, error } = await query;

        if (error) throw error;

        displayTransactions(transactions);

    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('transactionList').innerHTML = 
            '<div class="transaction-item">Error loading transactions</div>';
    }
}

function displayTransactions(transactions) {
    const transactionList = document.getElementById('transactionList');
    
    if (transactions.length === 0) {
        transactionList.innerHTML = '<div class="transaction-item">No transactions found</div>';
        return;
    }

    transactionList.innerHTML = '';

    transactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';
        
        const icon = getTransactionIcon(transaction.source_type);
        const isPositive = transaction.coins_amount >= 0;
        const sign = isPositive ? '+' : '';
        
        transactionItem.innerHTML = `
            <div class="transaction-icon ${isPositive ? 'positive' : 'negative'}">
                ${icon}
            </div>
            <div class="transaction-details">
                <div class="transaction-title">${getTransactionTitle(transaction.source_type)}</div>
                <div class="transaction-date">${new Date(transaction.created_at).toLocaleString()}</div>
            </div>
            <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
                ${sign}${utils.formatCoins(transaction.coins_amount)}
            </div>
        `;
        
        transactionList.appendChild(transactionItem);
    });
}

function getTransactionIcon(sourceType) {
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

function getTransactionTitle(sourceType) {
    const titles = {
        'signup': 'Signup Bonus',
        'video': 'Video Reward',
        'scratch': 'Scratch Card',
        'treasure': 'Treasure Box',
        'referral': 'Referral Commission',
        'checkin': 'Daily Check-in',
        'withdrawal': 'Withdrawal',
        'purchase': 'Marketplace Purchase'
    };
    
    return titles[sourceType] || 'Transaction';
}

function filterTransactions(type) {
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadTransactionHistory(type);
}

// Add wallet-specific styles
const walletStyles = `
    .wallet-overview {
        margin: 2rem 0;
    }

    .balance-card.large {
        padding: 2rem;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        color: white;
        border-radius: 12px;
        box-shadow: var(--shadow);
    }

    .balance-main {
        text-align: center;
        margin-bottom: 2rem;
    }

    .balance-main h3 {
        opacity: 0.9;
        margin-bottom: 0.5rem;
    }

    .balance-main h1 {
        font-size: 3rem;
        margin-bottom: 0.5rem;
    }

    .balance-breakdown {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        background: rgba(255,255,255,0.1);
        padding: 1.5rem;
        border-radius: 8px;
    }

    .balance-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .wallet-actions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        margin: 2rem 0;
    }

    .action-btn {
        background: var(--card-bg);
        padding: 1.5rem;
        border-radius: 8px;
        text-align: center;
        text-decoration: none;
        color: var(--text);
        transition: transform 0.3s;
        box-shadow: var(--shadow);
    }

    .action-btn:hover {
        transform: translateY(-2px);
    }

    .action-btn i {
        font-size: 2rem;
        color: var(--primary);
        margin-bottom: 0.5rem;
        display: block;
    }

    .transaction-filters {
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

    .transaction-list {
        background: var(--card-bg);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: var(--shadow);
    }

    .transaction-item {
        display: flex;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border);
    }

    .transaction-item:last-child {
        border-bottom: none;
    }

    .transaction-item.loading {
        justify-content: center;
        color: var(--text-light);
    }

    .transaction-icon {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 1rem;
        font-size: 1.2rem;
    }

    .transaction-icon.positive {
        background: #d1fae5;
        color: #065f46;
    }

    .transaction-icon.negative {
        background: #fee2e2;
        color: #dc2626;
    }

    .transaction-details {
        flex: 1;
    }

    .transaction-title {
        font-weight: 500;
        margin-bottom: 0.25rem;
    }

    .transaction-date {
        font-size: 0.8rem;
        color: var(--text-light);
    }

    .transaction-amount {
        font-weight: 600;
        font-size: 1.1rem;
    }

    .transaction-amount.positive {
        color: var(--secondary);
    }

    .transaction-amount.negative {
        color: #ef4444;
    }

    @media (max-width: 768px) {
        .balance-main h1 {
            font-size: 2rem;
        }

        .balance-breakdown {
            grid-template-columns: 1fr;
        }

        .wallet-actions {
            grid-template-columns: repeat(2, 1fr);
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = walletStyles;
document.head.appendChild(styleSheet);
