import { supabase } from './supabase-client.js'

let currentUser = null

// Check authentication and load user data
async function initDashboard() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        window.location.href = 'login.html'
        return
    }
    
    currentUser = user
    document.getElementById('userAvatar').textContent = user.email[0].toUpperCase()
    
    await loadUserData()
    await loadDailyActivities()
    await loadReferralStats()
    await loadTopEarners()
    await loadRecentActivity()
    setupEventListeners()
}

// Load user balance and basic info
async function loadUserData() {
    const { data, error } = await supabase
        .from('users')
        .select('balance, total_earnings')
        .eq('id', currentUser.id)
        .single()

    if (!error && data) {
        document.getElementById('balanceAmount').textContent = `$${data.balance.toFixed(2)}`
    }
}

// Load daily activities status
async function loadDailyActivities() {
    const today = new Date().toISOString().split('T')[0]
    
    // Check today's activities
    const { data: activities, error } = await supabase
        .from('daily_activities')
        .select('activity_type, completed')
        .eq('user_id', currentUser.id)
        .eq('activity_date', today)

    if (!error) {
        const checkinCompleted = activities.find(a => a.activity_type === 'checkin')?.completed || false
        const adsCompleted = activities.filter(a => a.activity_type === 'ad_watch').length
        const scratchCompleted = activities.filter(a => a.activity_type === 'scratch_card').length
        const treasureCompleted = activities.find(a => a.activity_type === 'treasure')?.completed || false

        // Update UI
        document.getElementById('checkinBtn').disabled = checkinCompleted
        if (checkinCompleted) {
            document.getElementById('checkinBtn').textContent = 'Checked In'
            document.getElementById('checkinBtn').style.backgroundColor = '#9ca3af'
        }

        document.getElementById('adsAvailable').textContent = `${20 - adsCompleted} ads available`
        document.getElementById('scratchCardsAvailable').textContent = `${3 - scratchCompleted} cards today`
        document.getElementById('treasureStatus').textContent = treasureCompleted ? 'Claimed' : 'Available'
    }

    // Load streak count
    await loadStreakCount()
    // Load calendar
    await loadCheckinCalendar()
}

// Load user streak count
async function loadStreakCount() {
    const { data, error } = await supabase
        .rpc('get_user_streak', { user_id: currentUser.id })

    if (!error && data) {
        document.getElementById('streakCount').textContent = `${data} Day Streak`
    }
}

// Load check-in calendar
async function loadCheckinCalendar() {
    const calendar = document.getElementById('checkinCalendar')
    calendar.innerHTML = ''
    
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const today = new Date()
    
    // Get last 7 days check-ins
    const { data: checkins, error } = await supabase
        .from('daily_activities')
        .select('activity_date')
        .eq('user_id', currentUser.id)
        .eq('activity_type', 'checkin')
        .gte('activity_date', new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('activity_date', { ascending: true })

    if (!error) {
        const checkinDates = checkins.map(c => c.activity_date)
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today)
            date.setDate(date.getDate() - i)
            const dateStr = date.toISOString().split('T')[0]
            const dayName = days[date.getDay()]
            
            const dayElement = document.createElement('div')
            dayElement.className = 'calendar-day'
            
            if (checkinDates.includes(dateStr)) {
                dayElement.classList.add('checked')
            } else if (dateStr === today.toISOString().split('T')[0]) {
                dayElement.classList.add('today')
            } else {
                dayElement.classList.add('future')
            }
            
            dayElement.textContent = dayName
            calendar.appendChild(dayElement)
        }
    }
}

// Load referral statistics
async function loadReferralStats() {
    // Total referrals count
    const { count: totalReferrals, error: refError } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', currentUser.id)

    if (!refError) {
        document.getElementById('totalReferrals').textContent = totalReferrals
    }

    // Today's commission
    const today = new Date().toISOString().split('T')[0]
    const { data: todayCommission, error: commissionError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', currentUser.id)
        .eq('type', 'referral')
        .gte('created_at', today)

    if (!commissionError && todayCommission) {
        const total = todayCommission.reduce((sum, t) => sum + t.amount, 0)
        document.getElementById('commissionToday').textContent = `$${total.toFixed(2)}`
    }
}

// Load top earners
async function loadTopEarners() {
    const { data: earners, error } = await supabase
        .from('users')
        .select('full_name, total_earnings')
        .order('total_earnings', { ascending: false })
        .limit(5)

    if (!error) {
        const container = document.getElementById('topEarners')
        container.innerHTML = ''
        
        earners.forEach((earner, index) => {
            const earnerElement = document.createElement('div')
            earnerElement.className = 'earner'
            earnerElement.innerHTML = `
                <div class="earner-rank ${index === 0 ? 'rank-1' : ''}">${index + 1}</div>
                <div class="earner-avatar">${earner.full_name ? earner.full_name[0].toUpperCase() : 'U'}</div>
                <div class="earner-info">
                    <div class="earner-name">${earner.full_name || 'User'}</div>
                    <div class="earner-earnings">Total: <span class="earner-amount">$${earner.total_earnings.toFixed(2)}</span></div>
                </div>
            `
            container.appendChild(earnerElement)
        })
    }
}

// Load recent activity
async function loadRecentActivity() {
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5)

    if (!error) {
        const container = document.getElementById('recentActivity')
        container.innerHTML = ''
        
        transactions.forEach(transaction => {
            const activityElement = document.createElement('div')
            activityElement.className = 'activity-item'
            
            let iconClass = ''
            let iconSymbol = ''
            let amountClass = 'positive'
            
            switch(transaction.type) {
                case 'checkin':
                    iconClass = 'income'
                    iconSymbol = '+'
                    break
                case 'ad_watch':
                    iconClass = 'income'
                    iconSymbol = '▶'
                    break
                case 'scratch_card':
                    iconClass = 'income'
                    iconSymbol = '🎴'
                    break
                case 'referral':
                    iconClass = 'referral'
                    iconSymbol = '👥'
                    break
                case 'withdrawal':
                    iconClass = 'expense'
                    iconSymbol = '-'
                    amountClass = 'negative'
                    break
                default:
                    iconClass = 'income'
                    iconSymbol = '💰'
            }
            
            activityElement.innerHTML = `
                <div class="activity-icon ${iconClass}">${iconSymbol}</div>
                <div class="activity-details">
                    <div class="activity-title">${transaction.description}</div>
                    <div class="activity-date">${new Date(transaction.created_at).toLocaleDateString()}</div>
                </div>
                <div class="activity-amount ${amountClass}">${transaction.amount >= 0 ? '+' : ''}$${transaction.amount.toFixed(2)}</div>
            `
            container.appendChild(activityElement)
        })
    }
}

