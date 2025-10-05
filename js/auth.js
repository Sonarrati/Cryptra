// Authentication functions
document.addEventListener('DOMContentLoaded', function() {
    const authForm = document.getElementById('authForm');
    
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }
    
    // Check if user is already logged in
    checkAuthState();
});

async function checkAuthState() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && window.location.pathname.includes('login.html')) {
        window.location.href = 'dashboard.html';
    }
}

async function handleAuth(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const referralCode = document.getElementById('referralCode')?.value || '';
    
    try {
        // Try to sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) {
            // If sign in fails, try to sign up
            if (signInError.message.includes('Invalid login credentials')) {
                await handleSignUp(email, password, referralCode);
            } else {
                throw signInError;
            }
        } else {
            utils.showNotification('Successfully signed in!', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    } catch (error) {
        utils.showNotification(error.message, 'error');
    }
}

async function handleSignUp(email, password, referralCode) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                referral_code: generateReferralCode()
            }
        }
    });

    if (error) throw error;

    // Create user profile in database
    const { error: dbError } = await supabase
        .from('users')
        .insert([
            {
                id: data.user.id,
                email: email,
                referral_code: data.user.user_metadata.referral_code,
                referred_by: referralCode || null,
                wallet_balance: 2000, // Signup bonus
                referral_earned: 0,
                kyc_status: 'pending'
            }
        ]);

    if (dbError) throw dbError;

    // Record signup bonus transaction
    await supabase
        .from('coin_transactions')
        .insert([
            {
                user_id: data.user.id,
                source_type: 'signup',
                coins_amount: 2000,
                balance_after: 2000
            }
        ]);

    utils.showNotification('Account created successfully! 2000 coins bonus added.', 'success');
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 2000);
}

function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Logout function
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        utils.showNotification('Error signing out', 'error');
    } else {
        window.location.href = '../index.html';
    }
}
