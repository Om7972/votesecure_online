// Admin Dashboard JavaScript - VoteSecure Online
// Only accessible by designated admin email: odhumkear@gmail.com

const ADMIN_EMAIL = 'odhumkear@gmail.com';

document.addEventListener('DOMContentLoaded', async function () {
    // Verify admin access
    await verifyAdminAccess();
});

let socket;
let currentElectionIdForCandidates = null;

function initializeSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to socket server');
    });

    socket.on('user_update', (data) => {
        console.log('User update received:', data);
        loadVoters(); // Refresh list - efficient enough for now
        loadDashboardStats();
    });

    socket.on('election_update', (data) => {
        console.log('Election update received:', data);
        loadElections();
        loadDashboardStats();
    });

    socket.on('candidate_update', (data) => {
        console.log('Candidate update received:', data);
        if (currentElectionIdForCandidates && currentElectionIdForCandidates == data.electionId) {
            // Refresh candidate list if viewing that election
            loadCandidatesForElection(currentElectionIdForCandidates);
        }
        loadElections(); // To update vote counts
    });
}

// Global modal functions
window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function verifyAdminAccess() {
    const loadingState = document.getElementById('loadingState');
    const notAuthorized = document.getElementById('notAuthorized');
    const adminContent = document.getElementById('adminContent');

    try {
        const token = localStorage.getItem('token');

        if (!token) {
            // No token, redirect to login
            window.location.href = 'secure_login.html';
            return;
        }

        // Get user info from localStorage first
        const userStr = localStorage.getItem('user');
        let user = userStr ? JSON.parse(userStr) : null;

        // Also fetch fresh data from server
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Unauthorized');
        }

        const data = await response.json();

        if (data.success && data.user) {
            user = data.user;
        }

        // Check if user is admin AND has the correct email
        if (!user || user.role !== 'admin' || user.email !== ADMIN_EMAIL) {
            // Not authorized - show access denied
            loadingState.style.display = 'none';
            notAuthorized.classList.remove('hidden');
            notAuthorized.classList.add('flex');
            adminContent.classList.add('hidden');
            return;
        }

        // Authorized - show admin content
        loadingState.style.display = 'none';
        notAuthorized.classList.add('hidden');
        adminContent.classList.remove('hidden');

        // Initialize dashboard
        initializeAdminDashboard(user);
        initializeSocket();

    } catch (error) {
        console.error('Auth verification error:', error);
        loadingState.style.display = 'none';
        notAuthorized.classList.remove('hidden');
        notAuthorized.classList.add('flex');
        adminContent.classList.add('hidden');
    }
}

function initializeAdminDashboard(user) {
    // Set admin user info
    updateAdminProfile(user);

    // Setup event listeners
    setupTabNavigation();
    setupUserDropdown();
    setupLogout();
    setupVoterSearch();
    setupForms();

    // Check for hash in URL and switch to tab if present
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        // Map 'users' to 'voters' if needed, or just use tab names
        const tabMap = { 'users': 'voters', 'dashboard': 'elections' }; // Map alias to tab ID
        const target = tabMap[hash] || hash;

        // Small delay to ensure DOM is ready if needed, though usually fine here
        setTimeout(() => switchTab(target), 100);
    }

    // Load dashboard data
    loadDashboardStats();
    loadElections();
    loadRecentActivity();
    loadVoters();

    // Refresh data every 30 seconds as backup
    setInterval(() => {
        loadDashboardStats();
        loadElections();
        loadRecentActivity();
    }, 30000);
}

