import { supabase } from './supabase-client.js'

let currentUser = null

// Check authentication and load user data
async function initProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        window.location.href = 'login.html'
        return
    }
    
    currentUser = user
    document.getElementById('userAvatar').textContent = user.email[0].toUpperCase()
    document.getElementById('profileAvatar').textContent = user.email[0].toUpperCase()
    
    await loadUserProfile()
    await loadUserStats()
    setupEventListeners()
}

// Load user profile data
async function loadUserProfile() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single()

    if (!error && data) {
        document.getElementById('userName').textContent = data.full_name || 'Guest User'
        document.getElementById('userEmail').textContent = currentUser.email
        document.getElementById('memberSince').textContent = new Date(data.created_at).getFullYear()
        document.getElementById('referralCode').textContent = data.referral_code || 'CRYP1234'
    }
}

// Load user statistics
async function loadUserStats() {
    // Total earnings
    const { data: earningsData, error: earningsError } = await supabase
        .from('users')
        .select('total_earnings, balance')
        .eq('id', currentUser.id)
        .single()

    if (!earningsError && earningsData) {
        document.getElementById('totalEarnings').textContent = `$${earningsData.total_earnings.toFixed(2)}`
    }

    // Total withdrawn
    const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('withdrawals')
        .select('amount')
        .eq('user_id', currentUser.id)
        .eq('status', 'approved')

    if (!withdrawalsError && withdrawalsData) {
        const totalWithdrawn = withdrawalsData.reduce((sum, w) => sum + w.amount, 0)
        document.getElementById('totalWithdrawn').textContent = `$${totalWithdrawn.toFixed(2)}`
    }

    // Referral count
    const { count: referralCount, error: referralError } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', currentUser.id)

    if (!referralError) {
        document.getElementById('referralCount').textContent = referralCount
    }
}

// Setup event listeners
function setupEventListeners() {
    // Copy referral code
    document.getElementById('copyReferralBtn').addEventListener('click', copyReferralCode)
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout)
    
    // Notifications toggle
    document.getElementById('notificationsToggle').addEventListener('change', toggleNotifications)
}

// Copy referral code to clipboard
function copyReferralCode() {
    const referralCode = document.getElementById('referralCode').textContent
    navigator.clipboard.writeText(referralCode).then(() => {
        const btn = document.getElementById('copyReferralBtn')
        const originalText = btn.textContent
        btn.textContent = 'Copied!'
        btn.style.backgroundColor = '#10b981'
        
        setTimeout(() => {
            btn.textContent = originalText
            btn.style.backgroundColor = ''
        }, 2000)
    })
}

// Handle user logout
async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
        window.location.href = 'login.html'
    } else {
        alert('Error logging out. Please try again.')
    }
}

// Toggle notifications
function toggleNotifications() {
    const isEnabled = document.getElementById('notificationsToggle').checked
    // In a real app, you would save this preference to the database
    console.log(`Notifications ${isEnabled ? 'enabled' : 'disabled'}`)
}

// Placeholder functions for settings
function showNotificationsSettings() {
    alert('Notifications settings would open here')
}

function showPrivacySettings() {
    alert('Privacy settings would open here')
}

function showHelp() {
    alert('Help & Support would open here')
}

function showAbout() {
    alert('About Cryptra would open here')
}

// Initialize profile when page loads
document.addEventListener('DOMContentLoaded', initProfile)
