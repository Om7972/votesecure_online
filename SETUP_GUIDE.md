# VoteSecure Online - Setup Guide

## Quick Start Guide

This guide will help you start your backend server and database to connect with the frontend.

---

## Prerequisites

1. **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
2. **PostgreSQL** (v12 or higher) - [Download here](https://www.postgresql.org/download/)

---

## Step 1: Install Dependencies

If you haven't already installed the Node.js dependencies, run:

```bash
npm install
```

---

## Step 2: Start PostgreSQL Database

### Option A: Using PostgreSQL Service (Windows)

1. **Start PostgreSQL Service:**
   - Press `Win + R`, type `services.msc`, and press Enter
   - Find "postgresql-x64-XX" (where XX is your version number)
   - Right-click and select "Start"

   OR use PowerShell (as Administrator):
   ```powershell
   Start-Service postgresql-x64-18
   ```
   (Replace `14` with your PostgreSQL version number)

2. **Verify PostgreSQL is running:**
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

### Option B: Using pg_ctl (if service is not configured)

```bash
# Navigate to PostgreSQL bin directory (adjust path as needed)
cd "C:\Program Files\PostgreSQL\14\bin"

# Start PostgreSQL
pg_ctl -D "C:\Program Files\PostgreSQL\14\data" start
```

---

## Step 3: Create the Database

1. **Connect to PostgreSQL:**
   ```bash
   psql -U postgres
   ```

2. **Create the database:**
   ```sql
   CREATE DATABASE votesecure;
   ```

3. **Verify the database was created:**
   ```sql
   \l
   ```
   (You should see `votesecure` in the list)

4. **Exit PostgreSQL:**
   ```sql
   \q
   ```

---

## Step 4: Verify Database Connection Settings

Check your `.env` file to ensure the database connection string is correct:

```env
DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/votesecure
```

**Important:** 
- Replace `password` with your actual PostgreSQL password if different
- If your PostgreSQL is on a different port (default is 5432), update the port number
- If your username is not `postgres`, update it accordingly

---

## Step 5: Start the Backend Server

### Option A: Development Mode (with auto-reload)

```bash
npm run dev
```

**Note:** This requires `nodemon`. If you get an error, install it:
```bash
npm install -g nodemon
# OR
npm install --save-dev nodemon
```

### Option B: Production Mode

```bash
npm start
```

---

## Step 6: Verify Everything is Running

1. **Check the console output.** You should see:
   ```
   Connection to PostgreSQL has been established successfully.
   Database synced
   Server running on http://localhost:5000
   ```

2. **Test the API endpoint:**
   Open your browser and go to: `http://localhost:5000`
   You should see the application or a response.

3. **Test the API directly:**
   ```bash
   curl http://localhost:5000/api/auth/register
   ```
   (This might return an error, but it confirms the server is running)

---

## Step 7: Open Your Frontend

1. Open `user_registration.html` in your browser
2. The frontend should now be able to connect to the backend at `http://localhost:5000/api`

---

## Troubleshooting

### Error: "Unable to connect to the database"

**Solutions:**
1. Verify PostgreSQL is running (Step 2)
2. Check your `.env` file has the correct `DATABASE_URL`
3. Verify the database `votesecure` exists (Step 3)
4. Check if PostgreSQL password is correct
5. Try connecting manually: `psql -U postgres -d votesecure`

### Error: "Port 5000 already in use"

**Solutions:**
1. Find what's using port 5000:
   ```powershell
   netstat -ano | findstr :5000
   ```
2. Kill the process or change the port in `.env`:
   ```env
   PORT=5001
   ```
3. Update `js/utils.js` to use the new port if needed

### Error: "ERR_CONNECTION_REFUSED" in browser

**Solutions:**
1. Make sure the backend server is running (Step 5)
2. Check the server console for errors
3. Verify the server is listening on `http://localhost:5000`
4. Check Windows Firewall isn't blocking port 5000

### Error: "Module not found" or missing dependencies

**Solution:**
```bash
npm install
```

---

## Quick Command Reference

```bash
# Install dependencies
npm install

# Start PostgreSQL (Windows Service)
Start-Service postgresql-x64-14

# Create database
psql -U postgres -c "CREATE DATABASE votesecure;"

# Start backend (development)
npm run dev

# Start backend (production)
npm start
```

---

## Next Steps

Once everything is running:
1. The database tables will be automatically created when the server starts
2. You can now register users through the frontend
3. Check the server console for any errors or logs

---

## Need Help?

- Check the server console for detailed error messages
- Verify all environment variables in `.env` are correct
- Ensure PostgreSQL is accessible and the database exists
- Make sure no firewall is blocking port 5000
