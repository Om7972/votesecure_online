// Dashboard functionality
document.addEventListener('DOMContentLoaded', async function () {
    // Check Auth
    const user = getUser();
    if (!user) {
        console.warn('No user found in localStorage. Redirecting to login.');
        window.location.href = 'secure_login.html';
        return;
    }

    // Update UI with user info
    const headerUserSpan = document.querySelector('#userMenuBtn span');
    if (headerUserSpan) headerUserSpan.textContent = user.name || 'Voter';

    // The dropdown info
    const dropdownName = document.querySelector('#userDropdown p.font-medium');
    const dropdownEmail = document.querySelector('#userDropdown p.text-xs');
    if (dropdownName) dropdownName.textContent = user.name || 'Voter';
    if (dropdownEmail) dropdownEmail.textContent = user.email || '';

    // The welcome message
    const welcomeMsg = document.querySelector('h1.text-3xl');
    if (welcomeMsg) welcomeMsg.textContent = `Welcome back, ${user.name ? user.name.split(' ')[0] : 'Voter'}!`;

    // Logout Handler
    const logoutLinks = document.querySelectorAll('a[href="secure_login.html"]');
    logoutLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            logout();
        });
    });

    // Fetch Active Elections
    const activeElectionsContainer = document.getElementById('activeElections');
    const skeletonCards = document.querySelector('.skeleton-cards');

    try {
        if (skeletonCards) skeletonCards.classList.remove('hidden');

        const response = await fetchWithAuth('/elections?status=active');

        if (response.ok) {
            const data = await response.json();
            if (skeletonCards) skeletonCards.classList.add('hidden');

            if (data.success && data.elections && data.elections.length > 0) {
                // ... (render logic) ...
                // Clear static cards (except skeleton)
                Array.from(activeElectionsContainer.children).forEach(child => {
                    if (!child.classList.contains('skeleton-cards')) child.remove();
                });

                data.elections.forEach(election => {
                    // ... (render card) ...
                    const card = document.createElement('div');
                    // ... (rendering code kept same as much as possible or simplified for this replace) ...
                    // To avoid huge replacement block, I will focus on the error handling part mostly.
                    // But I must replace the whole block I requested.
                    // I'll copy the rendering logic from the view_file output.

                    card.className = 'card-interactive border-l-4 border-l-primary';
                    const endDate = new Date(election.end_time || election.endDate);
                    const now = new Date();
                    const diffMs = endDate - now;
                    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));

                    card.innerHTML = `
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div class="flex-1 mb-4 sm:mb-0">
                                <div class="flex items-center mb-2">
                                    <h3 class="text-lg font-semibold text-text-primary mr-3">${election.title}</h3>
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">Active</span>
                                </div>
                                <p class="text-text-secondary text-sm mb-3">${election.description || 'No description available.'}</p>
                                <div class="flex items-center text-sm text-text-secondary space-x-4">
                                    <div class="flex items-center">
                                        <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        Ends in ${daysLeft} days
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col sm:items-end">
                                <div class="text-right mb-3">
                                    <div class="text-2xl font-bold text-primary">${Math.max(0, hoursLeft)}h</div>
                                    <div class="text-xs text-text-secondary">Remaining</div>
                                </div>
                                <a href="voting_interface.html?id=${election.id}" class="btn-primary w-full sm:w-auto">Vote Now</a>
                            </div>
                        </div>`;
                    activeElectionsContainer.appendChild(card);
                });
            } else {
                const msg = document.createElement('p');
                msg.className = 'text-center text-text-secondary py-4';
                msg.innerText = 'No active elections found.';
                Array.from(activeElectionsContainer.children).forEach(child => {
                    if (!child.classList.contains('skeleton-cards')) child.remove();
                });
                activeElectionsContainer.appendChild(msg);
            }
        } else if (response.status === 401) {
            if (skeletonCards) skeletonCards.classList.add('hidden');
            // Show Session Expired and Redirect Option
            activeElectionsContainer.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <div class="text-warning mb-4">
                        <svg class="h-12 w-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        <h3 class="text-lg font-bold">Session Expired</h3>
                        <p class="text-sm">Please log in again to continue.</p>
                    </div>
                    <a href="secure_login.html" class="btn-primary inline-block">Log In</a>
                </div>
            `;
            // Clear local storage to force fresh login on click
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        } else {
            if (skeletonCards) skeletonCards.classList.add('hidden');
            const errorMsg = document.createElement('div');
            errorMsg.className = 'col-span-full text-center py-8';
            errorMsg.innerHTML = `
                <div class="text-error mb-2">
                    <svg class="h-8 w-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <p class="font-medium">Failed to load active elections</p>
                </div>
                <p class="text-sm text-text-secondary">Server connection error (Status: ${response.status}).</p>
            `;
            Array.from(activeElectionsContainer.children).forEach(child => {
                if (!child.classList.contains('skeleton-cards')) child.remove();
            });
            activeElectionsContainer.appendChild(errorMsg);
        }
    } catch (e) {
        console.error('Failed to fetch elections', e);
        if (skeletonCards) skeletonCards.classList.add('hidden');
        // Show error in UI
        const errorMsg = document.createElement('div');
        errorMsg.className = 'col-span-full text-center py-8 text-red-500';
        errorMsg.textContent = 'Application Error: ' + e.message;
        activeElectionsContainer.appendChild(errorMsg);
    }

    // Fetch Upcoming Elections
    const upcomingElectionsContainer = document.getElementById('upcomingElections');
    if (upcomingElectionsContainer) {
        try {
            const response = await fetchWithAuth('/elections?status=upcoming');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.elections && data.elections.length > 0) {
                    upcomingElectionsContainer.innerHTML = ''; // Clear static
                    data.elections.forEach(election => {
                        const card = document.createElement('div');
                        card.className = 'card';
                        const startDate = new Date(election.startDate).toLocaleDateString();
                        card.innerHTML = `
                            <div class="flex items-center justify-between">
                                <div class="flex-1">
                                    <h3 class="text-lg font-medium text-text-primary mb-1">${election.title}</h3>
                                    <p class="text-text-secondary text-sm mb-2">${election.description || 'No description'}</p>
                                    <div class="flex items-center text-sm text-text-secondary">
                                        <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a4 4 0 118 0v4m-4 8a4 4 0 11-8 0v-1a4 4 0 014-4h4a4 4 0 014 4v1a4 4 0 11-8 0z" />
                                        </svg>
                                        Opens ${startDate}
                                    </div>
                                </div>
                                <button class="btn-secondary">
                                    Learn More
                                </button>
                            </div>
                         `;
                        upcomingElectionsContainer.appendChild(card);
                    });
                } else {
                    upcomingElectionsContainer.innerHTML = '<p class="text-center text-text-secondary">No upcoming elections.</p>';
                }
            } else {
                upcomingElectionsContainer.innerHTML = '<p class="text-center text-error text-sm">Unable to load upcoming elections.</p>';
            }
        } catch (e) {
            console.error('Failed to fetch upcoming elections', e);
        }
    }

    // Fetch Voting History
    const votingHistoryContainer = document.getElementById('votingHistory');
    if (votingHistoryContainer) {
        try {
            const response = await fetchWithAuth('/votes/history');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.votes && data.votes.length > 0) {
                    votingHistoryContainer.innerHTML = ''; // Clear static
                    data.votes.forEach(vote => {
                        const voteDate = new Date(vote.castedAt).toLocaleDateString();
                        const item = document.createElement('div');
                        item.className = 'flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0';
                        item.innerHTML = `
                            <div class="flex items-center">
                                <div class="h-8 w-8 bg-success-100 rounded-full flex items-center justify-center mr-3">
                                    <svg class="h-4 w-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-text-primary">${vote.electionTitle}</p>
                                    <p class="text-xs text-text-secondary">Voted on ${voteDate}</p>
                                </div>
                            </div>
                            <span class="text-xs text-show font-medium text-success">Completed</span>
                        `;
                        votingHistoryContainer.appendChild(item);
                    });
                } else {
                    votingHistoryContainer.innerHTML = '<p class="text-center text-text-secondary py-4">No voting history found.</p>';
                }
            } else {
                votingHistoryContainer.innerHTML = '<p class="text-center text-error py-4">Unable to load voting history.</p>';
            }
        } catch (e) {
            console.error('Failed to fetch voting history', e);
        }
    }


    // User menu toggle
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', function () {
            userDropdown.classList.add('hidden');
        });
    }

    // Notification logic (Simplified)
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationModal = document.getElementById('notificationModal');
    const closeNotificationModal = document.getElementById('closeNotificationModal');

    if (notificationBtn && notificationModal) {
        notificationBtn.addEventListener('click', function () {
            notificationModal.classList.remove('hidden');
            notificationModal.classList.add('flex');
        });
    }

    if (closeNotificationModal) {
        closeNotificationModal.addEventListener('click', function () {
            notificationModal.classList.add('hidden');
            notificationModal.classList.remove('flex');
        });
    }

    if (notificationModal) {
        notificationModal.addEventListener('click', function (e) {
            if (e.target === notificationModal) {
                notificationModal.classList.add('hidden');
                notificationModal.classList.remove('flex');
            }
        });
    }

    // Keyboard navigation support
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (userDropdown) userDropdown.classList.add('hidden');
            if (notificationModal) {
                notificationModal.classList.add('hidden');
                notificationModal.classList.remove('flex');
            }
        }
    });

});