function setupForms() {
    // Add Election Button
    const addElectionBtn = document.querySelector('a[href="active_elections.html"]');
    if (addElectionBtn) {
        addElectionBtn.removeAttribute('href');
        addElectionBtn.style.cursor = 'pointer';
        addElectionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openCreateElectionModal();
        });
    }

    // User Form Submit
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editUserId').value;
            const role = document.getElementById('editUserRole').value;
            const status = document.getElementById('editUserStatus').value;

            try {
                const token = localStorage.getItem('token');

                // Update Role
                await fetch(`/api/admin/users/${id}/role`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ role })
                });

                // Update Status
                await fetch(`/api/admin/users/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ status })
                });

                closeModal('userModal');
                loadVoters();

            } catch (error) {
                console.error('Error updating user:', error);
                alert('Failed to update user.');
            }
        });
    }

    // Election Form Submit
    const electionForm = document.getElementById('electionForm');
    if (electionForm) {
        electionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editElectionId').value;
            const title = document.getElementById('electionTitle').value;
            const description = document.getElementById('electionDesc').value;
            const startStr = document.getElementById('electionStart').value;
            const endStr = document.getElementById('electionEnd').value;
            const type = document.getElementById('electionType').value;
            const status = document.getElementById('electionStatus').value;

            // Convert local datetime input to ISO string for backend
            const start_time = new Date(startStr).toISOString();
            const end_time = new Date(endStr).toISOString();

            try {
                const token = localStorage.getItem('token');
                const url = id ? `/api/admin/elections/${id}` : '/api/admin/elections';
                const method = id ? 'PATCH' : 'POST';

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ title, description, start_time, end_time, type, status })
                });

                if (!response.ok) throw new Error('Failed to save election');

                closeModal('electionModal');
                loadElections();

            } catch (error) {
                console.error('Error saving election:', error);
                alert('Failed to save election.');
            }
        });
    }

    // Candidate Form Submit
    const candidateForm = document.getElementById('candidateForm');
    if (candidateForm) {
        candidateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentElectionIdForCandidates) return;

            const id = document.getElementById('editCandidateId').value;
            const name = document.getElementById('candidateName').value;
            const party = document.getElementById('candidateParty').value;
            const position = document.getElementById('candidatePosition').value;
            const image_url = document.getElementById('candidateImage').value;
            const manifesto = document.getElementById('candidateManifesto').value;

            try {
                const token = localStorage.getItem('token');
                const url = id
                    ? `/api/admin/elections/${currentElectionIdForCandidates}/candidates/${id}`
                    : `/api/admin/elections/${currentElectionIdForCandidates}/candidates`;
                const method = id ? 'PATCH' : 'POST';

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ name, party, position, image_url, manifesto })
                });

                if (!response.ok) throw new Error('Failed to save candidate');

                closeModal('candidateModal');
                loadCandidatesForElection(currentElectionIdForCandidates);

            } catch (error) {
                console.error('Error saving candidate:', error);
                alert('Failed to save candidate.');
            }
        });
    }
}

function openCreateElectionModal() {
    document.getElementById('electionModalTitle').textContent = 'Create Election';
    document.getElementById('electionForm').reset();
    document.getElementById('editElectionId').value = '';
    document.getElementById('candidateManagementSection').classList.add('hidden');
    openModal('electionModal');
}

window.openEditElectionModal = function (id, title, description, start, end, status, type) {
    document.getElementById('electionModalTitle').textContent = 'Edit Election';
    document.getElementById('editElectionId').value = id;
    document.getElementById('electionTitle').value = title;
    document.getElementById('electionDesc').value = description;

    // Format dates for datetime-local input (YYYY-MM-DDThh:mm)
    const formatDateForInput = (dateStr) => {
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    document.getElementById('electionStart').value = formatDateForInput(start);
    document.getElementById('electionEnd').value = formatDateForInput(end);
    document.getElementById('electionType').value = type || 'General';
    document.getElementById('electionStatus').value = status;

    // Show candidates section
    currentElectionIdForCandidates = id;
    document.getElementById('candidateManagementSection').classList.remove('hidden');
    loadCandidatesForElection(id);

    openModal('electionModal');
}

window.openCandidateModal = function () {
    document.getElementById('candidateModalTitle').textContent = 'Add Candidate';
    document.getElementById('candidateForm').reset();
    document.getElementById('editCandidateId').value = '';
    openModal('candidateModal');
}

async function loadCandidatesForElection(electionId) {
    const list = document.getElementById('candidatesList');
    list.innerHTML = '<p class="text-slate-400 text-sm">Loading candidates...</p>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/elections', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const election = data.elections.find(e => e.id == electionId);

        if (election && election.Candidates) {
            if (election.Candidates.length > 0) {
                list.innerHTML = election.Candidates.map(c => `
                    <div class="flex items-center justify-between bg-slate-800 p-2 rounded-lg">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 rounded-full bg-slate-700 bg-cover bg-center" style="background-image: url('${c.image_url || ''}');"></div>
                            <div>
                                <p class="text-white text-sm font-medium">${escapeHtml(c.name)}</p>
                                <p class="text-slate-500 text-xs">${escapeHtml(c.party || '')} • ${escapeHtml(c.position)}</p>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button type="button" onclick="deleteCandidate('${electionId}', '${c.id}')" class="text-red-400 hover:text-red-300">
                                <i class='bx bx-trash'></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = '<p class="text-slate-400 text-sm italic">No candidates yet.</p>';
            }
        } else {
            list.innerHTML = '<p class="text-slate-400 text-sm italic">No candidates yet.</p>';
        }

    } catch (error) {
        console.error("Error loading candidates", error);
        list.innerHTML = '<p class="text-red-400 text-sm">Error loading candidates.</p>';
    }
}

