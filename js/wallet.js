import { supabase } from './supabase-client.js'

let currentUser = null
let selectedMethod = 'upi'

async function initWallet() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        window.location.href = 'login.html'
        return
    }
    
    currentUser = user
    await loadWalletData()
    await loadTransactions()
    setupEventListeners()
}

async function loadWalletData() {
    const { data, error } = await supabase
        .from('users')
        .select('balance, total_earnings, coins')
        .eq('id', currentUser.id)
        .single()

    if (!error && data) {
        document.getElementById('availableBalance').textContent = `$${parseFloat(data.balance).toFixed(2)}`
        document.getElementById('totalEarned').textContent = `$${parseFloat(data.total_earnings).toFixed(2)}`
        document.getElementById('coinBalance').textContent = data.coins
    }

    // Total withdrawn
    const { data: withdrawals, error: withdrawalsError } = await supabase
        .from('withdrawals')
        .select('amount')
        .eq('user_id', currentUser.id)
        .eq('status', 'completed')

    if (!withdrawalsError && withdrawals) {
        const totalWithdrawn = withdrawals.reduce((sum, w) => sum + parseFloat(w.amount), 0)
        document.getElementById('totalWithdrawn').textContent = `$${totalWithdrawn.toFixed(2)}`
    }
}

async function loadTransactions() {
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10)

    if (!error && transactions && transactions.length > 0) {
        const container = document.getElementById('transactionsList')
        container.innerHTML = ''

        transactions.forEach(transaction => {
            const transactionElement = document.createElement('div')
            transactionElement.className = 'transaction-item'
            
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
                case 'treasure':
                    iconClass = 'income'
                    iconSymbol = '📦'
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
                case 'purchase':
                    iconClass = 'expense'
                    iconSymbol = '🛒'
                    amountClass = 'negative'
                    break
                case 'task_completion':
                    iconClass = 'income'
                    iconSymbol = '✅'
                    break
                default:
                    iconClass = 'income'
                    iconSymbol = '💰'
            }
            
            const amount = parseFloat(transaction.amount)
            const displayAmount = Math.abs(amount).toFixed(amount >= 1 ? 2 : 4)
            
            transactionElement.innerHTML = `
                <div class="activity-icon ${iconClass}">${iconSymbol}</div>
                <div class="activity-details">
                    <div class="activity-title">${transaction.description}</div>
                    <div class="activity-date">${new Date(transaction.created_at).toLocaleDateString()}</div>
                </div>
                <div class="activity-amount ${amountClass}">
                    ${amount >= 0 ? '+' : '-'}$${displayAmount}
                </div>
            `
            container.appendChild(transactionElement)
        })
    } else {
        document.getElementById('transactionsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💸</div>
                <div class="empty-text">No transactions yet</div>
                <div class="empty-desc">Your transactions will appear here</div>
            </div>
        `
    }
}

function setupEventListeners() {
    // Withdraw modal
    document.getElementById('withdrawAmount').addEventListener('input', updateWithdrawalSummary)
    document.getElementById('confirmWithdrawBtn').addEventListener('click', confirmWithdrawal)
    
    // Add coins modal
    document.querySelectorAll('.coins-option').forEach(option => {
        option.addEventListener('click', function() {
            selectCoinAmount(parseInt(this.querySelector('.coins-amount').textContent))
        })
    })
    document.getElementById('customCoins').addEventListener('input', updateCustomCoins)
    document.getElementById('purchaseCoinsBtn').addEventListener('click', purchaseCoins)
    
    // Method selection
    document.querySelectorAll('.method-card').forEach(card => {
        card.addEventListener('click', function() {
            selectWithdrawalMethod(this.querySelector('input').id.replace('Method', ''))
        })
    })
}

function showWithdrawModal() {
    document.getElementById('withdrawModal').style.display = 'block'
    updateWithdrawalSummary()
}

function closeWithdrawModal() {
    document.getElementById('withdrawModal').style.display = 'none'
    resetWithdrawForm()
}

function showAddCoinsModal() {
    document.getElementById('addCoinsModal').style.display = 'block'
}

function closeAddCoinsModal() {
    document.getElementById('addCoinsModal').style.display = 'none'
    resetCoinsForm()
}

function selectWithdrawalMethod(method) {
    selectedMethod = method
    document.getElementById('upiField').style.display = method === 'upi' ? 'block' : 'none'
    document.getElementById('paypalField').style.display = method === 'paypal' ? 'block' : 'none'
    
    // Update radio buttons
    document.getElementById('upiMethod').checked = method === 'upi'
    document.getElementById('paypalMethod').checked = method === 'paypal'
}

function updateWithdrawalSummary() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value) || 0
    const fee = amount * 0.02 // 2% fee
    const total = amount - fee
    
    document.getElementById('summaryAmount').textContent = `$${amount.toFixed(2)}`
    document.getElementById('summaryFee').textContent = `$${fee.toFixed(2)}`
    document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`
}

async function confirmWithdrawal() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value)
    const upiId = document.getElementById('upiId').value
    const paypalEmail = document.getElementById('paypalEmail').value
    
    if (!amount || amount < 3 || amount > 5) {
        alert('Please enter a valid amount between $3 and $5')
        return
    }
    
    if (selectedMethod === 'upi' && !upiId) {
        alert('Please enter your UPI ID')
        return
    }
    
    if (selectedMethod === 'paypal' && !paypalEmail) {
        alert('Please enter your PayPal email')
        return
    }
    
    // Check balance
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', currentUser.id)
        .single()
        
    if (userError) {
        alert('Error checking balance')
        return
    }
    
    if (parseFloat(user.balance) < amount) {
        alert('Insufficient balance')
        return
    }
    
    // Create withdrawal request
    const { data, error } = await supabase
        .from('withdrawals')
        .insert([
            {
                user_id: currentUser.id,
                amount: amount,
                method: selectedMethod,
                upi_id: selectedMethod === 'upi' ? upiId : null,
                paypal_email: selectedMethod === 'paypal' ? paypalEmail : null,
                status: 'pending'
            }
        ])
        .select()
        
    if (error) {
        alert('Error creating withdrawal request: ' + error.message)
        return
    }
    
    // Deduct from balance
    const { error: updateError } = await supabase
        .rpc('update_user_balance', {
            p_user_id: currentUser.id,
            p_amount: -amount
        })
        
    if (updateError) {
        alert('Error updating balance: ' + updateError.message)
        return
    }
    
    // Create transaction record
    const { error: transactionError } = await supabase
        .from('transactions')
        .insert([
            {
                user_id: currentUser.id,
                type: 'withdrawal',
                amount: -amount,
                description: `Withdrawal via ${selectedMethod.toUpperCase()}`
            }
        ])
        
    if (transactionError) {
        console.error('Error creating transaction:', transactionError)
    }
    
    alert('Withdrawal request submitted successfully! It will be processed within 24-48 hours.')
    closeWithdrawModal()
    await loadWalletData()
    await loadTransactions()
}

