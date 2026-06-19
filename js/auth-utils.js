// Shared Auth Utilities - VoteSecure Online
// This file provides common authentication and navigation utilities

const ADMIN_EMAIL = 'odhumkear@gmail.com';

/**
 * Get current user from localStorage
 */
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

/**
 * Check if current user is admin
 */
function isCurrentUserAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin' && user.email === ADMIN_EMAIL;
}

/**
 * Get the correct dashboard URL based on user role
 */
function getDashboardUrl() {
    return isCurrentUserAdmin() ? 'admin_dashboard.html' : 'voter_dashboard.html';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

/**
 * Redirect to login if not authenticated
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'secure_login.html';
        return false;
    }
    return true;
}

/**
 * Setup all dashboard links on the page to use correct URL
 * Call this on DOMContentLoaded
 */
function setupDashboardLinks() {
    const dashboardUrl = getDashboardUrl();

    // List of IDs that should link to the dashboard
    const dashboardLinkIds = [
        'logoLink',
        'dashboardLink',
        'backToDashboard',
        'sidebarDashboardLink',
        'mobileDashboardLink',
        'dashboardNavLink',
        'userProfileLink',
        'navDashboardLink'
    ];

    // Update elements by ID
    dashboardLinkIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.tagName === 'A') {
            el.href = dashboardUrl;
        }
    });

    // Find and update all links that point to voter_dashboard.html
    const links = document.querySelectorAll('a[href*="voter_dashboard.html"], a[href*="admin_dashboard.html"]');
    links.forEach(link => {
        // Check if this is a dashboard link (not a specific page link)
        const href = link.getAttribute('href');
        if (href === 'voter_dashboard.html' || href === 'admin_dashboard.html' ||
            href === './voter_dashboard.html' || href === './admin_dashboard.html') {
            link.href = dashboardUrl;
        }
    });

    // Also update any element with id containing 'dashboard' link
    const dashboardLinkElements = document.querySelectorAll('[id*="dashboard" i], [id*="Dashboard" i]');
    dashboardLinkElements.forEach(el => {
        if (el.tagName === 'A' && el.href) {
            el.href = dashboardUrl;
        }
    });

    // Update logo links that go to dashboard
    const logoLinks = document.querySelectorAll('#logoLink, .logo-link, header a:first-of-type');
    logoLinks.forEach(link => {
        if (link.tagName === 'A') {
            const href = link.getAttribute('href');
            if (href && (href.includes('dashboard') || href === '#')) {
                link.href = dashboardUrl;
            }
        }
    });
}

/**
 * Logout user and redirect to login
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    window.location.href = 'secure_login.html';
}

/**
 * Initialize auth utilities on page load
 */
function initAuthUtils() {
    setupDashboardLinks();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthUtils);
} else {
    initAuthUtils();
}
