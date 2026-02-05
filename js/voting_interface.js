// Voting Interface JavaScript
document.addEventListener('DOMContentLoaded', async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const electionId = urlParams.get('election');

    if (!electionId) {
        alert('No election selected');
        window.location.href = 'active_elections.html';
        return;
    }

    let electionData = null;
    let selectedVotes = {};

    // Load election details
    async function loadElection() {
        try {
            const response = await fetch(`/api/elections/${electionId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();

            if (data.success && data.election) {
                electionData = data.election;
                displayElection();
            } else {
                showError('Failed to load election details');
            }
        } catch (error) {
            console.error('Error loading election:', error);
            showError('Unable to connect to server');
        }
    }

    // Display election information
    function displayElection() {
        document.getElementById('electionTitle').textContent = electionData.title;
        document.getElementById('electionDescription').textContent = electionData.description || 'Cast your vote for this election';

        const votingSections = document.getElementById('votingSections');

        // Group candidates by position if available, otherwise show all
        const positions = groupCandidatesByPosition(electionData.Candidates || []);

        votingSections.innerHTML = '';

        positions.forEach((positionData, index) => {
            votingSections.innerHTML += createVotingSection(positionData, index);
        });

        // Add event listeners to all candidate cards
        attachCandidateListeners();
    }

    // Group candidates by position
    function groupCandidatesByPosition(candidates) {
        // If candidates have position field, group by it
        // Otherwise, create a single group
        const grouped = {};

        candidates.forEach(candidate => {
            const position = candidate.position || 'Candidates';
            if (!grouped[position]) {
                grouped[position] = [];
            }
            grouped[position].push(candidate);
        });

        return Object.entries(grouped).map(([position, candidates]) => ({
            position,
            candidates
        }));
    }

    // Create voting section HTML
    function createVotingSection(positionData, index) {
        const { position, candidates } = positionData;

        return `
            <div class="glass-card p-6 border border-white/10">
                <div class="mb-6">
                    <h2 class="text-xl font-bold text-white mb-2">${position}</h2>
                    <p class="text-slate-400 text-sm">Select one candidate</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${candidates.map(candidate => createCandidateCard(candidate, position)).join('')}
                </div>
            </div>
        `;
    }

    // Create candidate card HTML
    function createCandidateCard(candidate, position) {
        return `
            <div class="candidate-card bg-slate-800/50 rounded-lg p-4 border border-white/5 cursor-pointer hover:border-indigo-500/50 transition-all duration-200 group"
                 data-candidate-id="${candidate.id}"
                 data-position="${position}">
                <div class="flex items-start space-x-4">
                    <img src="${candidate.image_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'}" 
                         alt="${candidate.name}" 
                         class="w-16 h-16 rounded-full object-cover border-2 border-transparent group-hover:border-indigo-500 transition-all"
                         onerror="this.src='https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'">
                    <div class="flex-1">
                        <h3 class="text-white font-semibold mb-1">${candidate.name}</h3>
                        <p class="text-slate-400 text-sm mb-2">${candidate.party || 'Independent'}</p>
                        ${candidate.bio ? `<p class="text-slate-500 text-xs line-clamp-2">${candidate.bio}</p>` : ''}
                    </div>
                    <div class="select-indicator hidden">
                        <i class='bx bx-check-circle text-emerald-400 text-2xl'></i>
                    </div>
                </div>
            </div>
        `;
    }

    // Attach click listeners to candidate cards
    function attachCandidateListeners() {
        const candidateCards = document.querySelectorAll('.candidate-card');

        candidateCards.forEach(card => {
            card.addEventListener('click', function () {
                const candidateId = this.dataset.candidateId;
                const position = this.dataset.position;

                // Deselect other candidates in same position
                const positionCards = document.querySelectorAll(`[data-position="${position}"]`);
                positionCards.forEach(c => {
                    c.classList.remove('border-indigo-500', 'bg-indigo-500/10');
                    c.querySelector('.select-indicator').classList.add('hidden');
                });

                // Select this candidate
                this.classList.add('border-indigo-500', 'bg-indigo-500/10');
                this.querySelector('.select-indicator').classList.remove('hidden');

                // Store selection
                selectedVotes[position] = candidateId;

                // Check if all positions have selections
                checkAllSelected();
            });
        });
    }

    // Check if all required selections are made
    function checkAllSelected() {
        const positions = document.querySelectorAll('.glass-card');
        const totalPositions = positions.length - 1; // Exclude loading card if any
        const selectedCount = Object.keys(selectedVotes).length;

        const proceedButton = document.getElementById('proceedToReview');

        if (selectedCount > 0) {
            proceedButton.disabled = false;
        } else {
            proceedButton.disabled = true;
        }
    }

    // Proceed to review
    document.getElementById('proceedToReview').addEventListener('click', function () {
        // Store selections in sessionStorage
        sessionStorage.setItem('electionId', electionId);
        sessionStorage.setItem('electionData', JSON.stringify(electionData));
        sessionStorage.setItem('selectedVotes', JSON.stringify(selectedVotes));

        // Navigate to vote process page
        window.location.href = 'vote_process.html';
    });

    // Session timer
    let timeLeft = 14 * 60 + 59; // 14:59 in seconds

    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('sessionTimer').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            alert('Your session has expired. Please start over.');
            window.location.href = 'active_elections.html';
        }

        timeLeft--;
    }

    setInterval(updateTimer, 1000);

    // Error display
    function showError(message) {
        document.getElementById('votingSections').innerHTML = `
            <div class="glass-card p-8 border border-white/10 text-center">
                <i class='bx bx-error-circle text-red-400 text-5xl mb-4'></i>
                <h3 class="text-xl font-semibold text-white mb-2">Error</h3>
                <p class="text-slate-400 mb-4">${message}</p>
                <a href="active_elections.html" class="btn-primary inline-block">Back to Elections</a>
            </div>
        `;
    }

    // Initialize
    await loadElection();
});
