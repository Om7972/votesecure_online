document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'secure_login.html';
        return;
    }

    // Initialize UI
    await loadUserProfile();
    setupTabNavigation();
    setupEventListeners();

    // Load User Profile Data
    async function loadUserProfile() {
        try {
            const user = await getUser(); // From utils.js
            if (!user) {
                logout(); // From utils.js
                return;
            }

            // Populate Header User Info
            const userMenuBtn = document.getElementById('userMenuBtn');
            if (userMenuBtn) {
                userMenuBtn.querySelector('span').textContent = user.name;
            }
            const dropdownName = document.querySelector('#userDropdown p.font-medium');
            const dropdownEmail = document.querySelector('#userDropdown p.text-xs');
            if (dropdownName) dropdownName.textContent = user.name;
            if (dropdownEmail) dropdownEmail.textContent = user.email;

            // Populate Form Fields
            document.getElementById('name').value = user.name || '';
            document.getElementById('email').value = user.email || '';
            document.getElementById('role').value = user.role || '';
            document.getElementById('phone').value = user.phone || '';

            // Handle Photo (If we had a real URL in DB, we'd use it)
            // if (user.profile_image) {
            //    document.getElementById('profilePhoto').src = user.profile_image;
            //    document.querySelector('#userMenuBtn img').src = user.profile_image;
            // }

        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Failed to load user profile.');
        }
    }

    // Setup Tab Navigation
    function setupTabNavigation() {
        const tabs = ['personal', 'security', 'preferences'];
        const tabButtons = {
            personal: document.getElementById('personalTab'),
            security: document.getElementById('securityTab'),
            preferences: document.getElementById('preferencesTab')
        };
        const tabContents = {
            personal: document.getElementById('personalTabContent'),
            security: document.getElementById('securityTabContent'),
            preferences: document.getElementById('preferencesTabContent')
        };

        function switchTab(activeTab) {
            tabs.forEach(tab => {
                const button = tabButtons[tab];
                const content = tabContents[tab];

                if (tab === activeTab) {
                    button.classList.remove('border-transparent', 'text-text-secondary');
                    button.classList.add('border-primary', 'text-primary');
                    content.classList.remove('hidden');
                } else {
                    button.classList.add('border-transparent', 'text-text-secondary');
                    button.classList.remove('border-primary', 'text-primary');
                    content.classList.add('hidden');
                }
            });
        }

        Object.keys(tabButtons).forEach(key => {
            if (tabButtons[key]) {
                tabButtons[key].addEventListener('click', () => switchTab(key));
            }
        });
    }

    // Setup Event Listeners
    function setupEventListeners() {
        // Profile Update Form
        const personalInfoForm = document.getElementById('personalInfoForm');
        if (personalInfoForm) {
            personalInfoForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const submitBtn = this.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';

                try {
                    const formData = new FormData();
                    formData.append('name', document.getElementById('name').value);
                    formData.append('phone', document.getElementById('phone').value);

                    const photoInput = document.getElementById('photoInput');
                    if (photoInput.files[0]) {
                        formData.append('profile_image', photoInput.files[0]);
                    }

                    // We need to bypass the default JSON headers in fetchWithAuth for FormData
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_URL}/users/profile`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`
                            // Content-Type must be undefined so browser sets it with boundary
                        },
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        alert('Profile updated successfully!');

                        // Update local storage
                        const user = JSON.parse(localStorage.getItem('user'));
                        user.name = document.getElementById('name').value;
                        if (data.profile_image) {
                            user.profile_image = data.profile_image;
                            // Update UI immediately
                            document.getElementById('profilePhoto').src = data.profile_image;
                            const headerImg = document.querySelector('#userMenuBtn img');
                            if (headerImg) headerImg.src = data.profile_image;
                        }
                        localStorage.setItem('user', JSON.stringify(user));

                        // loadUserProfile(); // Optional, already updated UI above
                    } else {
                        const data = await response.json();
                        alert(data.message || 'Failed to update profile');
                    }
                } catch (error) {
                    console.error(error);
                    alert('An error occurred.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            });
        }

        // Password Change Form
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', async function (e) {
                e.preventDefault();
                const currentPassword = document.getElementById('currentPassword').value;
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;

                if (newPassword !== confirmPassword) {
                    alert('New passwords do not match.');
                    return;
                }

                const submitBtn = this.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';

                try {
                    const response = await fetchWithAuth(`${API_URL}/auth/change-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentPassword, newPassword })
                    });

                    const data = await response.json();
                    if (response.ok) {
                        alert('Password changed successfully.');
                        passwordForm.reset();
                    } else {
                        alert(data.message || 'Failed to change password');
                    }
                } catch (error) {
                    console.error(error);
                    alert('An error occurred.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            });
        }

        // ... User Menu Toggle (No changes) ...
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

        // ... Notification Modal (No changes) ...
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationModal = document.getElementById('notificationModal');
        const closeNotificationModal = document.getElementById('closeNotificationModal');

        if (notificationBtn && notificationModal) {
            notificationBtn.addEventListener('click', () => {
                notificationModal.classList.remove('hidden');
                notificationModal.classList.add('flex');
            });

            if (closeNotificationModal) {
                closeNotificationModal.addEventListener('click', () => {
                    notificationModal.classList.add('hidden');
                    notificationModal.classList.remove('flex');
                });
            }

            notificationModal.addEventListener('click', (e) => {
                if (e.target === notificationModal) {
                    notificationModal.classList.add('hidden');
                    notificationModal.classList.remove('flex');
                }
            });
        }

        // Photo Input Change Preview used to be here, but we can keep it or enhance it.
        const photoInput = document.getElementById('photoInput');
        const profilePhoto = document.getElementById('profilePhoto');
        if (photoInput && profilePhoto) {
            photoInput.addEventListener('change', function (e) {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                        alert('File size too large. Max 5MB.');
                        this.value = ''; // clear input
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        profilePhoto.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // NEW: Load Sessions
        loadSessions();
    }

    async function loadSessions() {
        // Find container for active sessions
        // We need to identify the container in user_profile_management.html
        // It's inside #securityTabContent -> .card -> .space-y-4
        // We'll need to add a specific ID to that container in HTML first to be safe, 
        // OR select it by traversing. Let's assume we'll update HTML to add id="sessionsContainer"
        const sessionsContainer = document.getElementById('sessionsContainer');
        if (!sessionsContainer) return;

        try {
            const response = await fetchWithAuth(`${API_URL}/users/sessions`);
            const data = await response.json();

            if (data.success) {
                sessionsContainer.innerHTML = '';
                if (data.sessions.length === 0) {
                    sessionsContainer.innerHTML = '<p class="text-sm text-text-secondary">No active sessions found.</p>';
                    return;
                }

                data.sessions.forEach(session => {
                    const isCurrent = false; // Logic to determine current session? 
                    // Usually we match session ID if we store it, or just use identifying info.
                    // For now, simple list.

                    const el = document.createElement('div');
                    el.className = `flex items-center justify-between p-4 ${isCurrent ? 'bg-primary-50 border-primary-100' : 'bg-gray-50 border-gray-200'} rounded-lg border`;

                    el.innerHTML = `
                        <div class="flex items-center">
                            <svg class="h-6 w-6 ${isCurrent ? 'text-primary' : 'text-text-secondary'} mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <div>
                                <p class="text-sm font-medium text-text-primary">${session.device_info || 'Unknown Device'}</p>
                                <p class="text-xs text-text-secondary">${session.ip_address} • ${session.location || 'Unknown Location'}</p>
                                <p class="text-xs text-text-secondary">Last active: ${new Date(session.last_active).toLocaleString()}</p>
                            </div>
                        </div>
                        ${isCurrent ?
                            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-emerald-800">Current</span>` :
                            `<button class="text-xs text-error hover:text-red-700 transition-gentle" onclick="revokeSession(${session.id})">Revoke</button>`
                        }
                    `;
                    sessionsContainer.appendChild(el);
                });
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            sessionsContainer.innerHTML = '<p class="text-sm text-error">Failed to load sessions.</p>';
        }
    }

    // Expose revoke function globally
    window.revokeSession = async function (sessionId) {
        if (!confirm('Are you sure you want to revoke this session?')) return;

        try {
            const response = await fetchWithAuth(`${API_URL}/users/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                loadSessions();
            } else {
                alert('Failed to revoke session.');
            }
        } catch (error) {
            console.error(error);
            alert('Error revoking session.');
        }
    };

    async function loadActivityLog() {
        const container = document.getElementById('activityLogContainer');
        if (!container) return;

        try {
            const response = await fetchWithAuth(`${API_URL}/users/logs?limit=5`);
            const data = await response.json();

            if (data.success) {
                container.innerHTML = '';
                if (data.logs.length === 0) {
                    container.innerHTML = '<li class="p-4 text-center text-sm text-text-secondary">No recent activity.</li>';
                    return;
                }

                data.logs.forEach(log => {
                    const date = new Date(log.createdAt).toLocaleString();
                    const li = document.createElement('li');
                    li.className = 'p-4 hover:bg-gray-50 transition-gentle';
                    li.innerHTML = `
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-text-primary">${log.action}</p>
                                <p class="text-xs text-text-secondary">${log.details || ''} • ${log.ip_address || 'Unknown IP'}</p>
                            </div>
                            <span class="text-xs text-text-secondary">${date}</span>
                        </div>
                    `;
                    container.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Error loading activity log:', error);
            container.innerHTML = '<li class="p-4 text-center text-sm text-error">Failed to load activity log.</li>';
        }
    }

    // Load logs initially
    loadActivityLog();
});
});
