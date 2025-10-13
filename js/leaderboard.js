import { supabase } from './supabase-client.js'

let currentUser = null
let currentPeriod = 'daily'

async function initLeaderboard() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        window.location.href = 'login.html'
        return
    }
    
    currentUser = user
    await loadUserRank()
    await loadLeaderboard()
    await loadStatistics()
    await loadRecentWinners()
    setupEventListeners()
}

async function loadUserRank() {
    const { data: user, error } = await supabase
        .from('users')
        .select('full_name, email, total_earnings')
        .eq('id', currentUser.id)
        .single()

    if (!error && user) {
        document.getElementById('userRankName').textContent = user.full_name || user.email
        document.getElementById('userRankAvatar').textContent = (user.full_name || user.email)[0].toUpperCase()
        document.getElementById('userRankEarnings').textContent = `$${parseFloat(user.total_earnings).toFixed(2)}`
    }

    // Calculate user's rank
    const { data: allUsers, error: rankError } = await supabase
        .from('users')
        .select('id, total_earnings')
        .order('total_earnings', { ascending: false })

    if (!rankError && allUsers) {
        const userIndex = allUsers.findIndex(u => u.id === currentUser.id)
        document.getElementById('userRankPosition').textContent = `#${userIndex + 1}`
    }
}

async function loadLeaderboard() {
    let query = supabase
        .from('users')
        .select('id, email, full_name, total_earnings')
        .order('total_earnings', { ascending: false })
        .limit(50)

    const { data: users, error } = await query

    if (!error && users) {
        displayLeaderboard(users)
    }
}

function displayLeaderboard(users) {
    const container = document.getElementById('leaderboardList')
    container.innerHTML = ''
    
    // Update top 3
    const topThree = users.slice(0, 3)
    if (topThree.length >= 3) {
        document.querySelector('.top-user.first .user-name').textContent = topThree[0].full_name || topThree[0].email
        document.querySelector('.top-user.first .user-avatar').textContent = (topThree[0].full_name || topThree[0].email)[0].toUpperCase()
        document.querySelector('.top-user.first .user-earnings').textContent = `$${parseFloat(topThree[0].total_earnings).toFixed(2)}`
        
        document.querySelector('.top-user.second .user-name').textContent = topThree[1].full_name || topThree[1].email
        document.querySelector('.top-user.second .user-avatar').textContent = (topThree[1].full_name || topThree[1].email)[0].toUpperCase()
        document.querySelector('.top-user.second .user-earnings').textContent = `$${parseFloat(topThree[1].total_earnings).toFixed(2)}`
        
        document.querySelector('.top-user.third .user-name').textContent = topThree[2].full_name || topThree[2].email
        document.querySelector('.top-user.third .user-avatar').textContent = (topThree[2].full_name || topThree[2].email)[0].toUpperCase()
        document.querySelector('.top-user.third .user-earnings').textContent = `$${parseFloat(topThree[2].total_earnings).toFixed(2)}`
    }
    
    // Display rest of leaderboard (starting from position 4)
    const restUsers = users.slice(3)
    restUsers.forEach((user, index) => {
        const rank = index + 4
        const leaderboardItem = document.createElement('div')
        leaderboardItem.className = 'leaderboard-item'
        
        leaderboardItem.innerHTML = `
            <div class="leaderboard-rank">${rank}</div>
            <div class="leaderboard-user">
                <div class="leaderboard-avatar">${(user.full_name || user.email)[0].toUpperCase()}</div>
                <div class="leaderboard-name">${user.full_name || user.email}</div>
            </div>
            <div class="leaderboard-earnings">$${parseFloat(user.total_earnings).toFixed(2)}</div>
        `
        container.appendChild(leaderboardItem)
    })
    
    document.getElementById('totalUsers').textContent = `${users.length} users`
}

