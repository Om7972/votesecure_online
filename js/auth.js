/**
 * Authentication Management
 * Handles user authentication, registration, and session management
 */

class AuthManager {
  constructor() {
    this.api = window.VoteSecureAPI;
    this.currentUser = null;
    this.isInitialized = false;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Check if user is already logged in
      await this.checkAuthState();
      this.isInitialized = true;
      
      // Set up auth state listeners
      this.setupAuthListeners();
      
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
  }

  async checkAuthState() {
    const token = localStorage.getItem('firebaseToken');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        this.currentUser = JSON.parse(userData);
        this.api.token = token;
        this.api.user = this.currentUser;
        
        // Verify token is still valid
        await this.api.getCurrentUser();
        
      } catch (error) {
        console.error('Token validation failed:', error);
        await this.logout();
      }
    }
  }

  setupAuthListeners() {
    // Listen for auth state changes
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user && !this.currentUser) {
          // User signed in
          await this.handleSignIn(user);
        } else if (!user && this.currentUser) {
          // User signed out
          await this.handleSignOut();
        }
      });
    }

    // Listen for custom auth events
    window.addEventListener('userAuthenticated', (event) => {
      this.currentUser = event.detail.user;
      this.updateUI();
    });

    window.addEventListener('userSignedOut', () => {
      this.currentUser = null;
      this.updateUI();
    });
  }

  async handleSignIn(user) {
    try {
      const token = await user.getIdToken();
      this.api.token = token;
      localStorage.setItem('firebaseToken', token);
      
      // Get user data from backend
      await this.api.getCurrentUser();
      this.currentUser = this.api.user;
      
      // Emit custom event
      window.dispatchEvent(new CustomEvent('userAuthenticated', {
        detail: { user: this.currentUser }
      }));
      
      this.updateUI();
      
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async handleSignOut() {
    this.currentUser = null;
    this.api.user = null;
    this.api.token = null;
    
    localStorage.removeItem('firebaseToken');
    localStorage.removeItem('user');
    
    // Emit custom event
    window.dispatchEvent(new CustomEvent('userSignedOut'));
    
    this.updateUI();
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    try {
      this.showLoading('Signing in...');
      
      const result = await this.api.login(email, password);
      
      if (result.success) {
        this.currentUser = result.user;
        this.updateUI();
        this.hideLoading();
        
        // Show success message
        this.showMessage('Login successful!', 'success');
        
        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = 'pages/voter_dashboard.html';
        }, 1000);
        
        return result;
      }
      
    } catch (error) {
      this.hideLoading();
      this.showMessage(this.getErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      this.showLoading('Creating account...');
      
      const result = await this.api.register(userData);
      
      if (result.success) {
        this.currentUser = this.api.user;
        this.updateUI();
        this.hideLoading();
        
        // Show success message
        this.showMessage('Registration successful! Please check your email for verification.', 'success');
        
        // Redirect to verification page or dashboard
        setTimeout(() => {
          window.location.href = 'pages/user_profile_management.html';
        }, 2000);
        
        return result;
      }
      
    } catch (error) {
      this.hideLoading();
      this.showMessage(this.getErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      this.showLoading('Signing out...');
      
      await this.api.logout();
      await this.handleSignOut();
      
      this.hideLoading();
      this.showMessage('Logged out successfully', 'success');
      
      // Redirect to login page
      setTimeout(() => {
        window.location.href = 'pages/secure_login.html';
      }, 1000);
      
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      await this.handleSignOut();
      this.hideLoading();
      window.location.href = 'pages/secure_login.html';
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    try {
      this.showLoading('Updating profile...');
      
      const result = await this.api.updateProfile(profileData);
      
      if (result.success) {
        this.currentUser = this.api.user;
        this.hideLoading();
        this.showMessage('Profile updated successfully', 'success');
        
        return result;
      }
      
    } catch (error) {
      this.hideLoading();
      this.showMessage(this.getErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email) {
    try {
      this.showLoading('Sending reset email...');
      
      await firebase.auth().sendPasswordResetEmail(email);
      
      this.hideLoading();
      this.showMessage('Password reset email sent. Please check your inbox.', 'success');
      
    } catch (error) {
      this.hideLoading();
      this.showMessage(this.getErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Verify email
   */
  async verifyEmail() {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in');
      }
      
      this.showLoading('Sending verification email...');
      
      await firebase.auth().currentUser.sendEmailVerification();
      
      this.hideLoading();
      this.showMessage('Verification email sent. Please check your inbox.', 'success');
      
    } catch (error) {
      this.hideLoading();
      this.showMessage(this.getErrorMessage(error), 'error');
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser && !!this.api.token;
  }

  /**
   * Check if user is admin
   */
  isAdmin() {
    return this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'super_admin');
  }

  /**
   * Check if user can vote
   */
  canVote() {
    return this.currentUser && this.currentUser.isEligibleToVote;
  }

  /**
   * Require authentication for protected routes
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'pages/secure_login.html';
      return false;
    }
    return true;
  }

  /**
   * Require admin access
   */
  requireAdmin() {
    if (!this.requireAuth()) {
      return false;
    }
    
    if (!this.isAdmin()) {
      this.showMessage('Admin access required', 'error');
      window.location.href = 'pages/voter_dashboard.html';
      return false;
    }
    
    return true;
  }

  /**
   * Update UI based on authentication state
   */
  updateUI() {
    // Update navigation
    this.updateNavigation();
    
    // Update user info display
    this.updateUserInfo();
    
    // Show/hide auth-dependent elements
    this.updateAuthElements();
  }

  updateNavigation() {
    const authLinks = document.querySelectorAll('.auth-links');
    const userLinks = document.querySelectorAll('.user-links');
    const adminLinks = document.querySelectorAll('.admin-links');
    
    authLinks.forEach(link => {
      link.style.display = this.isAuthenticated() ? 'none' : 'block';
    });
    
    userLinks.forEach(link => {
      link.style.display = this.isAuthenticated() ? 'block' : 'none';
    });
    
    adminLinks.forEach(link => {
      link.style.display = this.isAdmin() ? 'block' : 'none';
    });
  }

  updateUserInfo() {
    const userInfoElements = document.querySelectorAll('.user-info');
    
    userInfoElements.forEach(element => {
      if (this.currentUser) {
        // Update user name
        const nameElements = element.querySelectorAll('.user-name');
        nameElements.forEach(el => {
          el.textContent = this.currentUser.fullName || this.currentUser.email;
        });
        
        // Update user avatar
        const avatarElements = element.querySelectorAll('.user-avatar');
        avatarElements.forEach(el => {
          if (this.currentUser.profile?.avatar) {
            el.src = this.currentUser.profile.avatar;
          }
        });
        
        // Update user role
        const roleElements = element.querySelectorAll('.user-role');
        roleElements.forEach(el => {
          el.textContent = this.currentUser.role;
        });
        
        // Update voting eligibility
        const eligibilityElements = element.querySelectorAll('.voting-eligibility');
        eligibilityElements.forEach(el => {
          el.textContent = this.canVote() ? 'Eligible to Vote' : 'Not Eligible';
          el.className = `voting-eligibility ${this.canVote() ? 'eligible' : 'ineligible'}`;
        });
      }
    });
  }

  updateAuthElements() {
    // Show/hide login/logout buttons
    const loginButtons = document.querySelectorAll('.login-button');
    const logoutButtons = document.querySelectorAll('.logout-button');
    
    loginButtons.forEach(button => {
      button.style.display = this.isAuthenticated() ? 'none' : 'block';
    });
    
    logoutButtons.forEach(button => {
      button.style.display = this.isAuthenticated() ? 'block' : 'none';
    });
    
    // Update voting-related elements
    const voteButtons = document.querySelectorAll('.vote-button');
    voteButtons.forEach(button => {
      button.disabled = !this.canVote();
    });
  }

  /**
   * UI Helper methods
   */
  showLoading(message = 'Loading...') {
    // Create or update loading overlay
    let loadingOverlay = document.getElementById('loading-overlay');
    
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'loading-overlay';
      loadingOverlay.className = 'loading-overlay';
      document.body.appendChild(loadingOverlay);
    }
    
    loadingOverlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p>${message}</p>
      </div>
    `;
    
    loadingOverlay.style.display = 'flex';
  }

  hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  }

  showMessage(message, type = 'info') {
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    messageElement.innerHTML = `
      <div class="message-content">
        <span class="message-text">${message}</span>
        <button class="message-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(messageElement);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (messageElement.parentElement) {
        messageElement.remove();
      }
    }, 5000);
  }

  getErrorMessage(error) {
    if (error instanceof APIError) {
      return error.message;
    }
    
    if (error.code) {
      return this.api.getFirebaseErrorMessage(error);
    }
    
    return error.message || 'An unexpected error occurred';
  }
}

// Initialize global auth manager
window.AuthManager = new AuthManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}
