// Active Elections Page Logic
document.addEventListener('DOMContentLoaded', async function () {
    const electionsContainer = document.getElementById('electionsGrid');
    const filterButtons = document.querySelectorAll('[data-filter]');
    const searchInput = document.getElementById('searchInput');

    let allElections = [];
    let currentFilter = 'all';

    // Load elections from API
    async function loadElections() {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            const response = await fetch('/api/elections?status=active', { headers });
            const data = await response.json();

            if (data.success) {
                allElections = data.elections || [];
                displayElections(allElections);
            } else {
                showError('Failed to load elections');
            }
        } catch (error) {
            console.error('Error loading elections:', error);
            showError('Unable to connect to server');
        }
    }

    // Display elections
    function displayElections(elections) {
        if (!elections || elections.length === 0) {
            electionsContainer.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-white">No active elections</h3>
                    <p class="mt-1 text-sm text-slate-400">Check back later for upcoming elections</p>
                </div>
            `;
            return;
        }

        electionsContainer.innerHTML = elections.map(election => createElectionCard(election)).join('');
    }

    // Create election card HTML
    function createElectionCard(election) {
        const candidates = election.Candidates || [];
        const endDate = new Date(election.end_time);
        const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

        return `
            <div class="glass-card border border-white/10 p-6 hover:border-indigo-500/30 transition-all duration-300 group">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                            ${election.title}
                        </h3>
                        <p class="text-sm text-slate-400 mb-3">${election.description || ''}</p>
                        <div class="flex items-center space-x-4 text-xs text-slate-500">
                            <div class="flex items-center">
                                <i class='bx bx-group mr-1'></i>
                                ${candidates.length} candidates
                            </div>
                            <div class="flex items-center">
                                <i class='bx bx-time-five mr-1'></i>
                                ${daysLeft > 0 ? `${daysLeft} days left` : 'Ending soon'}
                            </div>
                        </div>
                    </div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                        Active
                    </span>
                </div>

                <div class="space-y-2 mb-4">
                    ${candidates.slice(0, 3).map(candidate => `
                        <div class="flex items-center p-2 bg-slate-800/50 rounded-lg">
                            <img src="${candidate.image_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop'}" 
                                 alt="${candidate.name}" 
                                 class="h-8 w-8 rounded-full object-cover mr-3"
                                 onerror="this.src='https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop'">
                            <div class="flex-1">
                                <p class="text-sm font-medium text-white">${candidate.name}</p>
                                <p class="text-xs text-slate-400">${candidate.party || 'Independent'}</p>
                            </div>
                        </div>
                    `).join('')}
                    ${candidates.length > 3 ? `
                        <p class="text-xs text-slate-500 text-center">+${candidates.length - 3} more candidates</p>
                    ` : ''}
                </div>

                <div class="flex space-x-3">
                    <a href="voting_interface.html?election=${election.id}" 
                       class="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg text-sm font-medium text-center transition-all shadow-lg shadow-indigo-500/20">
                        Vote Now
                    </a>
                    <a href="election_details.html?id=${election.id}" 
                       class="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium">
                        Details
                    </a>
                </div>
            </div>
        `;
    }

    // Filter elections
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            filterButtons.forEach(btn => {
                btn.classList.remove('bg-indigo-500', 'text-white');
                btn.classList.add('bg-slate-700', 'text-slate-300');
            });
            this.classList.add('bg-indigo-500', 'text-white');
            this.classList.remove('bg-slate-700', 'text-slate-300');

            currentFilter = this.dataset.filter;
            applyFilters();
        });
    });

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }

    function applyFilters() {
        let filtered = allElections;

        // Apply search
        if (searchInput && searchInput.value) {
            const searchTerm = searchInput.value.toLowerCase();
            filtered = filtered.filter(election =>
                election.title.toLowerCase().includes(searchTerm) ||
                (election.description && election.description.toLowerCase().includes(searchTerm))
            );
        }

        displayElections(filtered);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function showError(message) {
        electionsContainer.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class='bx bx-error-circle text-red-400 text-5xl mb-4'></i>
                <h3 class="text-sm font-medium text-white">${message}</h3>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors">
                    Retry
                </button>
            </div>
        `;
    }

    // Initialize
    await loadElections();
});
