# VoteSecure Online - Secure Voting Platform

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Backend Server**
   ```bash
   npm start
   ```
   The server will run on `http://localhost:5000`

3. **Open the Application**
   - Open `index.html` in your browser, or
   - Navigate to `http://localhost:5000`

### First Time Setup

#### Option 1: Manual Registration (Recommended)
1. Open `http://localhost:5000/pages/user_registration.html`
2. Register a new account
3. Login at `http://localhost:5000/pages/secure_login.html`

#### Option 2: Automated Seeding (Recommended)
While the server is running (`npm start`), open a new terminal and run:
```bash
node seed-via-api.js
```
This will automatically:
1. Create an Admin account (`admin@votesecure.com` / `admin123`)
2. Create a Voter account (`john.doe@email.com` / `voter123`)
3. Create sample elections (Active, Upcoming, and Ended)

#### Option 3: Manual Registration
1. Open `http://localhost:5000/pages/user_registration.html`
2. Register a new account
3. Login at `http://localhost:5000/pages/secure_login.html`

### Creating Elections (Admin Only)

1. Login as admin
2. Go to Admin Dashboard
3. Click "Create New Election"
4. Fill in election details and add candidates
5. Publish the election

## 📁 Project Structure

```
votesecure_online/
├── index.html              # Landing page
├── pages/                  # All application pages
│   ├── secure_login.html
│   ├── user_registration.html
│   ├── voter_dashboard.html
│   ├── admin_dashboard.html
│   ├── active_elections.html
│   ├── voting_interface.html
│   ├── vote_confirmation.html
│   ├── voting_history.html
│   ├── election_results.html
│   └── user_profile_management.html
├── js/                     # JavaScript files
│   ├── utils.js           # Utility functions & API helpers
│   └── active_elections.js
├── css/                    # Stylesheets
│   ├── input.css          # Tailwind source
│   ├── output.css         # Compiled CSS
│   ├── main.css
│   └── custom.css
├── server.js              # Express server
├── routes/                # API routes
│   ├── auth.js           # Authentication
│   ├── elections.js      # Election management
│   ├── votes.js          # Voting
│   ├── users.js          # User management
│   └── admin.js          # Admin functions
├── models/                # Database models
│   ├── User.js
│   ├── Election.js
│   ├── Candidate.js
│   ├── Vote.js
│   ├── AuditLog.js
│   ├── Session.js
│   └── index.js
├── middleware/            # Express middleware
│   └── authMiddleware.js
├── config/                # Configuration
│   └── database.js
└── data/                  # SQLite database (auto-created)
```

## 🔧 Development

### Build CSS (for development)
```bash
npm run build:css
```
This watches for changes in `css/input.css` and rebuilds `css/output.css`

### Environment Variables
Create a `.env` file in the root directory:

```env
PORT=5000
JWT_SECRET=your_super_secure_jwt_secret_key_change_in_production
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_key
NODE_ENV=development
# DATABASE_URL=postgres://user:password@localhost:5432/votesecure  # Optional: Use PostgreSQL
```

## 🎯 Features

### For Voters
- ✅ Secure registration and login
- ✅ View active elections
- ✅ Cast votes securely
- ✅ View voting history
- ✅ Digital vote confirmation receipts
- ✅ Profile management
- ✅ Two-factor authentication support

### For Administrators
- ✅ Create and manage elections
- ✅ Add candidates
- ✅ Monitor election statistics
- ✅ View real-time results
- ✅ User management
- ✅ Audit logs
- ✅ System health monitoring

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Helmet.js security headers
- SQL injection prevention (Sequelize ORM)
- XSS protection
- Audit logging
- Secure vote receipts

## 🐛 Troubleshooting

### "Cannot read property 'rate'" Error
This error comes from a browser extension (likely a VPN or ad blocker). It's not from your code. Try:
- Opening the site in Incognito/Private mode
- Disabling browser extensions temporarily

### "API_URL already declared" Error
This has been fixed. Make sure you're using the latest version of the files.

### Server Connection Refused
Make sure the backend server is running:
```bash
npm start
```

### Database Issues
The app uses SQLite by default (stored in `data/dev.sqlite`). To reset:
1. Stop the server
2. Delete the `data/dev.sqlite` file
3. Restart the server (it will recreate the database)

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (requires auth)

### Elections
- `GET /api/elections` - Get elections (query: ?status=active|upcoming|ended)
- `POST /api/elections` - Create election (admin only)
- `GET /api/elections/:id` - Get election details
- `POST /api/elections/vote` - Cast vote

### Admin
- `GET /api/admin/stats` - Get admin statistics
- `GET /api/admin/users` - Get users list
- `PATCH /api/admin/users/:id/status` - Update user status

### Users
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update profile
- `GET /api/users/voting-history` - Get voting history

## 🎨 UI/UX Features

- Modern glassmorphism design
- Dark mode optimized
- Responsive layout (mobile, tablet, desktop)
- Smooth animations and transitions
- Accessible (ARIA labels, keyboard navigation)
- Loading states and error handling

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

This is a demonstration project for a secure online voting system.

## 📄 License

MIT License

---

**Note**: This is a demonstration project. For production use, additional security measures, penetration testing, and compliance with electoral regulations would be required.
