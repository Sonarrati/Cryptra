import { supabase } from './supabase-client.js'

let currentUser = null
let cart = []
let currentCategory = 'all'

async function initMarketplace() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        window.location.href = 'login.html'
        return
    }
    
    currentUser = user
    await loadUserBalance()
    await loadProducts()
    setupEventListeners()
}

async function loadUserBalance() {
    const { data, error } = await supabase
        .from('users')
        .select('coins')
        .eq('id', currentUser.id)
        .single()

    if (!error && data) {
        document.getElementById('coinBalance').textContent = data.coins
    }
}

async function loadProducts(category = 'all') {
    let query = supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        
    if (category !== 'all') {
        query = query.eq('category', category)
    }
    
    const { data: products, error } = await query

    if (!error && products) {
        displayProducts(products)
    }
}

function displayProducts(products) {
    const featuredContainer = document.getElementById('featuredProducts')
    const allContainer = document.getElementById('allProducts')
    
    featuredContainer.innerHTML = ''
    allContainer.innerHTML = ''
    
    if (products.length === 0) {
        document.getElementById('emptyProducts').style.display = 'block'
        return
    }
    
    document.getElementById('emptyProducts').style.display = 'none'
    
    // Show first 4 as featured
    const featured = products.slice(0, 4)
    const all = products
    
    featured.forEach(product => {
        featuredContainer.appendChild(createProductCard(product))
    })
    
    all.forEach(product => {
        allContainer.appendChild(createProductCard(product))
    })
}

function createProductCard(product) {
    const card = document.createElement('div')
    card.className = 'product-card'
    card.onclick = () => showProductDetails(product)
    
    card.innerHTML = `
        <div class="product-image">
            ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : '🛒'}
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${product.price_coins} Coins</div>
            ${product.stock_quantity > 0 ? 
                `<div class="product-stock">In Stock: ${product.stock_quantity}</div>` :
                `<div class="product-stock out-of-stock">Out of Stock</div>`
            }
        </div>
    `
    
    return card
}

function showProductDetails(product) {
    document.getElementById('modalProductName').textContent = product.name
    document.getElementById('modalProductPrice').textContent = `${product.price_coins} Coins`
    document.getElementById('modalProductDesc').textContent = product.description || 'No description available.'
    document.getElementById('modalProductStock').textContent = `${product.stock_quantity} available`
    document.getElementById('modalProductStock').className = product.stock_quantity > 0 ? 'stock-value' : 'stock-value out-of-stock'
    
    if (product.image_url) {
        document.getElementById('modalProductImg').src = product.image_url
        document.getElementById('modalProductImg').style.display = 'block'
    } else {
        document.getElementById('modalProductImg').style.display = 'none'
    }
    
    // Reset quantity
    document.getElementById('productQuantity').textContent = '1'
    
    // Update purchase button state
    const purchaseBtn = document.getElementById('purchaseProductBtn')
    if (product.stock_quantity > 0) {
        purchaseBtn.disabled = false
        purchaseBtn.textContent = 'Purchase Now'
        purchaseBtn.onclick = () => purchaseProduct(product, parseInt(document.getElementById('productQuantity').textContent))
    } else {
        purchaseBtn.disabled = true
        purchaseBtn.textContent = 'Out of Stock'
    }
    
    document.getElementById('productModal').style.display = 'block'
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none'
}

function increaseQuantity() {
    const quantityElement = document.getElementById('productQuantity')
    let quantity = parseInt(quantityElement.textContent)
    quantityElement.textContent = quantity + 1
}

function decreaseQuantity() {
    const quantityElement = document.getElementById('productQuantity')
    let quantity = parseInt(quantityElement.textContent)
    if (quantity > 1) {
        quantityElement.textContent = quantity - 1
    }
}

