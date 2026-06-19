// Voter Dashboard JavaScript
document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'secure_login.html';
        return;
    }

    // Load user data
    await loadUserData();
    await loadDashboardStats();
    await loadActiveElections();

    // Setup user menu
    setupUserMenu();
    setupLogout();

    // Load user data
    async function loadUserData() {
        try {
            const response = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (data.success && data.user) {
                // Store user in localStorage for other pages
                localStorage.setItem('user', JSON.stringify(data.user));

                const userName = data.user.name || data.user.email || 'Voter';
                document.getElementById('userName').textContent = userName;
                document.getElementById('welcomeName').textContent = userName.split(' ')[0];
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // Load dashboard stats
    async function loadDashboardStats() {
        try {
            // Load active elections count
            const electionsResponse = await fetch('/api/elections?status=active', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const electionsData = await electionsResponse.json();

            if (electionsData.success) {
                document.getElementById('activeElectionsCount').textContent = electionsData.elections?.length || 0;
            }

            // Load votes cast
            const votesResponse = await fetch('/api/votes/history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const votesData = await votesResponse.json();

            if (votesData.success) {
                const voteCount = votesData.votes?.length || 0;
                document.getElementById('votesCastCount').textContent = voteCount;

                // Calculate participation rate
                const activeCount = electionsData.elections?.length || 1;
                const rate = Math.round((voteCount / Math.max(activeCount, 1)) * 100);
                document.getElementById('participationRate').textContent = Math.min(rate, 100) + '%';
            }

            // Load upcoming elections
            const upcomingResponse = await fetch('/api/elections?status=upcoming', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const upcomingData = await upcomingResponse.json();

            if (upcomingData.success) {
                document.getElementById('upcomingCount').textContent = upcomingData.elections?.length || 0;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // Load active elections
    async function loadActiveElections() {
        const container = document.getElementById('activeElectionsList');

        try {
            const response = await fetch('/api/elections?status=active', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.elections && data.elections.length > 0) {
                container.innerHTML = data.elections.slice(0, 3).map(election => {
                    const endDate = new Date(election.end_time);
                    const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
                    const candidates = election.Candidates || [];

                    return `
                        <div class="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-white/5 mb-3 hover:border-indigo-500/30 transition-all">
                            <div class="flex-1">
                                <h3 class="text-white font-medium mb-1">${election.title}</h3>
                                <div class="flex items-center text-sm text-slate-400 space-x-4">
                                    <span class="flex items-center">
                                        <i class='bx bx-group mr-1'></i>
                                        ${candidates.length} candidates
                                    </span>
                                    <span class="flex items-center">
                                        <i class='bx bx-time-five mr-1'></i>
                                        ${daysLeft > 0 ? `${daysLeft} days left` : 'Ending soon'}
                                    </span>
                                </div>
                            </div>
                            <a href="voting_interface.html?election=${election.id}" 
                               class="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20">
                                Vote
                            </a>
                        </div>
                    `;
                }).join('');
            } else {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class='bx bx-calendar-x text-4xl text-slate-500 mb-2'></i>
                        <p class="text-slate-400">No active elections at the moment</p>
                        <p class="text-sm text-slate-500 mt-1">Check back later for upcoming elections</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading elections:', error);
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class='bx bx-error-circle text-4xl text-red-400 mb-2'></i>
                    <p class="text-slate-400">Failed to load elections</p>
                    <button onclick="location.reload()" class="mt-2 text-indigo-400 hover:text-indigo-300 text-sm">Retry</button>
                </div>
            `;
        }
    }

    // Setup user menu
    function setupUserMenu() {
        const menuBtn = document.getElementById('userMenuBtn');
        const dropdown = document.getElementById('userDropdown');

        if (menuBtn && dropdown) {
            menuBtn.addEventListener('click', () => {
                dropdown.classList.toggle('hidden');
            });

            // Close on click outside
            document.addEventListener('click', (e) => {
                if (!menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }
    }

    // Setup logout
    function setupLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('user');
                window.location.href = 'secure_login.html';
            });
        }
    }
});