window.deleteCandidate = async function (electionId, candidateId) {
    if (!confirm('Are you sure you want to delete this candidate?')) return;

    try {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/elections/${electionId}/candidates/${candidateId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadCandidatesForElection(electionId);
    } catch (error) {
        alert('Failed to delete candidate.');
    }
}

window.openEditUserModal = function (id, name, role, status) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserName').value = name;
    document.getElementById('editUserRole').value = role;
    document.getElementById('editUserStatus').value = status || 'active'; // Default to active if missing
    openModal('userModal');
}

function updateAdminProfile(user) {
    const adminName = document.getElementById('adminName');
    const adminAvatar = document.getElementById('adminAvatar');

    if (adminName) adminName.textContent = user.name || 'Administrator';
    if (adminAvatar) adminAvatar.textContent = (user.name || 'A').charAt(0).toUpperCase();
}

window.switchTab = function (tabName) {
    if (tabName === 'dashboard') tabName = 'elections'; // Default tab for dashboard view

    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btn) {
        btn.click();
        // Update URL hash without scrolling
        history.pushState(null, null, `#${tabName}`);

        // Update active state in Navbar
        document.querySelectorAll('.nav-link').forEach(link => {
            // Logic to highlight navbar item could go here if we had unique IDs or data-target
            // For now, mainly ensures tab content is shown
        });
    } else {
        console.warn(`Tab '${tabName}' not found.`);
    }
}

function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = {
        'elections': document.getElementById('electionsTab'),
        'activity': document.getElementById('activityTab'),
        'voters': document.getElementById('votersTab'),
        'analytics': document.getElementById('analyticsTab')
    };

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all tabs
            tabBtns.forEach(b => {
                b.classList.remove('active', 'text-indigo-400', 'border-indigo-400');
                b.classList.add('text-slate-400', 'border-transparent');
            });

            // Hide all content
            Object.values(tabContents).forEach(c => { if (c) c.classList.add('hidden'); });

            // Activate clicked tab
            btn.classList.add('active', 'text-indigo-400', 'border-indigo-400');
            btn.classList.remove('text-slate-400', 'border-transparent');

            const tabName = btn.dataset.tab;
            if (tabContents[tabName]) {
                tabContents[tabName].classList.remove('hidden');
            }

            // Lazy load charts when analytics tab is opened
            if (tabName === 'analytics') {
                initializeCharts();
            }
        });
    });
}

function setupUserDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            userDropdown.classList.add('hidden');
        });
    }
}

function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'secure_login.html';
        });
    }
}

function setupVoterSearch() {
    const voterSearch = document.getElementById('voterSearch');
    let searchTimeout;

    if (voterSearch) {
        voterSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadVoters(e.target.value);
            }, 300);
        });
    }
}

