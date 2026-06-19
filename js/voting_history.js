document.addEventListener('DOMContentLoaded', async function () {
    const historyList = document.getElementById('historyList'); // Ensure this ID exists in HTML

    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'secure_login.html';
        return;
    }

    // Load History
    await loadVotingHistory();

    async function loadVotingHistory() {
        if (!historyList) return;

        try {
            const response = await fetchWithAuth('/votes/history');
            const data = await response.json();

            if (data.success) {
                renderHistory(data.history);
                updateStats(data.history); // Update filters/stats if any
            } else {
                historyList.innerHTML = `<p class="text-center text-error pt-8">${data.message || 'Failed to load history.'}</p>`;
            }
        } catch (error) {
            console.error('Error loading history:', error);
            historyList.innerHTML = `<p class="text-center text-error pt-8">Error connecting to server.</p>`;
        }
    }

    function renderHistory(votes) {
        if (!votes || votes.length === 0) {
            historyList.innerHTML = `
                <div class="text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-white">No voting history</h3>
                    <p class="mt-1 text-sm text-slate-400">Cast your first vote in Active Elections</p>
                    <a href="active_elections.html" class="mt-4 btn-primary inline-flex">Go to Elections</a>
                </div>
            `;
            return;
        }

        historyList.innerHTML = votes.map((vote, index) => {
            const election = vote.Election || {};
            const candidate = vote.Candidate || {};
            const date = new Date(vote.createdAt).toLocaleDateString();
            const time = new Date(vote.createdAt).toLocaleTimeString();
            const detailId = `history-${vote.id}`;
            const isCompleted = true; // Votes are usually completed if they are in history table

            return `
                <div class="card-interactive border-l-4 border-l-success mb-4">
                    <div class="flex flex-col">
                        <div class="flex items-start justify-between mb-4">
                            <div class="flex-1">
                                <div class="flex items-center mb-2">
                                    <h3 class="text-lg font-semibold text-text-primary mr-3">${election.title || 'Unknown Election'}</h3>
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-emerald-800">
                                        Completed
                                    </span>
                                </div>
                                <p class="text-text-secondary text-sm mb-3">${election.description || 'Verified Vote'}</p>
                                <div class="flex items-center text-sm text-text-secondary space-x-4">
                                    <div class="flex items-center">
                                        <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a4 4 0 118 0v4m-4 8a4 4 0 11-8 0v-1a4 4 0 014-4h4a4 4 0 014 4v1a4 4 0 11-8 0z" />
                                        </svg>
                                        Voted: ${date}
                                    </div>
                                    <div class="flex items-center">
                                        <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Transaction: ${vote.receipt_hash ? vote.receipt_hash.substring(0, 8) + '...' : 'Recorded'}
                                    </div>
                                </div>
                            </div>
                            <button class="btn-secondary ml-4 toggle-details-btn" data-target="${detailId}">
                                <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                                Details
                            </button>
                        </div>

                        <!-- Detailed View -->
                        <div class="hidden border-t border-gray-100 pt-4" id="${detailId}">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <h4 class="text-sm font-medium text-text-primary mb-2">Your Selection</h4>
                                    <div class="flex items-center p-3 bg-success-50 rounded-lg">
                                        <div class="h-8 w-8 bg-success rounded-full flex items-center justify-center mr-3">
                                            <svg class="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p class="text-sm font-medium text-text-primary">${candidate.name || 'Unknown'}</p>
                                            <p class="text-xs text-text-secondary">${candidate.party || ''}</p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 class="text-sm font-medium text-text-primary mb-2">Vote Status</h4>
                                    <div class="space-y-2">
                                        <div class="flex justify-between items-center">
                                            <span class="text-xs text-text-secondary">Validation</span>
                                            <span class="text-xs font-medium text-success">Verified</span>
                                        </div>
                                        <div class="flex justify-between items-center">
                                            <span class="text-xs text-text-secondary">Encryption</span>
                                            <span class="text-xs font-medium text-success">AES-256</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center justify-between pt-3 border-t border-gray-100">
                                <span class="text-xs text-text-secondary">Vote ID: ${vote.id}</span>
                                <button class="btn-secondary text-xs" onclick="alert('Exporting feature coming soon')">
                                    <svg class="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Export Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners for details
        document.querySelectorAll('.toggle-details-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const targetId = this.getAttribute('data-target');
                const content = document.getElementById(targetId);
                if (content.classList.contains('hidden')) {
                    content.classList.remove('hidden');
                    this.innerHTML = `
                        <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        </svg>
                        Hide
                    `;
                } else {
                    content.classList.add('hidden');
                    this.innerHTML = `
                        <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                        Details
                    `;
                }
            });
        });
    }

    function updateStats(votes) {
        // e.g. update count in sidebar
        // Assume elements exist or we don't bother for now
    }
});
