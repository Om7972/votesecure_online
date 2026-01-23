
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const electionId = urlParams.get('id');
    const candidatesContainer = document.querySelector('.space-y-4.mb-8'); // Container for candidate cards
    const electionTitleEl = document.querySelector('h1.text-lg.font-bold');
    const electionDescEl = document.querySelector('.text-text-secondary.mt-1'); // Adjusted selector
    const mainTitleEl = document.querySelector('h2.text-2xl.font-bold');
    const mainDescEl = document.querySelector('.card.mb-6 p.text-text-secondary');

    // UI Elements for selection
    const selectionSummary = document.getElementById('selectionSummary');
    const selectedCandidateContainer = document.getElementById('selectedCandidate');
    const reviewVoteBtn = document.getElementById('reviewVoteBtn');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (!electionId) {
        alert('No election ID specified.');
        window.location.href = 'active_elections.html';
        return;
    }

    // Load Election Details
    try {
        const response = await fetchWithAuth(`/elections/${electionId}`);
        const data = await response.json();

        if (data.success) {
            renderElectionDetails(data.election);
            renderCandidates(data.election.Candidates);
        } else {
            alert('Failed to load election details: ' + data.message);
            window.location.href = 'active_elections.html';
        }
    } catch (error) {
        console.error('Error loading election:', error);
        alert('Error loading election.');
    }

    function renderElectionDetails(election) {
        if (electionTitleEl) electionTitleEl.textContent = election.title;
        // if(electionDescEl) electionDescEl.textContent = election.description; // Optional
        if (mainTitleEl) mainTitleEl.textContent = election.title;
        if (mainDescEl) mainDescEl.textContent = election.description;
    }

    function renderCandidates(candidates) {
        // Clear existing static candidates
        // Note: The HTML has a header "Candidates" inside the container, we want to keep that or recreate it
        // Ideally, the container should be empty or we target a specific list container
        // For now, let's clear everything after the header if possible, or just rebuild the whole section

        // Let's assume the container .space-y-4.mb-8 is purely for candidates list elements + header
        // We will clear it and re-add the header
        candidatesContainer.innerHTML = '<h3 class="text-lg font-semibold text-text-primary mb-4">Candidates</h3>';

        if (!candidates || candidates.length === 0) {
            candidatesContainer.innerHTML += '<p>No candidates found for this election.</p>';
            return;
        }

        candidates.forEach((candidate, index) => {
            const card = document.createElement('div');
            card.className = 'card-interactive candidate-card mb-4';
            card.dataset.candidateId = candidate.id;

            // Image fallback
            const imgSrc = candidate.image_url || 'https://via.placeholder.com/150';

            card.innerHTML = `
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0">
                        <input type="radio" name="candidate" value="${candidate.id}" id="candidate-${candidate.id}" class="h-5 w-5 text-primary focus:ring-primary border-gray-300 mt-1" />
                    </div>
                    <div class="flex-shrink-0">
                        <img src="${imgSrc}" alt="${candidate.name}" class="w-16 h-16 rounded-full object-cover border-2 border-gray-200" onerror="this.src='https://via.placeholder.com/150';" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <label for="candidate-${candidate.id}" class="cursor-pointer w-full block">
                            <h4 class="text-lg font-semibold text-text-primary">${candidate.name}</h4>
                            <p class="text-sm text-text-secondary mb-2">${candidate.party}</p>
                            <p class="text-sm text-text-secondary line-clamp-2">${candidate.manifesto || 'No manifesto provided.'}</p>
                        </label>
                        
                        <!-- Expandable Details -->
                        ${candidate.manifesto ? `
                        <button class="text-primary text-sm font-medium mt-2 hover:text-primary-700 transition-gentle toggle-details-btn">
                            View Full Profile
                            <svg class="inline h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                        <div class="hidden mt-4 pt-4 border-t border-gray-200 candidate-details">
                            <p class="text-sm text-text-secondary">${candidate.manifesto}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;

            candidatesContainer.appendChild(card);

            // Add event listener for details toggle
            const toggleBtn = card.querySelector('.toggle-details-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent card click from selecting radio
                    const details = card.querySelector('.candidate-details');
                    const icon = toggleBtn.querySelector('svg');
                    details.classList.toggle('hidden');
                    if (details.classList.contains('hidden')) {
                        toggleBtn.innerHTML = 'View Full Profile <svg class="inline h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>';
                    } else {
                        toggleBtn.innerHTML = 'Hide Profile <svg class="inline h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="transform: rotate(180deg)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>';
                    }
                });
            }

            // Card click to select radio
            card.addEventListener('click', (e) => {
                if (e.target.type !== 'radio' && !e.target.closest('button')) {
                    const radio = card.querySelector('input[type="radio"]');
                    radio.checked = true;
                    // Trigger change event manually
                    const event = new Event('change');
                    radio.dispatchEvent(event);
                }
            });
        });

        // Re-attach radio change listeners
        const radios = document.querySelectorAll('input[name="candidate"]');
        radios.forEach(radio => {
            radio.addEventListener('change', handleSelectionChange);
        });
    }

    function handleSelectionChange(e) {
        const selectedId = e.target.value;
        const card = e.target.closest('.candidate-card');
        const img = card.querySelector('img').src;
        const name = card.querySelector('h4').textContent;
        const party = card.querySelector('p.text-sm').textContent;

        // Visual update
        document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('ring-2', 'ring-primary', 'bg-primary-50'));
        card.classList.add('ring-2', 'ring-primary', 'bg-primary-50');

        // Update Summary
        selectedCandidateContainer.innerHTML = `
            <img src="${img}" alt="${name}" class="w-12 h-12 rounded-full object-cover">
            <div>
                <p class="font-semibold text-text-primary">${name}</p>
                <p class="text-sm text-text-secondary">${party}</p>
            </div>
        `;
        selectionSummary.classList.remove('hidden');
        reviewVoteBtn.disabled = false;

        // Update Progress
        progressBar.classList.remove('w-1/3');
        progressBar.classList.add('w-full');
        progressBar.classList.remove('bg-primary');
        progressBar.classList.add('bg-success');
        progressText.textContent = '1 of 1 selections complete';
    }

    // Review Vote Action
    window.reviewVote = function () {
        const selectedRadio = document.querySelector('input[name="candidate"]:checked');
        if (!selectedRadio) return;

        const candidateId = selectedRadio.value;
        const card = selectedRadio.closest('.candidate-card');
        const name = card.querySelector('h4').textContent;
        const party = card.querySelector('p.text-sm').textContent;
        const image = card.querySelector('img').src;

        // Save to session storage for confirmation page
        const voteData = {
            electionId: electionId,
            electionTitle: mainTitleEl.textContent,
            candidateId: candidateId,
            candidateName: name,
            candidateParty: party,
            candidateImage: image
        };
        sessionStorage.setItem('pendingVote', JSON.stringify(voteData));

        window.location.href = 'vote_confirmation.html';
    };

    // Clear Selection
    window.clearSelection = function () {
        const radios = document.querySelectorAll('input[name="candidate"]');
        radios.forEach(r => r.checked = false);
        document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('ring-2', 'ring-primary', 'bg-primary-50'));

        selectionSummary.classList.add('hidden');
        reviewVoteBtn.disabled = true;
        progressBar.classList.remove('w-full');
        progressBar.classList.add('w-1/3');
        progressBar.classList.remove('bg-success');
        progressBar.classList.add('bg-primary');
        progressText.textContent = '0 of 1 selections complete';
    };

});