async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('token');

        // Fetch voters count
        const usersResponse = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Fetch elections
        const electionsResponse = await fetch('/api/elections', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let totalVoters = 0;
        let totalVotes = 0;
        let activeElections = 0;

        if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (usersData.success && usersData.users) {
                totalVoters = usersData.users.filter(u => u.role === 'voter').length;
            }
        }

        if (electionsResponse.ok) {
            const electionsData = await electionsResponse.json();
            if (electionsData.success && electionsData.elections) {
                activeElections = electionsData.elections.filter(e => e.status === 'active').length;
                // Calculate total votes from elections
                electionsData.elections.forEach(e => {
                    if (e.Candidates) {
                        e.Candidates.forEach(c => {
                            totalVotes += c.vote_count || 0;
                        });
                    }
                });
            }
        }

        // Calculate turnout
        const turnout = totalVoters > 0 ? Math.round((totalVotes / totalVoters) * 100) : 0;

        // Update UI
        document.getElementById('totalVoters').textContent = totalVoters;
        document.getElementById('totalVotes').textContent = totalVotes;
        document.getElementById('overallTurnout').textContent = Math.min(turnout, 100) + '%';
        document.getElementById('activeElections').textContent = activeElections;

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadElections() {
    const container = document.getElementById('electionsList');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/elections', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`Failed to fetch elections: ${response.status} ${response.statusText}`);

        const data = await response.json();

        if (data.success && data.elections && data.elections.length > 0) {
            container.innerHTML = data.elections.map(election => {
                const startDate = new Date(election.start_time);
                const endDate = new Date(election.end_time);
                const now = new Date();

                let status = 'upcoming';
                let statusLabel = 'Upcoming';
                let statusClass = 'bg-blue-500/20 text-blue-400';

                if (election.status === 'active' || (now >= startDate && now <= endDate) && election.status !== 'ended' && election.status !== 'frozen') {
                    status = 'active';
                    statusLabel = 'Active';
                    statusClass = 'bg-green-500/20 text-green-400';
                } else if (election.status === 'completed' || election.status === 'ended' || now > endDate) {
                    status = 'completed';
                    statusLabel = 'Completed';
                    statusClass = 'bg-slate-500/20 text-slate-400';
                } else if (election.status === 'frozen') {
                    status = 'frozen';
                    statusLabel = 'Frozen';
                    statusClass = 'bg-yellow-500/20 text-yellow-500';
                }

                // Calculate total votes
                let totalVotes = 0;
                if (election.Candidates) {
                    election.Candidates.forEach(c => {
                        totalVotes += c.vote_count || 0;
                    });
                }

                return `
                    <div class="border-l-4 border-indigo-500 bg-slate-800/50 rounded-r-lg p-4 mb-4 relative group">
                        <button onclick="openEditElectionModal('${election.id}', '${escapeHtml(election.title).replace(/'/g, "\\'")}', '${escapeHtml(election.description || '').replace(/'/g, "\\'")}', '${election.start_time}', '${election.end_time}', '${election.status}', '${election.type}')" 
                                class="absolute top-4 right-4 p-2 bg-slate-700 hover:bg-indigo-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                            <i class='bx bx-edit'></i>
                        </button>
                        <div class="flex items-start justify-between mb-3 pr-12">
                            <div>
                                <h3 class="text-white font-semibold text-lg">${escapeHtml(election.title)}</h3>
                                <p class="text-slate-400 text-sm">${escapeHtml(election.description || 'No description available')}</p>
                            </div>
                            <span class="px-3 py-1 ${statusClass} rounded-full text-xs font-semibold">${statusLabel}</span>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p class="text-slate-500">Type</p>
                                <p class="text-indigo-400 font-medium">${election.type || 'General'}</p>
                            </div>
                            <div>
                                <p class="text-slate-500">Total Votes</p>
                                <p class="text-white font-medium">${totalVotes}</p>
                            </div>
                            <div>
                                <p class="text-slate-500">Start Date</p>
                                <p class="text-white font-medium">${formatDate(startDate)}</p>
                            </div>
                            <div>
                                <p class="text-slate-500">End Date</p>
                                <p class="text-white font-medium">${formatDate(endDate)}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class='bx bx-calendar-x text-3xl text-slate-500'></i>
                    </div>
                    <h3 class="text-white font-semibold mb-2">No Elections Found</h3>
                    <p class="text-slate-400 text-sm">There are no elections in the system yet.</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error loading elections:', error);
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class='bx bx-error-circle text-3xl text-red-400'></i>
                </div>
                <h3 class="text-white font-semibold mb-2">Error Loading Elections</h3>
                <p class="text-slate-400 text-sm">Please try refreshing the page.</p>
            </div>
        `;
    }
}

async function loadRecentActivity() {
    const container = document.getElementById('activityList');

    try {
        const token = localStorage.getItem('token');

        // Fetch audit logs if available
        const response = await fetch('/api/admin/database/audit_logs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let activities = [];

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
                activities = data.data.slice(0, 20);
            }
        }

        if (activities.length > 0) {
            container.innerHTML = activities.map(activity => {
                const icon = getActivityIcon(activity.action);
                const time = new Date(activity.createdAt);

                return `
                    <div class="flex items-start space-x-4 p-4 bg-slate-800/50 rounded-lg">
                        <div class="w-10 h-10 ${icon.bgClass} rounded-lg flex items-center justify-center flex-shrink-0">
                            <i class='bx ${icon.icon} text-xl ${icon.textClass}'></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-white font-medium">${formatAction(activity.action)}</p>
                            <p class="text-slate-400 text-sm truncate">${escapeHtml(activity.details || '')}</p>
                        </div>
                        <p class="text-slate-500 text-xs whitespace-nowrap">${formatRelativeTime(time)}</p>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = getMockActivity();
        }

    } catch (error) {
        console.error('Error loading activity:', error);
        container.innerHTML = getMockActivity();
    }
}

function getMockActivity() {
    const mockActivities = [
        { icon: 'bx-check-circle', bgClass: 'bg-green-500/20', textClass: 'text-green-400', title: 'Vote Cast', desc: 'New vote recorded for Student Council Election', time: '2 minutes ago' },
        { icon: 'bx-user-plus', bgClass: 'bg-indigo-500/20', textClass: 'text-indigo-400', title: 'User Registered', desc: 'New voter registered and verified', time: '15 minutes ago' },
        { icon: 'bx-calendar-plus', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400', title: 'Election Created', desc: 'New election scheduled for next week', time: '1 hour ago' },
        { icon: 'bx-cog', bgClass: 'bg-purple-500/20', textClass: 'text-purple-400', title: 'System Update', desc: 'Security patch applied successfully', time: '2 hours ago' },
        { icon: 'bx-check-circle', bgClass: 'bg-green-500/20', textClass: 'text-green-400', title: 'Vote Cast', desc: 'Another vote recorded', time: '3 hours ago' },
    ];

    return mockActivities.map(activity => `
        <div class="flex items-start space-x-4 p-4 bg-slate-800/50 rounded-lg">
            <div class="w-10 h-10 ${activity.bgClass} rounded-lg flex items-center justify-center flex-shrink-0">
                <i class='bx ${activity.icon} text-xl ${activity.textClass}'></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-white font-medium">${activity.title}</p>
                <p class="text-slate-400 text-sm truncate">${activity.desc}</p>
            </div>
            <p class="text-slate-500 text-xs whitespace-nowrap">${activity.time}</p>
        </div>
    `).join('');
}

async function loadVoters(searchQuery = '') {
    const tbody = document.getElementById('votersTableBody');
    const showingCount = document.getElementById('showingCount');
    const totalCount = document.getElementById('totalCount');

    try {
        const token = localStorage.getItem('token');
        const url = searchQuery
            ? `/api/admin/users?search=${encodeURIComponent(searchQuery)}`
            : '/api/admin/users';

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch users');

        const data = await response.json();

        if (data.success && data.users && data.users.length > 0) {
            const voters = data.users.filter(u => u.role === 'voter' || u.role === 'admin'); // Show all for admin to manage

            showingCount.textContent = voters.length;
            totalCount.textContent = voters.length;

            tbody.innerHTML = voters.map(voter => {
                const initials = (voter.name || 'U').charAt(0).toUpperCase();
                const isVerified = voter.is_verified;
                const statusClass = isVerified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400';
                const statusLabel = isVerified ? 'Verified' : 'Pending';

                const roleClass = voter.role === 'admin' ? 'text-purple-400 font-bold' : 'text-slate-400';

                return `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td class="py-4">
                            <div class="flex items-center space-x-3">
                                <div class="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">${initials}</div>
                                <div>
                                    <p class="text-white font-medium">${escapeHtml(voter.name || 'Unknown')} <span class="text-xs ${roleClass}">(${voter.role})</span></p>
                                    <p class="text-slate-400 text-sm">${escapeHtml(voter.email || 'No email')}</p>
                                </div>
                            </div>
                        </td>
                        <td class="py-4">
                             <div class="flex flex-col space-y-1 items-start">
                                <span class="px-3 py-1 ${statusClass} rounded-full text-xs font-semibold">${statusLabel}</span>
                                <span class="px-3 py-1 ${voter.status === 'suspended' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'} rounded-full text-xs font-semibold">${(voter.status || 'active').charAt(0).toUpperCase() + (voter.status || 'active').slice(1)}</span>
                             </div>
                        </td>
                        <td class="py-4 text-white">${voter.votes_count || 0}</td>
                        <td class="py-4 text-slate-400">${voter.createdAt ? formatDate(new Date(voter.createdAt)) : 'Unknown'}</td>
                        <td class="py-4">
                            <button onclick="openEditUserModal('${voter.id}', '${escapeHtml(voter.name || '').replace(/'/g, "\\'")}', '${voter.role}', '${voter.status}')" class="px-4 py-2 bg-slate-800 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors">
                                Edit
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            showingCount.textContent = '0';
            totalCount.textContent = '0';
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center">
                        <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class='bx bx-user-x text-3xl text-slate-500'></i>
                        </div>
                        <h3 class="text-white font-semibold mb-2">No Voters Found</h3>
                        <p class="text-slate-400 text-sm">${searchQuery ? 'No voters match your search.' : 'No registered voters yet.'}</p>
                    </td>
                </tr>
            `;
        }

    } catch (error) {
        console.error('Error loading voters:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center">
                    <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class='bx bx-error-circle text-3xl text-red-400'></i>
                    </div>
                    <h3 class="text-white font-semibold mb-2">Error Loading Voters</h3>
                    <p class="text-slate-400 text-sm">Please try refreshing the page.</p>
                </td>
            </tr>
        `;
    }
}

function viewVoterDetails(voterId) {
    alert(`Viewing details for voter ID: ${voterId}`);
}

let chartsInitialized = false;

function initializeCharts() {
    if (chartsInitialized) return;
    chartsInitialized = true;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#94a3b8' }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#94a3b8' }
            }
        }
    };

    // Voting Activity Chart
    const votingActivityCtx = document.getElementById('votingActivityChart');
    if (votingActivityCtx) {
        new Chart(votingActivityCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Votes',
                    data: [45, 62, 78, 95, 110, 85, 72],
                    borderColor: '#818cf8',
                    backgroundColor: 'rgba(129, 140, 248, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#818cf8',
                    pointBorderColor: '#1e293b',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: chartOptions
        });
    }

    // Participation Chart
    const participationCtx = document.getElementById('participationChart');
    if (participationCtx) {
        new Chart(participationCtx, {
            type: 'bar',
            data: {
                labels: ['Council 2024', 'Board 2024', 'Budget Vote', 'Committee'],
                datasets: [{
                    label: 'Turnout %',
                    data: [68, 45, 72, 55],
                    backgroundColor: [
                        'rgba(129, 140, 248, 0.8)',
                        'rgba(167, 139, 250, 0.8)',
                        'rgba(52, 211, 153, 0.8)',
                        'rgba(251, 146, 60, 0.8)'
                    ],
                    borderRadius: 6
                }]
            },
            options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }
        });
    }

    // Registration Chart
    const registrationCtx = document.getElementById('registrationChart');
    if (registrationCtx) {
        new Chart(registrationCtx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'New Registrations',
                    data: [25, 42, 38, 56],
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#34d399',
                    pointBorderColor: '#1e293b',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: chartOptions
        });
    }

    // Vote Time Chart
    const voteTimeCtx = document.getElementById('voteTimeChart');
    if (voteTimeCtx) {
        new Chart(voteTimeCtx, {
            type: 'bar',
            data: {
                labels: ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM'],
                datasets: [{
                    label: 'Votes',
                    data: [15, 28, 45, 38, 52, 65, 42],
                    backgroundColor: 'rgba(167, 139, 250, 0.8)',
                    borderRadius: 6
                }]
            },
            options: chartOptions
        });
    }
}

