
document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    const ballotSummaryContainer = document.querySelector('.space-y-6'); // Container for selections
    const submitVoteBtn = document.getElementById('submitVoteBtn');
    const accuracyConfirm = document.getElementById('accuracyConfirm');
    const submissionConfirm = document.getElementById('submissionConfirm');
    const signatureSection = document.getElementById('signatureSection');
    const signaturePad = document.getElementById('signaturePad');
    const signatureConfirmed = document.getElementById('signatureConfirmed');

    // Modals
    const confirmationModal = document.getElementById('confirmationModal');
    const loadingModal = document.getElementById('loadingModal');
    const successModal = document.getElementById('successModal');
    const loadingMessage = document.getElementById('loadingMessage');
    const progressBar = document.getElementById('progressBar');

    // Load Pending Vote
    const pendingVote = JSON.parse(sessionStorage.getItem('pendingVote'));
    if (!pendingVote) {
        alert('No pending vote found. Redirecting to elections.');
        window.location.href = 'active_elections.html';
        return;
    }

    // Render Ballot Summary
    renderBallotSummary(pendingVote);

    // Form Validation
    function validateConfirmations() {
        // Require checkboxes and signature (simulated)
        const isSigned = !signatureConfirmed.classList.contains('hidden');
        const isValid = accuracyConfirm.checked && submissionConfirm.checked && isSigned;

        submitVoteBtn.disabled = !isValid;
        if (isValid) {
            submitVoteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            submitVoteBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    accuracyConfirm.addEventListener('change', validateConfirmations);
    submissionConfirm.addEventListener('change', validateConfirmations);

    // Digital Signature Logic (Visual Only)
    window.signDigitally = function () {
        signaturePad.innerHTML = `
            <div class="bg-success-50 border-2 border-success-200 rounded-lg p-6">
                <div class="flex items-center justify-center">
                    <svg class="h-8 w-8 text-success mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span class="text-success-700 font-medium">Signature captured</span>
                </div>
                <p class="text-sm text-success-600 mt-2">${getUser().name || 'Voter'} - Digital Signature</p>
            </div>
        `;
        signatureConfirmed.classList.remove('hidden');
        validateConfirmations();
    };

    window.clearSignature = function () {
        signaturePad.innerHTML = `
            <svg class="mx-auto h-12 w-12 text-secondary-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
            <p class="text-secondary-600 mb-4">Click and drag to sign, or tap to sign on mobile</p>
            <div class="flex justify-center space-x-4">
                <button onclick="clearSignature()" class="btn-secondary text-sm">Clear</button>
                <button onclick="signDigitally()" class="btn-primary text-sm">Sign Digitally</button>
            </div>
        `;
        signatureConfirmed.classList.add('hidden');
        validateConfirmations();
    };


    // Render Helper
    function renderBallotSummary(vote) {
        // Clear existing static items (Mayor, Council, Prop)
        ballotSummaryContainer.innerHTML = '';

        const item = document.createElement('div');
        item.className = 'border border-gray-200 rounded-lg p-4';
        item.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h4 class="font-semibold text-text-primary">${vote.electionTitle}</h4>
                 <!-- Edit button could invoke navigation back -->
                <button onclick="window.history.back()" class="text-primary hover:text-primary-700 text-sm font-medium flex items-center">
                    <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Edit
                </button>
            </div>
            <div class="flex items-center">
                <img src="${vote.candidateImage}" alt="${vote.candidateName}" class="h-12 w-12 rounded-full object-cover mr-4" onerror="this.src='https://via.placeholder.com/150';">
                <div>
                    <p class="font-medium text-text-primary">${vote.candidateName}</p>
                    <p class="text-sm text-secondary-600">${vote.candidateParty}</p>
                </div>
                <div class="ml-auto">
                    <svg class="h-5 w-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                </div>
            </div>
        `;
        ballotSummaryContainer.appendChild(item);
    }

    // Modal & Submission Logic
    window.submitFinalVote = function () {
        confirmationModal.classList.remove('hidden');
        confirmationModal.classList.add('flex');
    };

    window.cancelSubmission = function () {
        confirmationModal.classList.add('hidden');
        confirmationModal.classList.remove('flex');
    };

    window.confirmSubmission = async function () {
        confirmationModal.classList.add('hidden');
        confirmationModal.classList.remove('flex');

        loadingModal.classList.remove('hidden');
        loadingModal.classList.add('flex');

        try {
            updateLoadingProgress('Encrypting ballot...', 25);

            // Generate receipt hash (Client-side simulation of a secure hash)
            // In a real system, this might be more complex or come from backend pre-flight
            const user = getUser();
            const timestamp = new Date().toISOString();
            const dataString = `${user.id}-${pendingVote.electionId}-${pendingVote.candidateId}-${timestamp}`;
            const receiptHash = btoa(dataString).substring(0, 16); // Simple hash for demo

            updateLoadingProgress('Transmitting securely...', 50);

            // Note: We don't need to send receipt_hash, the server generates it. 
            // We just send election_id and candidate_id.
            const response = await fetchWithAuth(`/elections/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    election_id: pendingVote.electionId,
                    candidate_id: pendingVote.candidateId
                })
            });

            const data = await response.json();

            updateLoadingProgress('Verifying receipt...', 90);

            if (data.success) {
                setTimeout(() => {
                    // Use the server-provided receipt hash
                    showSuccess(data.receipt_hash, timestamp);
                }, 500);
            } else {
                throw new Error(data.message || 'Vote submission failed');
            }

        } catch (error) {
            console.error(error);
            alert('Error submitting vote: ' + error.message);
            loadingModal.classList.add('hidden');
            loadingModal.classList.remove('flex');
        }
    };

    function updateLoadingProgress(msg, percent) {
        loadingMessage.textContent = msg;
        progressBar.style.width = `${percent}%`;
    }

    function showSuccess(receiptHash, timestamp) {
        loadingModal.classList.add('hidden');
        loadingModal.classList.remove('flex');

        // Populate Receipt Data
        // Ideally we grab standard elements or add IDs in the HTML refactor
        // For now, I'll update the static placeholders in the success Modal if they have IDs or classes I can target easily
        // But since I'm refactoring the HTML anyway, I will add IDs there.

        const receiptContainer = document.querySelector('#successModal .bg-secondary-50');
        if (receiptContainer) {
            receiptContainer.innerHTML = `
                <h4 class="font-semibold text-text-primary mb-3">Vote Receipt</h4>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-text-secondary">Transaction ID:</span>
                        <span class="font-mono text-text-primary text-xs">${receiptHash}</span>
                    </div>
                     <div class="flex justify-between">
                        <span class="text-text-secondary">Election:</span>
                        <span class="text-text-primary text-right">${pendingVote.electionTitle}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-text-secondary">Timestamp:</span>
                        <span class="text-text-primary text-right">${new Date(timestamp).toLocaleString()}</span>
                    </div>
                     <div class="flex justify-between">
                        <span class="text-text-secondary">Status:</span>
                        <span class="font-medium text-success">Confirmed</span>
                    </div>
                </div>
            `;
        }

        successModal.classList.remove('hidden');
        successModal.classList.add('flex');

        // Clear session storage
        sessionStorage.removeItem('pendingVote');
    }

    window.returnToDashboard = function () {
        window.location.href = 'voter_dashboard.html';
    };

    window.downloadReceipt = function () {
        alert("Receipt download started (Simulated)");
    };

    window.goBack = function () {
        window.history.back();
    };

});