function selectCoinAmount(amount) {
    document.querySelectorAll('.coins-option').forEach(option => {
        option.classList.remove('selected')
    })
    event.currentTarget.classList.add('selected')
    document.getElementById('customCoins').value = ''
    updatePurchaseButton(amount)
}

function updateCustomCoins() {
    const customAmount = parseInt(document.getElementById('customCoins').value) || 0
    if (customAmount > 0) {
        document.querySelectorAll('.coins-option').forEach(option => {
            option.classList.remove('selected')
        })
        updatePurchaseButton(customAmount)
    }
}

function updatePurchaseButton(coinAmount) {
    const price = calculateCoinPrice(coinAmount)
    document.getElementById('purchaseCoinsBtn').textContent = `Purchase for $${price.toFixed(2)}`
}

function calculateCoinPrice(coins) {
    // Pricing: 100 coins = $1, with bulk discounts
    if (coins >= 5000) return coins * 0.007  // $35 for 5000 coins
    if (coins >= 1000) return coins * 0.008  // $8 for 1000 coins
    if (coins >= 500) return coins * 0.009   // $4.50 for 500 coins
    return coins * 0.01  // $1 for 100 coins
}

async function purchaseCoins() {
    let coinAmount = 0
    
    // Get selected amount
    const selectedOption = document.querySelector('.coins-option.selected')
    if (selectedOption) {
        coinAmount = parseInt(selectedOption.querySelector('.coins-amount').textContent)
    } else {
        coinAmount = parseInt(document.getElementById('customCoins').value) || 0
    }
    
    if (coinAmount <= 0) {
        alert('Please select or enter a valid coin amount')
        return
    }
    
    const price = calculateCoinPrice(coinAmount)
    
    // In a real app, this would integrate with a payment gateway
    // For demo, we'll simulate the purchase
    const confirmPurchase = confirm(`Confirm purchase of ${coinAmount} coins for $${price.toFixed(2)}?`)
    
    if (confirmPurchase) {
        // Update user coins
        const { error } = await supabase
            .rpc('update_user_coins', {
                p_user_id: currentUser.id,
                p_coins: coinAmount
            })
            
        if (error) {
            alert('Error purchasing coins: ' + error.message)
            return
        }
        
        // Record transaction
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert([
                {
                    user_id: currentUser.id,
                    type: 'purchase',
                    amount: -price,
                    description: `Purchased ${coinAmount} coins`
                }
            ])
            
        if (transactionError) {
            console.error('Error recording transaction:', transactionError)
        }
        
        alert(`Successfully purchased ${coinAmount} coins!`)
        closeAddCoinsModal()
        await loadWalletData()
    }
}

function resetWithdrawForm() {
    document.getElementById('withdrawAmount').value = ''
    document.getElementById('upiId').value = ''
    document.getElementById('paypalEmail').value = ''
    selectWithdrawalMethod('upi')
}

function resetCoinsForm() {
    document.querySelectorAll('.coins-option').forEach(option => {
        option.classList.remove('selected')
    })
    document.getElementById('customCoins').value = ''
}

function showTransactionHistory() {
    alert('Full transaction history would open here')
}

function viewAllTransactions() {
    alert('View all transactions would open here')
}

document.addEventListener('DOMContentLoaded', initWallet)
