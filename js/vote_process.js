// Vote Process JavaScript
document.addEventListener('DOMContentLoaded', function () {
    // Load data from sessionStorage
    const electionId = sessionStorage.getItem('electionId');
    const electionData = JSON.parse(sessionStorage.getItem('electionData') || '{}');
    const selectedVotes = JSON.parse(sessionStorage.getItem('selectedVotes') || '{}');

    // Redirect if no data
    if (!electionId || !electionData.title) {
        alert('No election data found. Please start from the beginning.');
        window.location.href = 'active_elections.html';
        return;
    }

    // Get all DOM elements FIRST before any functions
    const canvas = document.getElementById('captchaCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const captchaInput = document.getElementById('captchaInput');
    const confirmAccuracy = document.getElementById('confirmAccuracy');
    const confirmLegal = document.getElementById('confirmLegal');
    const submitButton = document.getElementById('submitFinalVote');

    // CAPTCHA variables
    let captchaCode = '';
    let isCaptchaVerified = false;

    // Check if all required elements exist
    if (!canvas || !captchaInput || !confirmAccuracy || !confirmLegal || !submitButton) {
        console.error('Required elements not found');
        return;
    }

    // Modal helpers
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    // Check form validity
    function checkFormValidity() {
        const isValid = confirmAccuracy.checked && confirmLegal.checked && isCaptchaVerified;

        if (isValid) {
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            submitButton.disabled = true;
            submitButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    // Generate CAPTCHA
    function generateCaptcha() {
        isCaptchaVerified = false;
        captchaInput.value = '';
        document.getElementById('captchaError').classList.add('hidden');
        document.getElementById('captchaSuccess').classList.add('hidden');

        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        captchaCode = '';
        for (let i = 0; i < 6; i++) {
            captchaCode += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#1e293b');
        gradient.addColorStop(1, '#0f172a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = `rgba(99, 102, 241, ${Math.random() * 0.3})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = `rgba(148, 163, 184, ${Math.random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                Math.random() * 2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.font = 'bold 36px Arial';
        ctx.textBaseline = 'middle';

        const charSpacing = canvas.width / (captchaCode.length + 1);

        for (let i = 0; i < captchaCode.length; i++) {
            const char = captchaCode[i];
            const x = charSpacing * (i + 1);
            const y = canvas.height / 2;
            const angle = (Math.random() - 0.5) * 0.4;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            const textGradient = ctx.createLinearGradient(0, -20, 0, 20);
            textGradient.addColorStop(0, '#818cf8');
            textGradient.addColorStop(0.5, '#6366f1');
            textGradient.addColorStop(1, '#4f46e5');
            ctx.fillStyle = textGradient;

            ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.fillText(char, 0, 0);
            ctx.restore();
        }

        checkFormValidity();
    }

    // Verify CAPTCHA
    function verifyCaptcha() {
        const userInput = captchaInput.value.toUpperCase();

        if (userInput === captchaCode) {
            isCaptchaVerified = true;
            document.getElementById('captchaError').classList.add('hidden');
            document.getElementById('captchaSuccess').classList.remove('hidden');
            captchaInput.classList.remove('border-red-500');
            captchaInput.classList.add('border-emerald-500');
        } else {
            isCaptchaVerified = false;
            document.getElementById('captchaSuccess').classList.add('hidden');
            document.getElementById('captchaError').classList.remove('hidden');
            captchaInput.classList.remove('border-emerald-500');
            captchaInput.classList.add('border-red-500');
        }

        checkFormValidity();
    }

    // Submit vote to backend
    async function submitVote() {
        showModal('submittingModal');

        let progress = 30;
        const progressBar = document.getElementById('submittingProgress');

        const interval = setInterval(() => {
            progress += 10;
            progressBar.style.width = progress + '%';
        }, 300);

        try {
            const voteData = {
                electionId: electionId,
                votes: Object.entries(selectedVotes).map(([position, candidateId]) => ({
                    position,
                    candidateId
                })),
                captchaVerified: isCaptchaVerified,
                timestamp: new Date().toISOString()
            };

            const response = await fetch('/api/votes/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(voteData)
            });

            const result = await response.json();

            clearInterval(interval);
            progressBar.style.width = '100%';

            setTimeout(() => {
                hideModal('submittingModal');

                if (result.success) {
                    showSuccessModal(result.receipt || {});
                    sessionStorage.removeItem('electionId');
                    sessionStorage.removeItem('electionData');
                    sessionStorage.removeItem('selectedVotes');
                } else {
                    alert('Error submitting vote: ' + (result.message || 'Unknown error'));
                    generateCaptcha();
                }
            }, 500);

        } catch (error) {
            clearInterval(interval);
            console.error('Error submitting vote:', error);
            hideModal('submittingModal');
            alert('Failed to submit vote. Please try again.');
            generateCaptcha();
        }
    }

    function showSuccessModal(receipt) {
        const now = new Date();
        const txId = receipt.transactionId || 'TX-2025-BC' + Math.floor(Math.random() * 1000000);
        const verCode = receipt.verificationCode || 'VER-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        document.getElementById('receiptTxId').textContent = txId;
        document.getElementById('receiptTimestamp').textContent = now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        document.getElementById('receiptCode').textContent = verCode;

        showModal('successModal');
    }

    // Display election info
    function displayElectionInfo() {
        const electionTitle = document.getElementById('electionTitle');
        const ballotId = document.getElementById('ballotId');
        const summaryElection = document.getElementById('summaryElection');
        const summaryVoterId = document.getElementById('summaryVoterId');
        const summaryDistrict = document.getElementById('summaryDistrict');
        const summaryBallotType = document.getElementById('summaryBallotType');

        if (electionTitle) electionTitle.textContent = electionData.title;
        if (ballotId) ballotId.textContent = `Ballot ID: #BC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000)}`;
        if (summaryElection) summaryElection.textContent = electionData.title;
        if (summaryVoterId) summaryVoterId.textContent = `VC-${new Date().getFullYear()}-${localStorage.getItem('userId') || 'GUEST'}-${Math.floor(Math.random() * 10000)}`;
        if (summaryDistrict) summaryDistrict.textContent = electionData.district || 'District 3 - Downtown';
        if (summaryBallotType) summaryBallotType.textContent = 'Standard Ballot';
    }

    // Display vote selections
    function displayVoteSelections() {
        const container = document.getElementById('voteSelections');
        if (!container) return;

        container.innerHTML = '';
        const candidates = electionData.Candidates || [];

        Object.entries(selectedVotes).forEach(([position, candidateId]) => {
            const candidate = candidates.find(c => c.id == candidateId);

            if (candidate) {
                container.innerHTML += `
                    <div class="bg-slate-900/50 rounded-lg p-4 border border-white/5">
                        <div class="flex justify-between items-start mb-3">
                            <h4 class="text-white font-semibold">${position}</h4>
                            <button class="text-indigo-400 hover:text-indigo-300 text-sm flex items-center transition-colors edit-vote-btn" data-election-id="${electionId}">
                                <i class='bx bx-edit-alt mr-1'></i>
                                Edit
                            </button>
                        </div>
                        <div class="flex items-center space-x-3">
                            <img src="${candidate.image_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'}" 
                                 alt="${candidate.name}" 
                                 class="w-12 h-12 rounded-full object-cover border-2 border-indigo-500"
                                 onerror="this.src='https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'">
                            <div class="flex-1">
                                <p class="text-white font-medium">${candidate.name}</p>
                                <p class="text-sm text-slate-400">${candidate.party || 'Independent'}</p>
                            </div>
                            <i class='bx bx-check-circle text-emerald-400 text-2xl'></i>
                        </div>
                    </div>
                `;
            }
        });

        document.querySelectorAll('.edit-vote-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const electionId = this.dataset.electionId;
                window.location.href = 'voting_interface.html?election=' + electionId;
            });
        });
    }

    // Event Listeners
    document.getElementById('refreshCaptcha').addEventListener('click', function () {
        generateCaptcha();
        this.classList.add('animate-spin');
        setTimeout(() => {
            this.classList.remove('animate-spin');
        }, 500);
    });

    captchaInput.addEventListener('input', function () {
        this.value = this.value.toUpperCase();

        if (this.value.length === 6) {
            verifyCaptcha();
        } else {
            isCaptchaVerified = false;
            document.getElementById('captchaError').classList.add('hidden');
            document.getElementById('captchaSuccess').classList.add('hidden');
            checkFormValidity();
        }
    });

    confirmAccuracy.addEventListener('change', checkFormValidity);
    confirmLegal.addEventListener('change', checkFormValidity);

    submitButton.addEventListener('click', function (e) {
        if (!submitButton.disabled) {
            showModal('confirmationModal');
        }
    });

    document.getElementById('cancelSubmit').addEventListener('click', function () {
        hideModal('confirmationModal');
    });

    document.getElementById('confirmSubmit').addEventListener('click', function () {
        hideModal('confirmationModal');
        submitVote();
    });

    document.getElementById('downloadReceipt').addEventListener('click', function () {
        const receiptData = {
            transactionId: document.getElementById('receiptTxId').textContent,
            timestamp: document.getElementById('receiptTimestamp').textContent,
            verificationCode: document.getElementById('receiptCode').textContent,
            election: document.getElementById('summaryElection').textContent,
            voterId: document.getElementById('summaryVoterId').textContent
        };

        const receiptText = `
VOTESECURE ONLINE - VOTE RECEIPT
================================

Transaction ID: ${receiptData.transactionId}
Timestamp: ${receiptData.timestamp}
Verification Code: ${receiptData.verificationCode}

Election: ${receiptData.election}
Voter ID: ${receiptData.voterId}

Your vote has been securely recorded and encrypted.
Keep this receipt for your records.

================================
        `;

        const blob = new Blob([receiptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vote_receipt_${receiptData.transactionId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('returnToDashboard').addEventListener('click', function () {
        window.location.href = 'voter_dashboard.html';
    });

    document.getElementById('backToVoting').addEventListener('click', function () {
        if (confirm('Are you sure you want to go back? Your current progress will be saved.')) {
            window.location.href = 'active_elections.html';
        }
    });

    // Session timer
    let timeLeft = 14 * 60 + 19;

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

    // Set current timestamp
    const now = new Date();
    const submissionTime = document.getElementById('submissionTime');
    if (submissionTime) {
        submissionTime.textContent = now.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    // Display election information and vote selections
    displayElectionInfo();
    displayVoteSelections();

    // Initialize CAPTCHA
    generateCaptcha();
});
