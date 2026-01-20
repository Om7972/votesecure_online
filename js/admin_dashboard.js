// Admin Dashboard functionality
document.addEventListener('DOMContentLoaded', async function () {
    // Check Auth & Role
    const user = getUser();
    if (!user || user.role !== 'admin') {
        window.location.href = 'secure_login.html'; // Redirect if not admin
        return;
    }

    // Update Admin Profile in UI
    const adminNameElements = document.querySelectorAll('.text-text-primary'); // Adjust selector as needed
    // Targeted updates
    const headerAdminName = document.querySelector('#adminMenuBtn span');
    if (headerAdminName) headerAdminName.textContent = user.name || 'Admin User';

    const dropdownAdminName = document.querySelector('#adminDropdown p.text-sm');
    if (dropdownAdminName) dropdownAdminName.textContent = user.name || 'Admin User';
    const dropdownAdminRole = document.querySelector('#adminDropdown p.text-xs');
    if (dropdownAdminRole) dropdownAdminRole.textContent = user.role.toUpperCase();

    // Initialize charts
    initializeAdminCharts();

    // Admin menu toggle
    const adminMenuBtn = document.getElementById('adminMenuBtn');
    const adminDropdown = document.getElementById('adminDropdown');

    if (adminMenuBtn && adminDropdown) {
        adminMenuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            adminDropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function () {
            adminDropdown.classList.add('hidden');
        });
    }

    // Create Election Modal
    const createElectionBtn = document.getElementById('createElectionBtn');
    const createElectionModal = document.getElementById('createElectionModal');
    const closeCreateElectionModal = document.getElementById('closeCreateElectionModal');
    const cancelCreateElection = document.getElementById('cancelCreateElection');

    if (createElectionBtn && createElectionModal) {
        createElectionBtn.addEventListener('click', function () {
            createElectionModal.classList.remove('hidden');
            createElectionModal.classList.add('flex');
        });
    }

    [closeCreateElectionModal, cancelCreateElection].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function () {
                createElectionModal.classList.add('hidden');
                createElectionModal.classList.remove('flex');
            });
        }
    });

    // User Management Modal
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    const userManagementModal = document.getElementById('userManagementModal');
    const closeUserManagementModal = document.getElementById('closeUserManagementModal');

    if (manageUsersBtn && userManagementModal) {
        manageUsersBtn.addEventListener('click', function () {
            userManagementModal.classList.remove('hidden');
            userManagementModal.classList.add('flex');
            fetchUsers();
        });
    }

    if (closeUserManagementModal) {
        closeUserManagementModal.addEventListener('click', function () {
            userManagementModal.classList.add('hidden');
            userManagementModal.classList.remove('flex');
        });
    }

    // User Search Logic
    const userSearchInput = document.getElementById('userSearchInput');
    let searchTimeout;
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function (e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                fetchUsers(e.target.value);
            }, 300); // 300ms debounce
        });
    }

    // Form submission (Create Election)
    const createElectionForm = document.getElementById('createElectionForm');
    if (createElectionForm) {
        createElectionForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(createElectionForm);
            // Construct JSON object (Need to map inputs manually since FormData might not work directly with JSON.stringify without conversion)
            const electionData = {
                title: createElectionForm.querySelector('input[placeholder="Enter election title"]').value,
                type: createElectionForm.querySelector('select:nth-of-type(1)').value, // Fragile selector, better to add IDs/Names
                startDate: createElectionForm.querySelector('input[type="datetime-local"]:nth-of-type(1)').value,
                endDate: createElectionForm.querySelector('input[type="datetime-local"]:nth-of-type(2)').value,
                description: createElectionForm.querySelector('textarea').value,
                allowedVoters: createElectionForm.querySelector('select:nth-of-type(2)').value
            };

            try {
                const response = await fetchWithAuth('/elections', {
                    method: 'POST',
                    body: JSON.stringify(electionData)
                });

                const data = await response.json();
                if (data.success) {
                    alert('Election created successfully!');
                    createElectionModal.classList.add('hidden');
                    createElectionModal.classList.remove('flex');
                    createElectionForm.reset();
                    // Refresh data
                    updateDashboardData();
                } else {
                    alert(data.message || 'Failed to create election');
                }
            } catch (err) {
                console.error('Error creating election:', err);
                alert('Server error occurred');
            }
        });
    }

    // Security alert handlers
    const securityBtns = ['securityAlert1', 'securityAlert2', 'reviewPendingBtn', 'viewAllLogsBtn', 'advancedConfigBtn'];
    securityBtns.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                alert('This feature would open detailed information in a production system.');
            });
        }
    });

    // Initial Data Load
    updateDashboardData();

    // Real-time data updates
    setInterval(updateDashboardData, 30000); // Poll every 30s instead of 5s to save load

    // Close modals when clicking outside
    [createElectionModal, userManagementModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        }
    });

    // Logout
    const logoutLinks = document.querySelectorAll('a[href="secure_login.html"]');
    logoutLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            logout();
        });
    });
});

