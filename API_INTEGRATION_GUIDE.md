# VoteSecure Online - API & Backend Integration Guide

## 1. Backend Structure
Your backend is built with **Express.js** and **Sequelize** (supporting both Postgres and SQLite).

- **Server Entry**: `server.js` initializes the app, middleware (CORS, Helmet), and routes.
- **Database Config**: `config/database.js` handles the connection. It defaults to a local SQLite file (`data/dev.sqlite`) if `DATABASE_URL` is not found in `.env`.
- **Routes**: Located in `routes/`.
  - `/api/auth`: Login, Register, Logout
  - `/api/elections`: Manage elections
  - `/api/votes`: Cast votes

## 2. Connecting Frontend to Backend
Since you are using vanilla JavaScript, you should use the `fetch` API to communicate with your backend.

### Example: User Registration
**File**: `js/register.js` (example)

```javascript
const registerUser = async (userData) => {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Registration successful:', data);
            window.location.href = '/pages/secure_login.html';
        } else {
            console.error('Registration failed:', data.message);
            alert(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An network error occurred.');
    }
};
```

## 3. Environment Variables (.env)
Your `.env` file is crucial for security and configuration.
- **DATABASE_URL**: (Optional) Connection string for PostgreSQL. If commented out, SQLite is used.
- **JWT_SECRET**: Key for signing authentication tokens.
- **NODE_ENV**: Set to `production` when deploying.

## 4. Resolving Common Issues
- **Tailwind CDN**: We have migrated to a build process. Use `npm run build:css` to generate styles.
- **"Rate" Error**: The error `TypeError: Cannot destructure property 'rate' ...` in `contentScript.js` usually comes from a **browser extension** (like a VPN or ad blocker). It is likely not part of your code. Try running in Incognito mode to confirm.

## 5. Next Steps
1.  **Frontend Logic**: Ensure all forms in `pages/*.html` have corresponding event listeners in `js/` that call the API endpoints.
2.  **Authentication**: Store the JWT token received from `/api/auth/login` in `localStorage` or `cookies` to include in subsequent requests.

```javascript
// Example: Attaching Token
const token = localStorage.getItem('token');
fetch('/api/protected-route', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```
