import { supabase } from './supabase-client.js'

// Google OAuth login
document.getElementById('googleLogin').addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/index.html'
        }
    })

    if (error) {
        console.error('Error signing in:', error)
        alert('Error signing in. Please try again.')
    }
})

// Check if user is already logged in
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session) {
        window.location.href = 'index.html'
    }
}

// Initialize auth check
checkAuth()