async function loadStatistics() {
    // Total active users (users with activity in last 7 days)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const { count: activeUsers, error: activeError } = await supabase
        .from('user_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gte('login_at', weekAgo.toISOString())

    if (!activeError) {
        document.getElementById('totalActiveUsers').textContent = activeUsers
    }

    // Total payouts
    const { data: payouts, error: payoutsError } = await supabase
        .from('withdrawals')
        .select('amount')
        .eq('status', 'completed')

    if (!payoutsError && payouts) {
        const total = payouts.reduce((sum, w) => sum + parseFloat(w.amount), 0)
        document.getElementById('totalPayouts').textContent = `$${total.toFixed(0)}`
    }

    // Average earnings
    const { data: allUsers, error: avgError } = await supabase
        .from('users')
        .select('total_earnings')

    if (!avgError && allUsers && allUsers.length > 0) {
        const avg = allUsers.reduce((sum, u) => sum + parseFloat(u.total_earnings), 0) / allUsers.length
        document.getElementById('avgEarnings').textContent = `$${avg.toFixed(2)}`
    }

    // Growth rate (placeholder)
    document.getElementById('growthRate').textContent = '15%'
}

async function loadRecentWinners() {
    const { data: winners, error } = await supabase
        .from('lucky_draw_winners')
        .select(`
            prize_amount,
            position,
            draw_date,
            users (
                email,
                full_name
            )
        `)
        .order('draw_date', { ascending: false })
        .limit(5)

    if (!error && winners) {
        displayRecentWinners(winners)
    }
}

function displayRecentWinners(winners) {
    const container = document.getElementById('winnersList')
    container.innerHTML = ''
    
    if (winners.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏆</div>
                <div class="empty-text">No recent winners</div>
                <div class="empty-desc">Winners will appear here after each draw</div>
            </div>
        `
        return
    }
    
    winners.forEach(winner => {
        const winnerItem = document.createElement('div')
        winnerItem.className = 'winner-item'
        
        winnerItem.innerHTML = `
            <div class="winner-avatar">${(winner.users.full_name || winner.users.email)[0].toUpperCase()}</div>
            <div class="winner-info">
                <div class="winner-name">${winner.users.full_name || winner.users.email}</div>
                <div class="winner-date">${new Date(winner.draw_date).toLocaleDateString()}</div>
            </div>
            <div class="winner-prize">$${parseFloat(winner.prize_amount).toFixed(2)}</div>
        `
        container.appendChild(winnerItem)
    })
}

function setupEventListeners() {
    // Time period filters
    document.querySelectorAll('.time-filter').forEach(filter => {
        filter.addEventListener('click', function() {
            const period = this.getAttribute('data-period')
            currentPeriod = period
            
            // Update active state
            document.querySelectorAll('.time-filter').forEach(f => f.classList.remove('active'))
            this.classList.add('active')
            
            // Reload leaderboard for selected period
            loadLeaderboardForPeriod(period)
        })
    })
    
    // Lucky draw modal
    document.getElementById('purchaseEntriesBtn').addEventListener('click', purchaseLuckyDrawEntries)
}

async function loadLeaderboardForPeriod(period) {
    // This would filter leaderboard by time period
    // For now, we'll just reload the all-time leaderboard
    await loadLeaderboard()
}

function joinLuckyDraw() {
    document.getElementById('luckyDrawModal').style.display = 'block'
    document.getElementById('entryCount').textContent = '1'
    updateEntryCost()
}

function closeLuckyDrawModal() {
    document.getElementById('luckyDrawModal').style.display = 'none'
}

function increaseEntries() {
    const countElement = document.getElementById('entryCount')
    let count = parseInt(countElement.textContent)
    countElement.textContent = count + 1
    updateEntryCost()
}

function decreaseEntries() {
    const countElement = document.getElementById('entryCount')
    let count = parseInt(countElement.textContent)
    if (count > 1) {
        countElement.textContent = count - 1
        updateEntryCost()
}
}

function updateEntryCost() {
    const count = parseInt(document.getElementById('entryCount').textContent)
    const totalCost = count * 10 // 10 coins per entry
    document.getElementById('totalEntryCost').textContent = totalCost
}

async function purchaseLuckyDrawEntries() {
    const entryCount = parseInt(document.getElementById('entryCount').textContent)
    const totalCost = entryCount * 10
    
    // Check user coins balance
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('coins')
        .eq('id', currentUser.id)
        .single()
        
    if (userError) {
        alert('Error checking balance')
        return
    }
    
    if (user.coins < totalCost) {
        alert('Insufficient coins balance')
        return
    }
    
    // Deduct coins
    const { error: coinsError } = await supabase
        .rpc('update_user_coins', {
            p_user_id: currentUser.id,
            p_coins: -totalCost
        })
        
    if (coinsError) {
        alert('Error deducting coins: ' + coinsError.message)
        return
    }
    
    // Add lucky draw entries
    const { error: entriesError } = await supabase
        .from('lucky_draw_entries')
        .insert([
            {
                user_id: currentUser.id,
                entry_count: entryCount
            }
        ])
        
    if (entriesError) {
        alert('Error adding entries: ' + entriesError.message)
        return
    }
    
    alert(`Successfully purchased ${entryCount} lucky draw entries! Good luck!`)
    closeLuckyDrawModal()
}

function viewAllWinners() {
    alert('All winners view would open here')
}

// Make functions globally available
window.closeLuckyDrawModal = closeLuckyDrawModal
window.increaseEntries = increaseEntries
window.decreaseEntries = decreaseEntries
window.joinLuckyDraw = joinLuckyDraw

document.addEventListener('DOMContentLoaded', initLeaderboard)