// Setup event listeners
function setupEventListeners() {
    // Check-in button
    document.getElementById('checkinBtn').addEventListener('click', handleCheckIn)
    
    // Treasure box modal
    const modal = document.getElementById('treasureModal')
    const closeBtn = document.querySelector('.close')
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none'
    })
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none'
        }
    })
    
    document.getElementById('openTreasureBtn').addEventListener('click', openTreasure)
}

// Handle daily check-in
async function handleCheckIn() {
    const today = new Date().toISOString().split('T')[0]
    
    // Check if already checked in today
    const { data: existing, error: checkError } = await supabase
        .from('daily_activities')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('activity_type', 'checkin')
        .eq('activity_date', today)
        .single()

    if (existing) {
        alert('You have already checked in today!')
        return
    }

    // Generate random reward between $0.001 and $0.005
    const reward = (Math.random() * (0.005 - 0.001) + 0.001).toFixed(3)
    
    // Start transaction
    const { data: activity, error: activityError } = await supabase
        .from('daily_activities')
        .insert([
            {
                user_id: currentUser.id,
                activity_type: 'checkin',
                completed: true
            }
        ])
        .select()
        .single()

    if (activityError) {
        console.error('Error saving check-in:', activityError)
        alert('Error checking in. Please try again.')
        return
    }

    // Create transaction record
    const { error: transactionError } = await supabase
        .from('transactions')
        .insert([
            {
                user_id: currentUser.id,
                type: 'checkin',
                amount: parseFloat(reward),
                description: 'Daily check-in reward'
            }
        ])

    if (transactionError) {
        console.error('Error creating transaction:', transactionError)
    }

    // Update user balance
    const { error: balanceError } = await supabase
        .rpc('increment_balance', {
            user_id: currentUser.id,
            amount: parseFloat(reward)
        })

    if (balanceError) {
        console.error('Error updating balance:', balanceError)
    }

    // Update UI
    document.getElementById('checkinBtn').textContent = 'Checked In'
    document.getElementById('checkinBtn').disabled = true
    document.getElementById('checkinBtn').style.backgroundColor = '#9ca3af'
    
    // Reload data
    await loadUserData()
    await loadStreakCount()
    await loadCheckinCalendar()
    await loadRecentActivity()
    
    alert(`Check-in successful! You earned $${reward}.`)
}

// Open treasure box modal
function openTreasureBox() {
    const today = new Date().toISOString().split('T')[0]
    
    // Check if treasure already claimed today
    supabase
        .from('daily_activities')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('activity_type', 'treasure')
        .eq('activity_date', today)
        .single()
        .then(({ data }) => {
            if (data) {
                alert('You have already claimed your treasure today!')
                return
            }
            
            document.getElementById('treasureModal').style.display = 'block'
            document.getElementById('rewardDisplay').innerHTML = `
                <p>Click to open your daily treasure!</p>
                <button class="btn btn-primary" id="openTreasureBtn">Open Treasure</button>
            `
        })
}

// Open treasure and claim reward
async function openTreasure() {
    const reward = (Math.random() * (0.007 - 0.004) + 0.004).toFixed(3)
    
    // Save treasure activity
    const { error: activityError } = await supabase
        .from('daily_activities')
        .insert([
            {
                user_id: currentUser.id,
                activity_type: 'treasure',
                completed: true
            }
        ])

    if (activityError) {
        console.error('Error saving treasure:', activityError)
        return
    }

    // Create transaction
    const { error: transactionError } = await supabase
        .from('transactions')
        .insert([
            {
                user_id: currentUser.id,
                type: 'treasure',
                amount: parseFloat(reward),
                description: 'Treasure box reward'
            }
        ])

    // Update balance
    await supabase
        .rpc('increment_balance', {
            user_id: currentUser.id,
            amount: parseFloat(reward)
        })

    // Show reward
    document.getElementById('rewardDisplay').innerHTML = `
        <div class="reward-result">
            <h3>Congratulations!</h3>
            <p>You found: <strong>$${reward}</strong></p>
            <button class="btn btn-primary" onclick="document.getElementById('treasureModal').style.display='none'">Close</button>
        </div>
    `

    // Update UI
    document.getElementById('treasureStatus').textContent = 'Claimed'
    await loadUserData()
    await loadRecentActivity()
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard)
