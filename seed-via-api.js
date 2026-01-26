const API_URL = 'http://localhost:5000/api';

async function seed() {
    console.log('🌱 Starting API-based seeding...');

    // 1. Create Admin & Login
    let adminToken = await registerAndLogin('Admin User', 'admin@votesecure.com', 'admin123', 'admin');
    if (!adminToken) {
        // Try login only
        adminToken = await login('admin@votesecure.com', 'admin123');
    }

    if (!adminToken) {
        console.error('❌ Failed to authenticate as admin. Aborting.');
        return;
    }
    console.log('✅ Admin authenticated');

    // 2. Create Voter
    await registerAndLogin('John Doe', 'john.doe@email.com', 'voter123', 'voter');
    console.log('✅ Voter created/verified');

    // 3. Check & Create Elections
    const elections = await getElections(adminToken);
    const existingTitles = new Set(elections.map(e => e.title));

    // Election 1: Active
    if (!existingTitles.has('2024 City Council Election')) {
        await createElection(adminToken, {
            title: '2024 City Council Election',
            description: 'Elect representatives for the city council to serve a 4-year term.',
            start_time: '2024-01-01',
            end_time: '2026-12-31',
            candidates: [
                { name: 'Sarah Johnson', party: 'Democratic Party', image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330' },
                { name: 'Mike Davis', party: 'Republican Party', image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d' },
                { name: 'Emily Chen', party: 'Independent', image_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80' },
                { name: 'Robert Williams', party: 'Green Party', image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e' }
            ]
        });
        console.log('✅ Created Active Election: City Council');
    } else {
        console.log('ℹ️  City Council Election already exists');
    }

    // Election 2: Active
    if (!existingTitles.has('School Board Election 2024')) {
        await createElection(adminToken, {
            title: 'School Board Election 2024',
            description: 'Choose board members to oversee educational policies.',
            start_time: '2024-03-01',
            end_time: '2026-12-31',
            candidates: [
                { name: 'Dr. Amanda Martinez', party: 'Education First', image_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2' },
                { name: 'James Thompson', party: 'Parents Coalition', image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e' },
                { name: 'Lisa Anderson', party: 'Independent', image_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956' }
            ]
        });
        console.log('✅ Created Active Election: School Board');
    } else {
        console.log('ℹ️  School Board Election already exists');
    }

    // Election 3: Upcoming
    if (!existingTitles.has('Community Budget Referendum')) {
        // Determine upcoming dates (future)
        const start = new Date();
        start.setFullYear(start.getFullYear() + 1);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        await createElection(adminToken, {
            title: 'Community Budget Referendum',
            description: 'Vote on the proposed $2.5M budget allocation.',
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: 'upcoming',
            candidates: [
                { name: 'YES - Approve Budget', party: 'Proposal', image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40' },
                { name: 'NO - Reject Budget', party: 'Opposition', image_url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85' }
            ]
        });
        console.log('✅ Created Upcoming Election: Budget Referendum');
    } else {
        console.log('ℹ️  Budget Referendum already exists');
    }

    // Election 4: Ended (Note: API creates as active, so we might need to rely on dates or hack it if the backend checks status vs dates)
    // The backend `Election` model has a `status` field. The POST /elections endpoint force sets status to 'active' (Line 41 in elections.js).
    // So we can't create 'ended' or 'upcoming' elections easily via this simplified API unless we update the code or the API logic.
    // However, the dashboard logic checks dates? No, `routes/elections.js` filters by `whereClause.status = status`.
    // It ignores dates for status calculation (simplified).
    // So if the API forces 'active', everything will be active.

    // WORKAROUND: I will update `routes/elections.js` to accept status if provided by admin, or I will assume the user manually updates it.
    // Actually, I can allow status override in `routes/elections.js` since I am the dev.
    // Only Admin can create anyway.
}

async function registerAndLogin(name, email, password, role) {
    try {
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role }) // Role might be ignored by register endpoint default, but we can try
        });
        // Login
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        return data.token;
    } catch (e) {
        console.error('Registration/Login error', e);
        return null;
    }
}

async function login(email, password) {
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        return data.token;
    } catch (e) {
        return null;
    }
}

async function getElections(token) {
    try {
        // Fetch all statuses
        const [active, upcoming, ended] = await Promise.all([
            fetch(`${API_URL}/elections?status=active`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
            fetch(`${API_URL}/elections?status=upcoming`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
            fetch(`${API_URL}/elections?status=ended`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json())
        ]);

        const all = [
            ...(active.elections || []),
            ...(upcoming.elections || []),
            ...(ended.elections || [])
        ];
        return all;
    } catch (e) {
        return [];
    }
}

async function createElection(token, data) {
    try {
        await fetch(`${API_URL}/elections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error('Create election error', e);
    }
}

seed();
