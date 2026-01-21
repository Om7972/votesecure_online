
document.addEventListener('DOMContentLoaded', async () => {
    const electionsGrid = document.getElementById('electionsGrid');
    const loadingState = document.getElementById('loadingState');
    const sortSelect = document.getElementById('sortSelect');
    const searchInput = document.getElementById('searchInput');

    let allElections = [];

    // Fetch and display elections
    async function fetchElections(status = 'active') {
        try {
            loadingState.classList.remove('hidden');
            electionsGrid.innerHTML = ''; // Clear existing content

            const response = await fetchWithAuth(`${API_URL}/elections?status=${status}`);

            if (!response.ok) {
                throw new Error('Failed to fetch elections');
            }

            const data = await response.json();
            if (data.success) {
                allElections = data.elections;
                renderElections(allElections);
            } else {
                electionsGrid.innerHTML = `<p class="text-center col-span-3 text-red-500">${data.message}</p>`;
            }

        } catch (error) {
            console.error('Error:', error);
            electionsGrid.innerHTML = `<p class="text-center col-span-3 text-red-500">Error loading elections. Please try again.</p>`;
        } finally {
            loadingState.classList.add('hidden');
        }
    }

    function renderElections(elections) {
        electionsGrid.innerHTML = '';

        if (elections.length === 0) {
            electionsGrid.innerHTML = `<p class="text-center col-span-3 text-gray-500">No elections found.</p>`;
            return;
        }

        elections.forEach(election => {
            const card = document.createElement('div');
            card.className = `card-interactive border-l-4 ${getBorderColor(election.status)}`;

            // Calculate time remaining or status text
            const timeInfo = getTimeInfo(election);

            card.innerHTML = `
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center space-x-2">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(election.status)}">
                            ${election.status.charAt(0).toUpperCase() + election.status.slice(1)}
                        </span>
                        <span class="text-xs text-text-secondary">Federal</span> <!-- Placeholder Category -->
                    </div>
                </div>
                
                <h3 class="text-lg font-semibold text-text-primary mb-2">${election.title}</h3>
                <p class="text-text-secondary text-sm mb-4 line-clamp-2">${election.description}</p>
                
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-4">
                        <div class="text-sm">
                            <span class="text-text-secondary">Candidates:</span>
                            <span class="font-medium text-text-primary">${election.Candidates ? election.Candidates.length : 0}</span>
                        </div>
                    </div>
                </div>
                
                <div class="${getBgColor(election.status)} rounded-lg p-3 mb-4">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium ${getTextColor(election.status)}">${timeInfo.label}</span>
                        <div class="flex items-center space-x-1 ${getTextColor(election.status)}">
                             <span class="font-mono text-sm">${timeInfo.value}</span>
                        </div>
                    </div>
                </div>
                
                <button onclick="window.location.href='voting_interface.html?id=${election.id}'" class="w-full ${getButtonClass(election.status)}" ${election.status !== 'active' ? 'disabled' : ''}>
                    ${getButtonText(election.status)}
                </button>
            `;
            electionsGrid.appendChild(card);
        });

        document.getElementById('electionCount').textContent = elections.length;
    }

    // Helper functions for styling logic
    function getBorderColor(status) {
        switch (status) {
            case 'active': return 'border-l-success';
            case 'upcoming': return 'border-l-primary';
            default: return 'border-l-secondary-300';
        }
    }

    function getStatusBadgeColor(status) {
        switch (status) {
            case 'active': return 'bg-success-100 text-success-800';
            case 'upcoming': return 'bg-primary-100 text-primary-800';
            default: return 'bg-secondary-100 text-secondary-700';
        }
    }

    function getBgColor(status) {
        switch (status) {
            case 'active': return 'bg-success-50';
            case 'upcoming': return 'bg-primary-50';
            default: return 'bg-secondary-50';
        }
    }

    function getTextColor(status) {
        switch (status) {
            case 'active': return 'text-success-800';
            case 'upcoming': return 'text-primary-800';
            default: return 'text-secondary-700';
        }
    }

    function getButtonClass(status) {
        if (status === 'active') return 'btn-success';
        return 'btn-secondary';
    }

    function getButtonText(status) {
        if (status === 'active') return 'Vote Now';
        if (status === 'upcoming') return 'Voting Opens Soon';
        return 'View Results';
    }

    function getTimeInfo(election) {
        const now = new Date();
        const start = new Date(election.start_time);
        const end = new Date(election.end_time);

        if (election.status === 'upcoming') {
            return { label: 'Starts In', value: new Date(start).toLocaleDateString() };
        } else if (election.status === 'active') {
            // Simple logic for now, could use a countdown library
            const diffTime = Math.abs(end - now);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { label: 'Time Remaining', value: `${diffDays} days` };
        } else {
            return { label: 'Ended', value: new Date(end).toLocaleDateString() };
        }
    }

    // Search Filter
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allElections.filter(election =>
            election.title.toLowerCase().includes(term) ||
            election.description.toLowerCase().includes(term)
        );
        renderElections(filtered);
    });

    // Sorting
    sortSelect.addEventListener('change', (e) => {
        const sortBy = e.target.value;
        let sorted = [...allElections];

        if (sortBy === 'deadline') {
            sorted.sort((a, b) => new Date(a.end_time) - new Date(b.end_time));
        } else if (sortBy === 'alphabetical') {
            sorted.sort((a, b) => a.title.localeCompare(b.title));
        }
        // Add more sorts as needed

        renderElections(sorted);
    });

    // Initial Load
    fetchElections();

    // Filter Chips Logic (Simplified)
    document.getElementById('filterChips').addEventListener('click', (e) => {
        // Logic to toggle active class on chips and refetch/filter
    });

});
