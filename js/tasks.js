import { supabase } from './supabase-client.js'

let currentUser = null
let currentCategory = 'all'
let adTimer = null
let adTimeLeft = 0

async function initTasks() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        window.location.href = 'login.html'
        return
    }
    
    currentUser = user
    await loadTaskStats()
    await loadTasks()
    await loadDailyActivities()
    setupEventListeners()
}

async function loadTaskStats() {
    // Completed tasks count
    const { count: completedTasks, error: completedError } = await supabase
        .from('user_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('completed', true)

    if (!completedError) {
        document.getElementById('completedTasks').textContent = completedTasks
    }

    // Available tasks count
    const { count: availableTasks, error: availableError } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

    if (!availableError) {
        document.getElementById('availableTasks').textContent = availableTasks
    }

    // Total earned from tasks
    const { data: earnings, error: earningsError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', currentUser.id)
        .in('type', ['task_completion', 'ad_watch', 'scratch_card', 'treasure'])

    if (!earningsError && earnings) {
        const total = earnings.reduce((sum, t) => sum + parseFloat(t.amount), 0)
        document.getElementById('totalEarned').textContent = `$${total.toFixed(2)}`
    }
}

async function loadTasks() {
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_active', true)

    if (!error && tasks) {
        displayTasks(tasks)
    }
}

async function loadDailyActivities() {
    // Get today's activity counts
    const today = new Date().toISOString().split('T')[0]
    
    // Ads watched today
    const { count: adsWatched, error: adsError } = await supabase
        .from('user_ad_views')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .gte('viewed_at', today)

    if (!adsError) {
        document.getElementById('adsCounter').textContent = `${adsWatched}/20`
    }

    // Scratch cards used today
    const { count: scratchUsed, error: scratchError } = await supabase
        .from('scratch_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .gte('created_at', today)

    if (!scratchError) {
        document.getElementById('scratchCounter').textContent = `${scratchUsed}/3`
    }

    // Load available ads
    await loadAvailableAds()
    
    // Load scratch cards
    await loadScratchCards()
}

async function loadAvailableAds() {
    const { data: ads, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)

    if (!error && ads) {
        displayAds(ads)
    }
}

function displayAds(ads) {
    const container = document.getElementById('adsGrid')
    container.innerHTML = ''
    
    ads.forEach(ad => {
        const adElement = document.createElement('div')
        adElement.className = 'ad-card'
        adElement.onclick = () => watchAd(ad)
        
        adElement.innerHTML = `
            <div class="ad-icon">▶</div>
            <div class="ad-title">${ad.title}</div>
            <div class="ad-duration">${ad.duration_seconds}s</div>
            <div class="ad-reward">+$${parseFloat(ad.reward_amount).toFixed(3)}</div>
        `
        container.appendChild(adElement)
    })
}

async function loadScratchCards() {
    const today = new Date().toISOString().split('T')[0]
    
    // Check how many scratch cards used today
    const { count: usedToday, error } = await supabase
        .from('scratch_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .gte('created_at', today)

    if (!error) {
        const remaining = Math.max(0, 3 - usedToday)
        displayScratchCards(remaining)
    }
}

function displayScratchCards(remaining) {
    const container = document.getElementById('scratchCardsGrid')
    container.innerHTML = ''
    
    for (let i = 0; i < 3; i++) {
        const cardElement = document.createElement('div')
        cardElement.className = `scratch-card ${i < remaining ? 'available' : 'used'}`
        cardElement.onclick = i < remaining ? () => openScratchCard() : null
        
        cardElement.innerHTML = i < remaining ? '🎴' : '✅'
        container.appendChild(cardElement)
    }
}

function displayTasks(tasks) {
    const dailyContainer = document.getElementById('dailyTasks')
    const availableContainer = document.getElementById('availableTasksList')
    const completedContainer = document.getElementById('completedTasksList')
    
    dailyContainer.innerHTML = ''
    availableContainer.innerHTML = ''
    completedContainer.innerHTML = ''
    
    // Filter tasks by type
    const dailyTasks = tasks.filter(task => task.daily_limit > 0)
    const availableTasks = tasks.filter(task => task.daily_limit === 0 || task.daily_limit > 1)
    
    dailyTasks.forEach(task => {
        dailyContainer.appendChild(createTaskCard(task))
    })
    
    availableTasks.forEach(task => {
        availableContainer.appendChild(createTaskCard(task))
    })
}

function createTaskCard(task) {
    const card = document.createElement('div')
    card.className = 'task-item'
    card.onclick = () => showTaskDetails(task)
    
    card.innerHTML = `
        <div class="task-header">
            <div class="task-title">${task.title}</div>
            <div class="task-reward">+$${parseFloat(task.reward_amount).toFixed(3)}</div>
        </div>
        <div class="task-description">${task.description}</div>
        <div class="task-footer">
            <div class="task-type">${task.task_type}</div>
            <div class="task-status available">Available</div>
        </div>
    `
    
    return card
}

function showTaskDetails(task) {
    document.getElementById('taskModalTitle').textContent = task.title
    document.getElementById('modalTaskReward').textContent = `$${parseFloat(task.reward_amount).toFixed(3)}`
    document.getElementById('modalTaskDesc').textContent = task.description
    
    // Parse instructions
    const instructionsList = document.getElementById('instructionsList')
    instructionsList.innerHTML = ''
    
    if (task.instructions) {
        const instructions = task.instructions.split('\n')
        instructions.forEach(instruction => {
            if (instruction.trim()) {
                const li = document.createElement('li')
                li.textContent = instruction.trim()
                instructionsList.appendChild(li)
            }
        })
    }
    
    // Update requirements
    const requirements = document.getElementById('modalTaskRequirements')
    requirements.innerHTML = `
        <strong>Requirements:</strong><br>
        • Complete ${task.required_completions || 1} time(s)<br>
        • Daily limit: ${task.daily_limit || 'Unlimited'}<br>
        • Reward: $${parseFloat(task.reward_amount).toFixed(3)} + ${task.reward_coins || 0} coins
    `
    
    // Set up start button
    const startBtn = document.getElementById('startTaskBtn')
    startBtn.textContent = 'Start Task'
    startBtn.onclick = () => startTask(task)
    
    document.getElementById('taskModal').style.display = 'block'
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none'
}

async function startTask(task) {
    closeTaskModal()
    
    switch (task.task_type) {
        case 'watch_ad':
            // Find an ad to watch
            const { data: ads, error } = await supabase
                .from('advertisements')
                .select('*')
                .eq('is_active', true)
                .limit(1)
                .single()
                
            if (!error && ads) {
                watchAd(ads)
            }
            break
            
        case 'scratch_card':
            openScratchCard()
            break
            
        default:
            // For other tasks, mark as completed directly
            await completeTask(task)
            break
    }
}

function watchAd(ad) {
    document.getElementById('adReward').textContent = `$${parseFloat(ad.reward_amount).toFixed(3)}`
    document.getElementById('claimAdRewardBtn').disabled = true
    
    adTimeLeft = ad.duration_seconds
    document.getElementById('adTimer').textContent = adTimeLeft
    
    document.getElementById('adModal').style.display = 'block'
    
    // Start countdown
    adTimer = setInterval(() => {
        adTimeLeft--
        document.getElementById('adTimer').textContent = adTimeLeft
        
        if (adTimeLeft <= 0) {
            clearInterval(adTimer)
            document.getElementById('claimAdRewardBtn').disabled = false
        }
    }, 1000)
}

function closeAdModal() {
    if (adTimer) {
        clearInterval(adTimer)
    }
    document.getElementById('adModal').style.display = 'none'
}

async function claimAdReward() {
    const adReward = parseFloat(document.getElementById('adReward').textContent.replace('$', ''))
    
    // Record ad view
    const { data: ads, error: adsError } = await supabase
        .from('advertisements')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single()
        
    if (!adsError && ads) {
        const { error: viewError } = await supabase
            .from('user_ad_views')
            .insert([
                {
                    user_id: currentUser.id,
                    ad_id: ads.id,
                    reward_claimed: true
                }
            ])
            
        if (viewError) {
            console.error('Error recording ad view:', viewError)
        }
    }
    
    // Add reward to balance
    const { error: balanceError } = await supabase
        .rpc('update_user_balance', {
            p_user_id: currentUser.id,
            p_amount: adReward
        })
        
    if (balanceError) {
        alert('Error adding reward to balance')
        return
    }
    
    // Record transaction
    const { error: transactionError } = await supabase
        .from('transactions')
        .insert([
            {
                user_id: currentUser.id,
                type: 'ad_watch',
                amount: adReward,
                description: 'Watched advertisement'
            }
        ])
        
    // Distribute referral commission
    const { error: commissionError } = await supabase
        .rpc('distribute_referral_commission', {
            p_earner_id: currentUser.id,
            p_earned_amount: adReward,
            p_source_type: 'ad_watch'
        })
        
    if (commissionError) {
        console.error('Error distributing commission:', commissionError)
    }
    
    alert(`Ad watched successfully! You earned $${adReward.toFixed(3)}`)
    closeAdModal()
    await loadTaskStats()
    await loadDailyActivities()
}

function openScratchCard() {
    document.getElementById('scratchResult').style.display = 'none'
    document.getElementById('scratchCanvas').style.display = 'block'
    
    // Initialize scratch card
    initScratchCard()
    
    document.getElementById('scratchModal').style.display = 'block'
}

function closeScratchModal() {
    document.getElementById('scratchModal').style.display = 'none'
}

function initScratchCard() {
    const canvas = document.getElementById('scratchCanvas')
    const ctx = canvas.getContext('2d')
    
    // Draw card background
    ctx.fillStyle = '#6366f1'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw scratchable layer
    ctx.fillStyle = '#9ca3af'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Add scratch text
    ctx.fillStyle = '#374151'
    ctx.font = '16px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Scratch here to reveal prize!', canvas.width / 2, canvas.height / 2)
    
    // Scratch functionality
    let isDrawing = false
    
    canvas.addEventListener('mousedown', startScratching)
    canvas.addEventListener('mousemove', scratch)
    canvas.addEventListener('mouseup', stopScratching)
    canvas.addEventListener('mouseleave', stopScratching)
    
    function startScratching(e) {
        isDrawing = true
        scratch(e)
    }
    
    function scratch(e) {
        if (!isDrawing) return
        
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        ctx.globalCompositeOperation = 'destination-out'
        ctx.beginPath()
        ctx.arc(x, y, 20, 0, Math.PI * 2)
        ctx.fill()
        
        // Check if enough is scratched to reveal
        checkScratchCompletion()
    }
    
    function stopScratching() {
        isDrawing = false
    }
    
    function checkScratchCompletion() {
        // Simple completion check - in real app, use more sophisticated method
        setTimeout(() => {
            revealScratchPrize()
        }, 2000)
    }
}

function revealScratchPrize() {
    // Generate random reward
    const reward = (Math.random() * (0.005 - 0.002) + 0.002).toFixed(3)
    document.getElementById('scratchReward').textContent = `$${reward}`
    document.getElementById('scratchResult').style.display = 'block'
    document.getElementById('scratchCanvas').style.display = 'none'
}

async function claimScratchReward() {
    const reward = parseFloat(document.getElementById('scratchReward').textContent.replace('$', ''))
    
    // Record scratch card
    const { error: scratchError } = await supabase
        .from('scratch_cards')
        .insert([
            {
                user_id: currentUser.id,
                reward_amount: reward,
                is_scratched: true,
                scratched_at: new Date().toISOString()
            }
        ])
        
    if (scratchError) {
        console.error('Error recording scratch card:', scratchError)
    }
    
    // Add reward to balance
    const { error: balanceError } = await supabase
        .rpc('update_user_balance', {
            p_user_id: currentUser.id,
            p_amount: reward
        })
        
    if (balanceError) {
        alert('Error adding reward to balance')
        return
    }
    
    // Record transaction
    const { error: transactionError } = await supabase
        .from('transactions')
        .insert([
            {
                user_id: currentUser.id,
                type: 'scratch_card',
                amount: reward,
                description: 'Scratch card reward'
            }
        ])
        
    // Distribute referral commission
    const { error: commissionError } = await supabase
        .rpc('distribute_referral_commission', {
            p_earner_id: currentUser.id,
            p_earned_amount: reward,
            p_source_type: 'scratch_card'
        })
        
    alert(`Congratulations! You won $${reward}`)
    closeScratchModal()
    await loadTaskStats()
    await loadDailyActivities()
}

async function completeTask(task) {
    // Check if task already completed today
    const today = new Date().toISOString().split('T')[0]
    const { data: existing, error: checkError } = await supabase
        .from('user_tasks')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('task_id', task.id)
        .gte('last_completed_at', today)
        .single()
        
    if (existing) {
        alert('You have already completed this task today!')
        return
    }
    
    // Mark task as completed
    const { error: taskError } = await supabase
        .from('user_tasks')
        .upsert([
            {
                user_id: currentUser.id,
                task_id: task.id,
                completed: true,
                completions_count: 1,
                last_completed_at: new Date().toISOString()
            }
        ])
        
    if (taskError) {
        alert('Error completing task: ' + taskError.message)
        return
    }
    
    // Add reward to balance
    const { error: balanceError } = await supabase
        .rpc('update_user_balance', {
            p_user_id: currentUser.id,
            p_amount: task.reward_amount
        })
        
    if (balanceError) {
        alert('Error adding reward to balance')
        return
    }
    
    // Add coins if any
    if (task.reward_coins > 0) {
        const { error: coinsError } = await supabase
            .rpc('update_user_coins', {
                p_user_id: currentUser.id,
                p_coins: task.reward_coins
            })
            
        if (coinsError) {
            console.error('Error adding coins:', coinsError)
        }
    }
    
    // Record transaction
    const { error: transactionError } = await supabase
        .from('transactions')
        .insert([
            {
                user_id: currentUser.id,
                type: 'task_completion',
                amount: task.reward_amount,
                description: `Completed task: ${task.title}`
            }
        ])
        
    // Distribute referral commission
    const { error: commissionError } = await supabase
        .rpc('distribute_referral_commission', {
            p_earner_id: currentUser.id,
            p_earned_amount: task.reward_amount,
            p_source_type: 'task_completion'
        })
        
    alert(`Task completed successfully! You earned $${parseFloat(task.reward_amount).toFixed(3)}`)
    await loadTaskStats()
    await loadTasks()
}

function setupEventListeners() {
    // Category tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.getAttribute('data-category')
            currentCategory = category
            
            // Update active state
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
            this.classList.add('active')
            
            // Filter tasks based on category
            filterTasksByCategory(category)
        })
    })
    
    // Modal close events
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none'
        })
    })
    
    // Ad claim button
    document.getElementById('claimAdRewardBtn').addEventListener('click', claimAdReward)
}

function filterTasksByCategory(category) {
    const allTasks = document.querySelectorAll('.task-item')
    
    allTasks.forEach(task => {
        if (category === 'all' || task.querySelector('.task-type').textContent.toLowerCase().includes(category)) {
            task.style.display = 'block'
        } else {
            task.style.display = 'none'
        }
    })
}

function viewCompletedTasks() {
    alert('Completed tasks view would open here')
}

// Make functions globally available
window.closeAdModal = closeAdModal
window.closeScratchModal = closeScratchModal
window.closeTaskModal = closeTaskModal
window.claimScratchReward = claimScratchReward

document.addEventListener('DOMContentLoaded', initTasks)