async function fetchUsers(searchQuery = '') {
    const tbody = document.querySelector('#userManagementModal tbody');
    if (!tbody) return;

    // Show loading state or clear current
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">Loading users...</td></tr>';

    try {
        const url = searchQuery ? `/admin/users?search=${encodeURIComponent(searchQuery)}` : '/admin/users';
        const response = await fetchWithAuth(url);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.users) {
                tbody.innerHTML = '';
                if (data.users.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No users found.</td></tr>';
                    return;
                }

                data.users.forEach(user => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex items-center">
                                <div class="flex-shrink-0 h-8 w-8">
                                    <div class="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary font-bold">
                                        ${user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                </div>
                                <div class="ml-4">
                                    <div class="text-sm font-medium text-gray-900">${user.name || 'Unknown'}</div>
                                    <div class="text-sm text-gray-500">${user.email || 'No email'}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}">
                                ${user.role || 'voter'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                                ${user.status || 'Active'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button class="text-primary hover:text-primary-700 mr-3" onclick="editUser('${user.id}')">Edit</button>
                            <button class="text-error hover:text-error-700" onclick="toggleUserStatus('${user.id}', '${user.status}')">
                                ${user.status === 'suspended' ? 'Activate' : 'Suspend'}
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">Failed to load users.</td></tr>';
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">Error fetching data.</td></tr>';
        }
    } catch (e) {
        console.error('Error fetching users:', e);
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-text-secondary">An error occurred.</td></tr>';
    }
}

// Placeholder for edit/toggle
async function editUser(id) {
    const newName = prompt('Enter new value for User Name:', 'New Name');
    if (newName) {
        try {
            const response = await fetchWithAuth(`/admin/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: newName })
            });
            if (response.ok) {
                alert('User updated successfully');
                fetchUsers(); // Refresh list
            } else {
                alert('Failed to update user');
            }
        } catch (e) {
            console.error('Error updating user', e);
            alert('Error updating user');
        }
    }
}

async function toggleUserStatus(id, currentStatus) {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    if (!confirm(`Are you sure you want to change user status from ${currentStatus} to ${newStatus}?`)) {
        return;
    }

    try {
        const response = await fetchWithAuth(`/admin/users/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            // Refresh the list to show new status
            fetchUsers(document.getElementById('userSearchInput')?.value || '');
        } else {
            const data = await response.json();
            alert(data.message || 'Failed to update user status');
        }
    } catch (e) {
        console.error('Error changing user status:', e);
        alert('An error occurred while communicating with the server.');
    }
}

async function updateDashboardData() {
    try {
        // Fetch Admin Stats
        const response = await fetchWithAuth('/admin/stats');
        // If 404, we just skip updating UI (dev mode fallback)
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Update specific elements if IDs existed
                // IDs: activeUsers, votesPerMinute (from original mock)
                if (data.stats) {
                    const activeUsers = document.getElementById('activeUsers');
                    if (activeUsers) activeUsers.textContent = data.stats.activeUsers || 0;

                    // We can also update the "Registered Users" card if we add an ID to it
                    // TODO: Add IDs to dashboard cards for easier updating
                }
            }
        }
    } catch (e) {
        console.error('Failed to fetch admin stats', e);
    }
}


// Initialize admin dashboard charts (Mock data for now, could be dynamic later)
function initializeAdminCharts() {
    // Usage Chart
    const usageCtx = document.getElementById('usageChart');
    if (usageCtx) {
        new Chart(usageCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Active Users',
                    data: [1200, 1450, 1380, 1650], // Mock
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Votes Cast',
                    data: [800, 1200, 950, 1400], // Mock
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Distribution Chart
    const distributionCtx = document.getElementById('distributionChart');
    if (distributionCtx) {
        new Chart(distributionCtx, {
            type: 'bar',
            data: {
                labels: ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM'],
                datasets: [{
                    label: 'Votes per Hour',
                    data: [120, 180, 350, 280, 420, 380, 290], // Mock
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: '#10b981',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modals = [
            document.getElementById('createElectionModal'),
            document.getElementById('userManagementModal')
        ];

        modals.forEach(modal => {
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    }

    // Ctrl/Cmd + N for new election
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const createElectionModal = document.getElementById('createElectionModal');
        if (createElectionModal) {
            createElectionModal.classList.remove('hidden');
            createElectionModal.classList.add('flex');
        }
    }
});
