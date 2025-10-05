// Admin panel functionality
document.addEventListener('DOMContentLoaded', function() {
    loadAdminStats();
    loadRecentWithdrawals();
    loadUsersTable();
    loadPendingWithdrawals();
});

// Section navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Update active nav item
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[onclick="showSection('${sectionId}')"]`).classList.add('active');
}

// Load admin statistics
async function loadAdminStats() {
    try {
        // Get total users
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id');
        
        if (!usersError) {
            document.getElementById('totalUsers').textContent = users.length;
        }

        // Get withdrawal stats
        const { data: withdrawals, error: withdrawalsError } = await supabase
            .from('withdrawals')
            .select('*');
        
        if (!withdrawalsError) {
            const totalWithdrawals = withdrawals.length;
            const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
            
            document.getElementById('totalWithdrawals').textContent = totalWithdrawals;
            document.getElementById('pendingWithdrawals').textContent = pendingWithdrawals;
        }

        // Get referral commissions
        const { data: commissions, error: commissionsError } = await supabase
            .from('referral_commissions')
            .select('coins_amount');
        
        if (!commissionsError) {
            const totalCommissions = commissions.reduce((sum, commission) => sum + commission.coins_amount, 0);
            document.getElementById('totalCommissions').textContent = utils.formatCoins(totalCommissions);
        }

    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Load recent withdrawals
async function loadRecentWithdrawals() {
    try {
        const { data: withdrawals, error } = await supabase
            .from('withdrawals')
            .select(`
                *,
                users (email)
            `)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        const tableBody = document.getElementById('recentWithdrawals');
        tableBody.innerHTML = '';

        if (withdrawals.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No withdrawals found</td></tr>';
            return;
        }

        withdrawals.forEach(withdrawal => {
            const row = document.createElement('tr');
            const statusClass = `status-${withdrawal.status}`;
            
            row.innerHTML = `
                <td>${withdrawal.users?.email || 'N/A'}</td>
                <td>$${withdrawal.amount}</td>
                <td>${utils.formatCoins(withdrawal.coins_used)}</td>
                <td><span class="status-badge ${statusClass}">${withdrawal.status}</span></td>
                <td>${new Date(withdrawal.created_at).toLocaleDateString()}</td>
                <td>
                    ${withdrawal.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="approveWithdrawal('${withdrawal.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="rejectWithdrawal('${withdrawal.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading recent withdrawals:', error);
        document.getElementById('recentWithdrawals').innerHTML = 
            '<tr><td colspan="6" class="text-center">Error loading data</td></tr>';
    }
}

// Load users table
async function loadUsersTable() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tableBody = document.getElementById('usersTable');
        tableBody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${user.id.substring(0, 8)}...</td>
                <td>${user.email}</td>
                <td>${utils.formatCoins(user.wallet_balance)}</td>
                <td>${user.referral_earned || 0}</td>
                <td><span class="status-badge status-${user.kyc_status}">${user.kyc_status}</span></td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load pending withdrawals
async function loadPendingWithdrawals() {
    try {
        const { data: withdrawals, error } = await supabase
            .from('withdrawals')
            .select(`
                *,
                users (email)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) throw error;

        const tableBody = document.getElementById('pendingWithdrawalsTable');
        tableBody.innerHTML = '';

        if (withdrawals.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No pending withdrawals</td></tr>';
            return;
        }

        withdrawals.forEach(withdrawal => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${withdrawal.users?.email || 'N/A'}</td>
                <td>$${withdrawal.amount}</td>
                <td>${utils.formatCoins(withdrawal.coins_used)}</td>
                <td>${withdrawal.method}</td>
                <td>${withdrawal.details || 'N/A'}</td>
                <td>${new Date(withdrawal.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="approveWithdrawal('${withdrawal.id}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectWithdrawal('${withdrawal.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error loading pending withdrawals:', error);
    }
}

// Withdrawal actions
async function approveWithdrawal(withdrawalId) {
    if (!confirm('Are you sure you want to approve this withdrawal?')) return;

    try {
        const { error } = await supabase
            .from('withdrawals')
            .update({ 
                status: 'paid',
                paid_at: new Date().toISOString()
            })
            .eq('id', withdrawalId);

        if (error) throw error;

        utils.showNotification('Withdrawal approved successfully!', 'success');
        loadRecentWithdrawals();
        loadPendingWithdrawals();
        loadAdminStats();

    } catch (error) {
        console.error('Error approving withdrawal:', error);
        utils.showNotification('Error approving withdrawal', 'error');
    }
}

async function rejectWithdrawal(withdrawalId) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
        // Get withdrawal details to return coins
        const { data: withdrawal, error: withdrawalError } = await supabase
            .from('withdrawals')
            .select('*')
            .eq('id', withdrawalId)
            .single();

        if (withdrawalError) throw withdrawalError;

        // Return coins to user
        const { data: user } = await supabase
            .from('users')
            .select('wallet_balance')
            .eq('id', withdrawal.user_id)
            .single();

        await supabase
            .from('users')
            .update({ 
                wallet_balance: user.wallet_balance + withdrawal.coins_used 
            })
            .eq('id', withdrawal.user_id);

        // Update withdrawal status
        const { error } = await supabase
            .from('withdrawals')
            .update({ 
                status: 'rejected',
                rejection_reason: reason
            })
            .eq('id', withdrawalId);

        if (error) throw error;

        utils.showNotification('Withdrawal rejected and coins returned to user.', 'success');
        loadRecentWithdrawals();
        loadPendingWithdrawals();
        loadAdminStats();

    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        utils.showNotification('Error rejecting withdrawal', 'error');
    }
}

// User management
function showUserModal() {
    // In a real app, this would show a modal to add users
    alert('Add user functionality would open a modal here');
}

function editUser(userId) {
    // In a real app, this would open an edit modal
    alert(`Edit user ${userId} - This would open an edit modal`);
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        utils.showNotification('User deleted successfully', 'success');
        loadUsersTable();
        loadAdminStats();

    } catch (error) {
        console.error('Error deleting user:', error);
        utils.showNotification('Error deleting user', 'error');
    }
}

// Refresh all stats
function refreshStats() {
    loadAdminStats();
    loadRecentWithdrawals();
    loadUsersTable();
    loadPendingWithdrawals();
    utils.showNotification('Data refreshed successfully', 'success');
}

// Add admin-specific button styles
const adminStyles = `
    .btn-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.8rem;
    }

    .btn-success {
        background: #10b981;
    }

    .btn-success:hover {
        background: #0da271;
    }

    .btn-danger {
        background: #ef4444;
    }

    .btn-danger:hover {
        background: #dc2626;
    }

    .text-center {
        text-align: center;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = adminStyles;
document.head.appendChild(styleSheet);
