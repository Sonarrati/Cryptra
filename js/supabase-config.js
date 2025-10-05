// Supabase configuration
const SUPABASE_URL = 'https://niltfnylfjjjriqmxhcu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pbHRmbnlsZmpqanJpcW14aGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1OTMzOTEsImV4cCI6MjA3NTE2OTM5MX0.rSyHL8ss8pAErjuYxtCmJ15ouxuKFj5B6MtqYcrWYgg';

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Authentication state listener
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && window.location.pathname.includes('login.html')) {
        window.location.href = 'dashboard.html';
    } else if (event === 'SIGNED_OUT' && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
        window.location.href = 'login.html';
    }
});

// Utility functions
const utils = {
    // Format coins with commas
    formatCoins(coins) {
        return coins.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    // Calculate cash value from coins
    coinsToCash(coins, rate = 10000) {
        return (coins / rate).toFixed(2);
    },

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        // Add styles if not already added
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 1rem 1.5rem;
                    border-radius: 8px;
                    color: white;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    max-width: 400px;
                    animation: slideIn 0.3s ease;
                }
                .notification-info { background: #3b82f6; }
                .notification-success { background: #10b981; }
                .notification-error { background: #ef4444; }
                .notification-warning { background: #f59e0b; }
                .notification button {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    },

    // Generate random number in range
    randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Check if user has completed action today
    hasCompletedToday(action) {
        const today = new Date().toDateString();
        const completed = JSON.parse(localStorage.getItem(`completed_${action}`) || '{}');
        return completed.date === today;
    },

    // Mark action as completed today
    markCompletedToday(action) {
        const today = new Date().toDateString();
        const completed = { date: today };
        localStorage.setItem(`completed_${action}`, JSON.stringify(completed));
    }
};

// Export for use in other files
window.supabase = supabase;
window.utils = utils;