async function purchaseProduct(product, quantity) {
    const totalCoins = product.price_coins * quantity
    
    // Check user balance
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('coins')
        .eq('id', currentUser.id)
        .single()
        
    if (userError) {
        alert('Error checking balance')
        return
    }
    
    if (user.coins < totalCoins) {
        alert('Insufficient coins balance')
        return
    }
    
    // Check stock
    if (product.stock_quantity < quantity) {
        alert('Not enough stock available')
        return
    }
    
    const confirmPurchase = confirm(`Confirm purchase of ${quantity} x ${product.name} for ${totalCoins} coins?`)
    
    if (confirmPurchase) {
        // Create order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([
                {
                    user_id: currentUser.id,
                    product_id: product.id,
                    quantity: quantity,
                    total_coins: totalCoins,
                    status: 'pending'
                }
            ])
            .select()
            .single()
            
        if (orderError) {
            alert('Error creating order: ' + orderError.message)
            return
        }
        
        // Deduct coins
        const { error: coinsError } = await supabase
            .rpc('update_user_coins', {
                p_user_id: currentUser.id,
                p_coins: -totalCoins
            })
            
        if (coinsError) {
            alert('Error deducting coins: ' + coinsError.message)
            return
        }
        
        // Update product stock
        const { error: stockError } = await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity - quantity })
            .eq('id', product.id)
            
        if (stockError) {
            console.error('Error updating stock:', stockError)
        }
        
        // Record transaction
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert([
                {
                    user_id: currentUser.id,
                    type: 'purchase',
                    amount: 0, // No cash amount for coin purchases
                    description: `Purchased ${quantity} x ${product.name}`
                }
            ])
            
        alert(`Order placed successfully! Order ID: ${order.id}`)
        closeProductModal()
        await loadUserBalance()
        await loadProducts(currentCategory)
    }
}

function setupEventListeners() {
    // Category filters
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.getAttribute('data-category')
            currentCategory = category
            
            // Update active state
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'))
            this.classList.add('active')
            
            loadProducts(category)
        })
    })
    
    // Search functionality
    document.getElementById('productSearch').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase()
        // Implement search logic here
    })
    
    // Modal close events
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none'
        })
    })
    
    // Cart functionality
    document.getElementById('checkoutBtn').addEventListener('click', proceedToCheckout)
}

function openCart() {
    document.getElementById('cartSidebar').classList.add('open')
    updateCartDisplay()
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('open')
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems')
    const cartCount = document.getElementById('cartCount')
    const cartTotal = document.getElementById('cartTotalAmount')
    
    cartCount.textContent = cart.length
    
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <div class="empty-icon">🛒</div>
                <div class="empty-text">Your cart is empty</div>
            </div>
        `
        cartTotal.textContent = '0 Coins'
        return
    }
    
    cartItems.innerHTML = ''
    let totalCoins = 0
    
    cart.forEach((item, index) => {
        const itemElement = document.createElement('div')
        itemElement.className = 'cart-item'
        itemElement.innerHTML = `
            <div class="cart-item-image">${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : '🛒'}</div>
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${item.price_coins} Coins</div>
                <div class="cart-item-quantity">
                    <div class="quantity-control">
                        <button onclick="decreaseCartQuantity(${index})">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="increaseCartQuantity(${index})">+</button>
                    </div>
                    <button class="remove-btn" onclick="removeFromCart(${index})">Remove</button>
                </div>
            </div>
        `
        cartItems.appendChild(itemElement)
        totalCoins += item.price_coins * item.quantity
    })
    
    cartTotal.textContent = `${totalCoins} Coins`
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id)
    
    if (existingItem) {
        existingItem.quantity += 1
    } else {
        cart.push({
            ...product,
            quantity: 1
        })
    }
    
    updateCartDisplay()
    showNotification('Product added to cart!')
}

function removeFromCart(index) {
    cart.splice(index, 1)
    updateCartDisplay()
}

function increaseCartQuantity(index) {
    cart[index].quantity += 1
    updateCartDisplay()
}

function decreaseCartQuantity(index) {
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1
    } else {
        cart.splice(index, 1)
    }
    updateCartDisplay()
}

async function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty')
        return
    }
    
    const totalCoins = cart.reduce((sum, item) => sum + (item.price_coins * item.quantity), 0)
    
    // Check user balance
    const { data: user, error } = await supabase
        .from('users')
        .select('coins')
        .eq('id', currentUser.id)
        .single()
        
    if (error) {
        alert('Error checking balance')
        return
    }
    
    if (user.coins < totalCoins) {
        alert('Insufficient coins balance')
        return
    }
    
    // Process each item in cart
    for (const item of cart) {
        await purchaseProduct(item, item.quantity)
    }
    
    // Clear cart
    cart = []
    closeCart()
    updateCartDisplay()
}

function showNotification(message) {
    // Simple notification implementation
    const notification = document.createElement('div')
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    `
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
        document.body.removeChild(notification)
    }, 3000)
}

function viewAllProducts() {
    // Scroll to all products section
    document.getElementById('allProducts').scrollIntoView({ behavior: 'smooth' })
}

// Make functions globally available for HTML onclick events
window.openCart = openCart
window.closeCart = closeCart
window.increaseQuantity = increaseQuantity
window.decreaseQuantity = decreaseQuantity
window.closeProductModal = closeProductModal
window.removeFromCart = removeFromCart
window.increaseCartQuantity = increaseCartQuantity
window.decreaseCartQuantity = decreaseCartQuantity

document.addEventListener('DOMContentLoaded', initMarketplace)
