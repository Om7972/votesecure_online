// Account Settings JavaScript
document.addEventListener('DOMContentLoaded', async function () {
    const ADMIN_EMAIL = 'odhumkear@gmail.com';

    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = 'secure_login.html';
        return;
    }

    const user = JSON.parse(userStr);
    const isAdmin = user.role === 'admin' && user.email === ADMIN_EMAIL;
    const dashboardUrl = isAdmin ? 'admin_dashboard.html' : 'voter_dashboard.html';

    // Update logo link based on user role
    const logoLink = document.getElementById('logoLink');
    if (logoLink) {
        logoLink.href = dashboardUrl;
    }

    // Update back to dashboard link
    const backLink = document.getElementById('backToDashboard');
    if (backLink) {
        backLink.href = dashboardUrl;
    }

    // Populate form with actual user data
    await loadUserData();

    // Setup save button
    setupSaveButton();
});

async function loadUserData() {
    try {
        const token = localStorage.getItem('token');

        // First try to get fresh data from server
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                populateForm(data.user);
                return;
            }
        }

        // Fall back to localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            populateForm(JSON.parse(userStr));
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        // Fall back to localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            populateForm(JSON.parse(userStr));
        }
    }
}

function populateForm(user) {
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const dobInput = document.getElementById('dob');

    if (fullNameInput) fullNameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (dobInput && user.dob) {
        // Format date for input
        const date = new Date(user.dob);
        dobInput.value = date.toISOString().split('T')[0];
    }
}

function setupSaveButton() {
    const saveBtn = document.querySelector('button:contains("Save Changes")') ||
        document.querySelector('button.bg-gradient-to-r');

    // Find the save button in account info section
    const accountInfoSection = document.querySelector('.glass-card');
    if (accountInfoSection) {
        const saveButton = accountInfoSection.querySelector('button');
        if (saveButton) {
            saveButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await saveAccountInfo();
            });
        }
    }
}

async function saveAccountInfo() {
    const fullName = document.getElementById('fullName')?.value;
    const phone = document.getElementById('phone')?.value;

    try {
        const token = localStorage.getItem('token');

        const response = await fetch('/api/auth/update-profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: fullName, phone })
        });

        const data = await response.json();

        if (data.success) {
            // Update localStorage
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                user.name = fullName;
                user.phone = phone;
                localStorage.setItem('user', JSON.stringify(user));
            }

            showNotification('Settings saved successfully!', 'success');
        } else {
            showNotification(data.message || 'Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Failed to save settings. Please try again.', 'error');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ${type === 'success' ? 'bg-emerald-500' :
        type === 'error' ? 'bg-red-500' : 'bg-indigo-500'
        } text-white font-medium`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('opacity-0', 'translate-x-4');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
