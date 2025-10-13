import { supabase } from './supabase-client.js'

let currentUser = null

async function initReferrals() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        window.location.href = 'login.html'
        return
    }
    
    currentUser = user
    await loadReferralStats()
    await loadReferralList()
    await loadCommissionHistory()
    setupEventListeners()
}

async function loadReferralStats() {
    // Total referrals count
    const { count: totalReferrals, error: refError } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', currentUser.id)
        .eq('is_active', true)

    if (!refError) {
        document.getElementById('totalReferrals').textContent = totalReferrals
    }

    // Active referrals count (users who were active today)
    const today = new Date().toISOString().split('T')[0]
    const { count: activeReferrals, error: activeError } = await supabase
        .from('user_sessions')
        .select('user_id', { count: 'exact', head: true })
        .in('user_id', 
            supabase.from('referrals')
            .select('referred_id')
            .eq('referrer_id', currentUser.id)
        )
        .gte('login_at', today)

    if (!activeError) {
        document.getElementById('activeReferrals').textContent = activeReferrals
    }

    // Today's commission
    const { data: todayCommission, error: commissionError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', currentUser.id)
        .eq('type', 'referral')
        .gte('created_at', today)

    if (!commissionError && todayCommission) {
        const total = todayCommission.reduce((sum, t) => sum + parseFloat(t.amount), 0)
        document.getElementById('totalCommission').textContent = `$${total.toFixed(2)}`
    }

    // Load referral code and URL
    await loadReferralInfo()
}

async function loadReferralInfo() {
    const { data, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', currentUser.id)
        .single()

    if (!error && data) {
        const referralUrl = `${window.location.origin}/login.html?ref=${data.referral_code}`
        document.getElementById('referralUrl').textContent = referralUrl
    }
}

async function loadReferralList() {
    const { data: referrals, error } = await supabase
        .from('referrals')
        .select(`
            referred_id,
            level,
            created_at,
            users!referrals_referred_id_fkey (
                email,
                created_at,
                total_earnings
            )
        `)
        .eq('referrer_id', currentUser.id)
        .order('created_at', { ascending: false })

    if (!error && referrals && referrals.length > 0) {
        const container = document.getElementById('referralList')
        container.innerHTML = ''

        referrals.forEach(ref => {
            const referralElement = document.createElement('div')
            referralElement.className = 'referral-item'
            referralElement.innerHTML = `
                <div class="referral-avatar">${ref.users.email[0].toUpperCase()}</div>
                <div class="referral-info">
                    <div class="referral-name">${ref.users.email}</div>
                    <div class="referral-level">Level ${ref.level}</div>
                    <div class="referral-date">Joined: ${new Date(ref.users.created_at).toLocaleDateString()}</div>
                </div>
                <div class="referral-earnings">
                    <div class="earnings-amount">$${ref.users.total_earnings?.toFixed(2) || '0.00'}</div>
                    <div class="earnings-label">Total Earned</div>
                </div>
            `
            container.appendChild(referralElement)
        })
    }
}

async function loadCommissionHistory() {
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('type', 'referral')
        .order('created_at', { ascending: false })
        .limit(10)

    if (!error && transactions && transactions.length > 0) {
        const container = document.getElementById('commissionHistory')
        container.innerHTML = ''

        transactions.forEach(transaction => {
            const level = transaction.metadata?.level || 1
            const source = transaction.metadata?.source_type || 'earning'
            
            const commissionElement = document.createElement('div')
            commissionElement.className = 'commission-item'
            commissionElement.innerHTML = `
                <div class="commission-details">
                    <div class="commission-source">Level ${level} Referral Commission</div>
                    <div class="commission-date">${new Date(transaction.created_at).toLocaleDateString()}</div>
                    <div class="commission-from">From: ${source}</div>
                </div>
                <div class="commission-amount positive">+$${parseFloat(transaction.amount).toFixed(4)}</div>
            `
            container.appendChild(commissionElement)
        })
    }
}

function setupEventListeners() {
    // Copy referral URL
    document.getElementById('copyUrlBtn').addEventListener('click', copyReferralUrl)
    
    // Share buttons
    document.querySelector('.share-btn.whatsapp').addEventListener('click', shareViaWhatsApp)
    document.querySelector('.share-btn.telegram').addEventListener('click', shareViaTelegram)
    document.querySelector('.share-btn.more').addEventListener('click', showMoreShareOptions)
}

function copyReferralUrl() {
    const referralUrl = document.getElementById('referralUrl').textContent
    navigator.clipboard.writeText(referralUrl).then(() => {
        const btn = document.getElementById('copyUrlBtn')
        const originalText = btn.textContent
        btn.textContent = 'Copied!'
        btn.style.backgroundColor = '#10b981'
        
        setTimeout(() => {
            btn.textContent = originalText
            btn.style.backgroundColor = ''
        }, 2000)
    })
}

function shareViaWhatsApp() {
    const referralUrl = document.getElementById('referralUrl').textContent
    const message = `Join Cryptra using my referral link and start earning money! ${referralUrl}`
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
}

function shareViaTelegram() {
    const referralUrl = document.getElementById('referralUrl').textContent
    const message = `Join Cryptra using my referral link and start earning money! ${referralUrl}`
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
}

function showMoreShareOptions() {
    if (navigator.share) {
        const referralUrl = document.getElementById('referralUrl').textContent
        navigator.share({
            title: 'Join Cryptra - Earn Money',
            text: 'Join Cryptra using my referral link and start earning money!',
            url: referralUrl,
        })
        .catch(error => console.log('Error sharing:', error));
    } else {
        copyReferralUrl()
    }
}

function viewAllReferrals() {
    alert('All referrals view would open here')
}

function viewCommissionHistory() {
    alert('Full commission history would open here')
}

document.addEventListener('DOMContentLoaded', initReferrals)
