// Quick setup script - Run this in browser console after registering
async function quickSetup() {
    const API_URL = 'http://localhost:5000/api';

    try {
        // Register admin
        console.log('Creating admin user...');
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Admin User',
                email: 'admin@votesecure.com',
                password: 'admin123',
                phone: '+1234567890'
            })
        });

        // Login as admin
        console.log('Logging in as admin...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@votesecure.com',
                password: 'admin123'
            })
        });

        const loginData = await loginRes.json();

        if (!loginData.success) {
            console.log('Admin already exists, trying to login...');
            return;
        }

        const token = loginData.token;
        console.log('✅ Admin logged in');

        // Create elections
        console.log('Creating elections...');
        const election1 = await fetch(`${API_URL}/elections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: '2024 City Council Election',
                description: 'Elect representatives for the city council to serve a 4-year term.',
                start_time: '2024-01-01',
                end_time: '2026-12-31',
                candidates: [
                    {
                        name: 'Sarah Johnson',
                        party: 'Democratic Party',
                        manifesto: 'Focus on education and infrastructure development',
                        image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330'
                    },
                    {
                        name: 'Mike Davis',
                        party: 'Republican Party',
                        manifesto: 'Economic growth and job creation',
                        image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d'
                    },
                    {
                        name: 'Emily Chen',
                        party: 'Independent',
                        manifesto: 'Environmental sustainability and green initiatives',
                        image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80'
                    }
                ]
            })
        });

        console.log('✅ Elections created!');
        console.log('\n📝 Login with:');
        console.log('   Email: admin@votesecure.com');
        console.log('   Password: admin123');

    } catch (error) {
        console.error('Error:', error);
    }
}

// Run it
quickSetup();
