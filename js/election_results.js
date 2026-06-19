document.addEventListener('DOMContentLoaded', async function () {
    // --- DATA LOADING & CHARTS ---
    const urlParams = new URLSearchParams(window.location.search);
    const electionId = urlParams.get('id') || urlParams.get('election');

    // UI Elements
    const totalVotesEl = document.getElementById('totalVotes');
    const candidateResultsEl = document.getElementById('candidateResults');
    const headerTitleEl = document.querySelector('h1.text-3xl');
    const lastUpdatedEl = document.getElementById('lastUpdated');

    // Charts
    let pieChartInstance = null;
    let lineChartInstance = null;

    if (!electionId) {
        // Try to fetch the most recent active or ended election
        try {
            const res = await fetchWithAuth('/elections');
            const data = await res.json();
            if (data.success && data.elections.length > 0) {
                const firstId = data.elections[0].id;
                // Update URL without reload if possible, otherwise just load data
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?id=${firstId}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
                loadElectionResults(firstId);
            } else {
                showError('No elections found.');
            }
        } catch (e) {
            console.error(e);
            showError('Error loading election.');
        }
    } else {
        loadElectionResults(electionId);
    }

    // Load Election Data
    async function loadElectionResults(id) {
        try {
            // Fetch election details (including candidates)
            const electionRes = await fetchWithAuth(`/elections/${id}`);
            const electionData = await electionRes.json();

            if (!electionData.success) {
                throw new Error('Election not found');
            }

            const election = electionData.election;
            updateHeader(election);

            // Calculate totals
            const totalVotes = election.Candidates.reduce((acc, c) => acc + (c.vote_count || 0), 0);
            if (totalVotesEl) totalVotesEl.textContent = totalVotes.toLocaleString();

            // Render Candidates
            renderCandidates(election.Candidates, totalVotes);

            // Render Charts
            renderCharts(election.Candidates, totalVotes);

            // Update timestamp
            if (lastUpdatedEl) lastUpdatedEl.textContent = 'Just now';

        } catch (error) {
            console.error('Error loading results:', error);
            showError('Failed to load election results.');
        }
    }

    function updateHeader(election) {
        if (headerTitleEl) headerTitleEl.textContent = `${election.title} Results`;
    }

    function renderCandidates(candidates, totalVotes) {
        if (!candidateResultsEl) return;

        // Sort by votes
        const sorted = [...candidates].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

        candidateResultsEl.innerHTML = sorted.map((c, index) => {
            const votes = c.vote_count || 0;
            const percentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
            const isWinner = index === 0 && totalVotes > 0; // Simple winner logic

            return `
                <div class="border rounded-lg p-4 ${isWinner ? 'bg-success-50 border-success-200' : 'bg-surface border-gray-200'}">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center">
                            <span class="inline-flex items-center justify-center w-8 h-8 ${isWinner ? 'bg-success text-white' : 'bg-gray-200 text-gray-600'} text-sm font-bold rounded-full mr-3">
                                ${index + 1}
                            </span>
                            <div>
                                <h3 class="text-lg font-semibold text-text-primary">${c.name}</h3>
                                <p class="text-sm text-text-secondary">${c.party || 'Independent'}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-bold ${isWinner ? 'text-success' : 'text-text-primary'}">${votes.toLocaleString()}</div>
                            <div class="text-sm text-text-secondary">${percentage}%</div>
                        </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div class="h-3 rounded-full ${isWinner ? 'bg-success' : 'bg-primary'}" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderCharts(candidates, totalVotes) {
        const ctx = document.getElementById('pieChart');
        if (!ctx) return;

        const dataPoints = candidates.map(c => c.vote_count || 0);
        const labels = candidates.map(c => c.name);
        // Extended color palette
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#6b7280', '#ef4444', '#ec4899', '#14b8a6'];

        if (pieChartInstance) pieChartInstance.destroy();

        pieChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataPoints,
                    backgroundColor: colors.slice(0, dataPoints.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });

        // Mock line chart for now
        const lineCtx = document.getElementById('lineChart');
        if (lineCtx && !lineChartInstance) {
            lineChartInstance = new Chart(lineCtx, {
                type: 'line',
                data: {
                    labels: ['Start', '25%', '50%', '75%', 'Now'],
                    datasets: [{
                        label: 'Total Votes',
                        data: [0, Math.floor(totalVotes * 0.25), Math.floor(totalVotes * 0.5), Math.floor(totalVotes * 0.75), totalVotes],
                        borderColor: '#3b82f6',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }

    function showError(msg) {
        if (candidateResultsEl) candidateResultsEl.innerHTML = `<p class="text-center text-error">${msg}</p>`;
    }


    // --- UI INTERACTION LOGIC ---

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileControls = document.getElementById('mobileControls');
    if (mobileMenuBtn && mobileControls) {
        mobileMenuBtn.addEventListener('click', function () {
            mobileControls.style.display = mobileControls.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Refresh functionality
    const refreshBtns = [document.getElementById('refreshBtn'), document.getElementById('mobileRefreshBtn')];
    refreshBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function () {
                const id = new URLSearchParams(window.location.search).get('id') || electionId;
                if (id) loadElectionResults(id);
            });
        }
    });

    // Export modal
    const exportBtn = document.getElementById('exportPdfBtn');
    const exportModal = document.getElementById('exportModal');
    const closeExportModal = document.getElementById('closeExportModal');

    if (exportBtn && exportModal) {
        exportBtn.addEventListener('click', function () {
            exportModal.classList.remove('hidden');
            exportModal.classList.add('flex');
        });
    }
    if (closeExportModal) {
        closeExportModal.addEventListener('click', function () {
            exportModal.classList.add('hidden');
            exportModal.classList.remove('flex');
        });
    }

    // Share modal
    const shareBtn = document.getElementById('shareBtn');
    const shareModal = document.getElementById('shareModal');
    const closeShareModal = document.getElementById('closeShareModal');
    const copyLinkBtn = document.getElementById('copyLinkBtn');

    if (shareBtn && shareModal) {
        shareBtn.addEventListener('click', function () {
            shareModal.classList.remove('hidden');
            shareModal.classList.add('flex');
        });
    }
    if (closeShareModal) {
        closeShareModal.addEventListener('click', function () {
            shareModal.classList.add('hidden');
            shareModal.classList.remove('flex');
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', function () {
            const linkInput = document.querySelector('#shareModal input');
            linkInput.select();
            document.execCommand('copy');
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkBtn.textContent = 'Copy';
            }, 2000);
        });
    }

    // Close modals when clicking outside
    [exportModal, shareModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const modals = [exportModal, shareModal, document.getElementById('mobileFilterPanel')];
            modals.forEach(modal => {
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        }
    });
});