// Utility Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function getActivityIcon(action) {
    const icons = {
        'LOGIN': { icon: 'bx-log-in', bgClass: 'bg-indigo-500/20', textClass: 'text-indigo-400' },
        'LOGOUT': { icon: 'bx-log-out', bgClass: 'bg-slate-500/20', textClass: 'text-slate-400' },
        'REGISTER': { icon: 'bx-user-plus', bgClass: 'bg-indigo-500/20', textClass: 'text-indigo-400' },
        'VOTE': { icon: 'bx-check-circle', bgClass: 'bg-green-500/20', textClass: 'text-green-400' },
        'VOTE_CAST': { icon: 'bx-check-circle', bgClass: 'bg-green-500/20', textClass: 'text-green-400' },
        'PASSWORD_CHANGE': { icon: 'bx-lock', bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-400' },
        'ELECTION_CREATE': { icon: 'bx-calendar-plus', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400' },
        'PROFILE_UPDATE': { icon: 'bx-user-check', bgClass: 'bg-purple-500/20', textClass: 'text-purple-400' }
    };
    return icons[action] || { icon: 'bx-info-circle', bgClass: 'bg-slate-500/20', textClass: 'text-slate-400' };
}

function formatAction(action) {
    const actions = {
        'LOGIN': 'User Login',
        'LOGOUT': 'User Logout',
        'REGISTER': 'New Registration',
        'VOTE': 'Vote Cast',
        'VOTE_CAST': 'Vote Cast',
        'PASSWORD_CHANGE': 'Password Changed',
        'ELECTION_CREATE': 'Election Created',
        'PROFILE_UPDATE': 'Profile Updated'
    };
    return actions[action] || action;
}
