// Active Elections JavaScript
document.addEventListener('DOMContentLoaded', async function () {
    const token = localStorage.getItem('token');

    // Check authentication
    if (!token) {
        window.location.href = 'secure_login.html';
        return;
    }

    // Load user data
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success && data.user) {
            const userName = document.getElementById('userName');
            if (userName) {
                userName.textContent = data.user.name || data.user.email || 'Voter';
            }
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }

    // Load elections
    await loadElections();
});

let allElections = [];
let currentStatus = 'active';
let currentType = 'all';

async function loadElections() {
    const token = localStorage.getItem('token');
    const grid = document.getElementById('electionsGrid');

    try {
        const [activeRes, upcomingRes, endedRes] = await Promise.all([
            fetch('/api/elections?status=active', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/elections?status=upcoming', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/elections?status=ended', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const [activeData, upcomingData, endedData] = await Promise.all([
            activeRes.json(),
            upcomingRes.json(),
            endedRes.json()
        ]);

        const active = activeData.elections || [];
        const upcoming = upcomingData.elections || [];
        const ended = endedData.elections || [];

        allElections = [...active, ...upcoming, ...ended];

        // Update counts
        document.getElementById('activeCount').textContent = active.length;
        document.getElementById('upcomingCount').textContent = upcoming.length;
        document.getElementById('endedCount').textContent = ended.length;

        renderElections();
    } catch (error) {
        console.error('Error loading elections:', error);
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class='bx bx-error-circle text-4xl text-red-400 mb-4'></i>
                <p class="text-slate-400">Failed to load elections</p>
                <button onclick="loadElections()" class="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg">Retry</button>
            </div>
        `;
    }
}

function getElectionType(election) {
    const text = (election.title + ' ' + (election.description || '')).toLowerCase();
    if (text.includes('federal') || text.includes('presidential') || text.includes('congress') || text.includes('senate elections')) {
        return 'federal';
    } else if (text.includes('state') || text.includes('governor') || text.includes('assembly')) {
        return 'state';
    }
    return 'local';
}

function setStatusFilter(status) {
    currentStatus = status;

    // Update tab styles
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.tab-btn').classList.add('active');

    renderElections();
}

function setTypeFilter(type) {
    currentType = type;

    // Update chip styles
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    event.target.closest('.filter-chip').classList.add('active');

    renderElections();
}

function renderElections() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();

    let filtered = allElections.filter(election => {
        const matchesStatus = election.status === currentStatus;
        const matchesType = currentType === 'all' || getElectionType(election) === currentType;
        const matchesSearch = election.title.toLowerCase().includes(searchQuery) ||
            (election.description || '').toLowerCase().includes(searchQuery);
        return matchesStatus && matchesType && matchesSearch;
    });

    const grid = document.getElementById('electionsGrid');
    const emptyState = document.getElementById('emptyState');

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');

    grid.innerHTML = filtered.map(election => {
        const type = getElectionType(election);
        const candidates = election.Candidates || [];
        const totalVotes = candidates.reduce((sum, c) => sum + (c.vote_count || 0), 0);
        const endDate = new Date(election.end_time);
        const startDate = new Date(election.start_time);
        const now = new Date();

        let timeInfo = '';
        if (election.status === 'active') {
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            timeInfo = daysLeft > 0 ? `${daysLeft} days left` : 'Ending soon';
        } else if (election.status === 'upcoming') {
            const daysUntil = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
            timeInfo = `Starts in ${daysUntil} days`;
        } else {
            timeInfo = `Ended ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }

        const actionButton = election.status === 'active'
            ? `<a href="voting_interface.html?election=${election.id}" class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg font-medium transition-all flex items-center justify-center">
                <i class='bx bx-vote mr-2'></i> Vote Now
               </a>`
            : election.status === 'upcoming'
                ? `<button disabled class="w-full py-3 bg-slate-600/50 text-slate-400 rounded-lg font-medium cursor-not-allowed flex items-center justify-center">
                <i class='bx bx-time-five mr-2'></i> Coming Soon
               </button>`
                : `<a href="election_results.html?election=${election.id}" class="w-full py-3 bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 text-white rounded-lg font-medium transition-all flex items-center justify-center">
                <i class='bx bx-bar-chart-alt-2 mr-2'></i> View Results
               </a>`;

        return `
            <div class="election-card glass-card border border-white/10 rounded-2xl overflow-hidden">
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <span class="type-badge type-${type}">${type}</span>
                        <span class="status-badge status-${election.status}">${election.status.charAt(0).toUpperCase() + election.status.slice(1)}</span>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-2">${election.title}</h3>
                    <p class="text-slate-400 text-sm mb-4 line-clamp-2">${election.description || 'No description available'}</p>
                    <div class="flex items-center justify-between text-sm text-slate-400 mb-4">
                        <span class="flex items-center">
                            <i class='bx bx-group mr-1'></i>
                            ${candidates.length} candidates
                        </span>
                        <span class="flex items-center">
                            <i class='bx bx-bar-chart mr-1'></i>
                            ${totalVotes.toLocaleString()} votes
                        </span>
                    </div>
                    <div class="flex items-center text-sm text-slate-400 mb-4">
                        <i class='bx bx-time-five mr-1'></i>
                        ${timeInfo}
                    </div>
                    ${actionButton}
                </div>
            </div>
        `;
    }).join('');
}
