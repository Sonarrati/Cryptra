// Add these functions to your existing supabase-config.js
const utils = {
    // ... existing code ...

    // Enhanced coin adding function
    async addCoinsToUser(sourceType, coinsAmount) {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !user) {
                throw new Error('User not authenticated');
            }

            console.log(`Adding ${coinsAmount} coins for ${sourceType} to user:`, user.id);

            // Get current user balance
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('wallet_balance')
                .eq('id', user.id)
                .single();

            if (userError) {
                console.error('Error fetching user data:', userError);
                throw userError;
            }

            if (!userData) {
                throw new Error('User data not found');
            }

            const currentBalance = userData.wallet_balance || 0;
            const newBalance = currentBalance + coinsAmount;

            console.log(`Updating balance from ${currentBalance} to ${newBalance}`);

            // Update user balance
            const { error: updateError } = await supabase
                .from('users')
                .update({ wallet_balance: newBalance })
                .eq('id', user.id);

            if (updateError) {
                console.error('Error updating balance:', updateError);
                throw updateError;
            }

            // Record transaction
            const { error: transactionError } = await supabase
                .from('coin_transactions')
                .insert([
                    {
                        user_id: user.id,
                        source_type: sourceType,
                        coins_amount: coinsAmount,
                        balance_after: newBalance,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (transactionError) {
                console.error('Error recording transaction:', transactionError);
                throw transactionError;
            }

            console.log('Coins added successfully');
            return { success: true, newBalance };

        } catch (error) {
            console.error('Error in addCoinsToUser:', error);
            throw error;
        }
    },

    // Check daily limit
    checkDailyLimit(action, limit) {
        const today = new Date().toDateString();
        const actionData = JSON.parse(localStorage.getItem(`daily_${action}`) || '{"date": "", "count": 0}');
        
        if (actionData.date !== today) {
            // Reset for new day
            localStorage.setItem(`daily_${action}`, JSON.stringify({ date: today, count: 0 }));
            return { canProceed: true, count: 0 };
        }
        
        return { 
            canProceed: actionData.count < limit, 
            count: actionData.count 
        };
    },

    // Update daily count
    updateDailyCount(action) {
        const today = new Date().toDateString();
        const actionData = JSON.parse(localStorage.getItem(`daily_${action}`) || '{"date": "", "count": 0}');
        
        if (actionData.date !== today) {
            actionData.date = today;
            actionData.count = 0;
        }
        
        actionData.count++;
        localStorage.setItem(`daily_${action}`, JSON.stringify(actionData));
        return actionData.count;
    }
};
