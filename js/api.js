/**
 * VoteSecure API Client
 * Handles all API communications with the backend
 */

class VoteSecureAPI {
  constructor() {
    this.baseURL = process.env.API_BASE_URL || 'http://localhost:5000/api';
    this.token = localStorage.getItem('firebaseToken');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    
    // Initialize Firebase if not already done
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase configuration
   */
  async initializeFirebase() {
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded');
      return;
    }

    try {
      // Initialize Firebase app
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey: process.env.FIREBASE_API_KEY || "your-api-key",
          authDomain: process.env.FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
          projectId: process.env.FIREBASE_PROJECT_ID || "your-project-id",
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
          messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
          appId: process.env.FIREBASE_APP_ID || "your-app-id"
        });
      }

      // Set up auth state listener
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          this.token = await user.getIdToken();
          localStorage.setItem('firebaseToken', this.token);
          await this.getCurrentUser();
        } else {
          this.token = null;
          this.user = null;
          localStorage.removeItem('firebaseToken');
          localStorage.removeItem('user');
        }
      });

    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }

  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add authorization header if token exists
    if (this.token) {
      config.headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new APIError(data.message || 'Request failed', response.status, data.code);
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle network errors
      throw new APIError('Network error. Please check your connection.', 0, 'NETWORK_ERROR');
    }
  }

  /**
   * Authentication methods
   */
  async login(email, password) {
    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const token = await userCredential.user.getIdToken();
      this.token = token;
      localStorage.setItem('firebaseToken', token);
      
      await this.getCurrentUser();
      return { success: true, user: this.user };
    } catch (error) {
      throw new APIError(this.getFirebaseErrorMessage(error), 401, 'LOGIN_ERROR');
    }
  }

  async register(userData) {
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(
        userData.email, 
        userData.password
      );
      
      // Update user profile
      await userCredential.user.updateProfile({
        displayName: `${userData.firstName} ${userData.lastName}`
      });

      const token = await userCredential.user.getIdToken();
      this.token = token;
      localStorage.setItem('firebaseToken', token);

      // Register user in backend
      const response = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      await this.getCurrentUser();
      return response;
    } catch (error) {
      throw new APIError(this.getFirebaseErrorMessage(error), 400, 'REGISTER_ERROR');
    }
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
      await firebase.auth().signOut();
      this.token = null;
      this.user = null;
      localStorage.removeItem('firebaseToken');
      localStorage.removeItem('user');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      await firebase.auth().signOut();
      this.token = null;
      this.user = null;
      localStorage.removeItem('firebaseToken');
      localStorage.removeItem('user');
      return { success: true };
    }
  }

  async getCurrentUser() {
    try {
      const response = await this.request('/auth/me');
      this.user = response.data.user;
      localStorage.setItem('user', JSON.stringify(this.user));
      return this.user;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await this.request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      
      await this.getCurrentUser();
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Election methods
   */
  async getElections(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== '') {
          queryParams.append(key, filters[key]);
        }
      });

      const endpoint = queryParams.toString() ? 
        `/elections?${queryParams.toString()}` : 
        '/elections';

      const response = await this.request(endpoint);
      return response.data.elections;
    } catch (error) {
      throw error;
    }
  }

  async getActiveElections() {
    try {
      const response = await this.request('/elections/active');
      return response.data.elections;
    } catch (error) {
      throw error;
    }
  }

  async getUpcomingElections() {
    try {
      const response = await this.request('/elections/upcoming');
      return response.data.elections;
    } catch (error) {
      throw error;
    }
  }

  async getCompletedElections() {
    try {
      const response = await this.request('/elections/completed');
      return response.data.elections;
    } catch (error) {
      throw error;
    }
  }

  async getElection(electionId) {
    try {
      const response = await this.request(`/elections/${electionId}`);
      return response.data.election;
    } catch (error) {
      throw error;
    }
  }

  async getElectionResults(electionId) {
    try {
      const response = await this.request(`/votes/election/${electionId}/results`);
      return response.data.election;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Voting methods
   */
  async castVote(electionId, candidateId, writeInData = null) {
    try {
      const voteData = {
        electionId,
        candidateId,
        ...writeInData
      };

      const response = await this.request('/votes/cast', {
        method: 'POST',
        body: JSON.stringify(voteData)
      });

      // Update user's voting history
      if (this.user) {
        this.user.votingInfo.totalVotesCast += 1;
        this.user.votingInfo.lastVoteDate = new Date();
        localStorage.setItem('user', JSON.stringify(this.user));
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  async getMyVotes() {
    try {
      const response = await this.request('/votes/my-votes');
      return response.data.votes;
    } catch (error) {
      throw error;
    }
  }

  async getVotingStats() {
    try {
      const response = await this.request('/votes/stats');
      return response.data.userStats;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Candidate methods
   */
  async getCandidates(electionId) {
    try {
      const response = await this.request(`/candidates/election/${electionId}`);
      return response.data.candidates;
    } catch (error) {
      throw error;
    }
  }

  async getCandidate(candidateId) {
    try {
      const response = await this.request(`/candidates/${candidateId}`);
      return response.data.candidate;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Admin methods
   */
  async createElection(electionData) {
    try {
      const response = await this.request('/elections', {
        method: 'POST',
        body: JSON.stringify(electionData)
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateElection(electionId, updateData) {
    try {
      const response = await this.request(`/elections/${electionId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async publishElection(electionId) {
    try {
      const response = await this.request(`/elections/${electionId}/publish`, {
        method: 'POST'
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async startElection(electionId) {
    try {
      const response = await this.request(`/elections/${electionId}/start`, {
        method: 'POST'
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async endElection(electionId) {
    try {
      const response = await this.request(`/elections/${electionId}/end`, {
        method: 'POST'
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async publishResults(electionId) {
    try {
      const response = await this.request(`/elections/${electionId}/publish-results`, {
        method: 'POST'
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Utility methods
   */
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  isAdmin() {
    return this.user && (this.user.role === 'admin' || this.user.role === 'super_admin');
  }

  canVote() {
    return this.user && this.user.isEligibleToVote;
  }

  hasVotedInElection(electionId) {
    // This would need to be implemented based on the election data
    return false;
  }

  getFirebaseErrorMessage(error) {
    const errorMessages = {
      'auth/user-not-found': 'User not found',
      'auth/wrong-password': 'Incorrect password',
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'User account is disabled',
      'auth/email-already-exists': 'Email address already exists',
      'auth/weak-password': 'Password is too weak',
      'auth/invalid-credential': 'Invalid credentials',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later',
      'auth/network-request-failed': 'Network error. Please check your connection',
      'auth/invalid-id-token': 'Invalid authentication token',
      'auth/id-token-expired': 'Authentication token has expired'
    };

    return errorMessages[error.code] || error.message || 'An error occurred';
  }

  /**
   * Real-time updates using Socket.IO
   */
  initializeSocket() {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO not loaded');
      return;
    }

    this.socket = io(this.baseURL.replace('/api', ''), {
      auth: {
        token: this.token
      }
    });

    this.socket.on('connect', () => {
      console.log('Connected to real-time updates');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from real-time updates');
    });

    this.socket.on('vote-updated', (data) => {
      this.handleVoteUpdate(data);
    });

    this.socket.on('election-status-updated', (data) => {
      this.handleElectionStatusUpdate(data);
    });

    this.socket.on('notification', (data) => {
      this.handleNotification(data);
    });

    return this.socket;
  }

  handleVoteUpdate(data) {
    // Emit custom event for vote updates
    window.dispatchEvent(new CustomEvent('voteUpdated', { detail: data }));
  }

  handleElectionStatusUpdate(data) {
    // Emit custom event for election status updates
    window.dispatchEvent(new CustomEvent('electionStatusUpdated', { detail: data }));
  }

  handleNotification(data) {
    // Show notification to user
    this.showNotification(data);
  }

  showNotification(data) {
    // Create and show notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
      <div class="notification-content">
        <h4>${data.title || 'Notification'}</h4>
        <p>${data.message}</p>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }
}

// Initialize global API instance
window.VoteSecureAPI = new VoteSecureAPI();
window.APIError = APIError;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VoteSecureAPI, APIError };
}
