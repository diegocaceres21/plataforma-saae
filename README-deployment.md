# Deployment Guide - Fixing "Error invoking remote method" Issue

## Problem

When deploying the .exe to another machine, you get "Error loading data. Error invoking remote method, Aggregate error" because the app tries to connect to a local PostgreSQL database that doesn't exist on the target machine.

## Solution

The app has been updated to use environment variables for database configuration.

## Deployment Steps

### 1. Configure Database Connection

Create a `.env` file in the **same directory as the .exe file** on the target machine:

```env
# Database Configuration
DB_HOST=your-database-host
DB_PORT=5432
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=saae
DB_SSL=false

# Application Configuration
NODE_ENV=production
UPDATER_ALLOW_PRERELEASE=0
```

**Important:** Replace the values with your actual database connection details:
- `DB_HOST`: Database server address (e.g., `192.168.1.100`, `db.yourcompany.com`)
- `DB_USER`: PostgreSQL username
- `DB_PASSWORD`: PostgreSQL password
- `DB_NAME`: Database name (default: `saae`)

### 2. Deployment Options

#### Option A: Remote Database (Recommended)
- Host PostgreSQL on a central server accessible to all machines
- Update `.env` file with the server's IP/hostname
- Ensure firewall allows PostgreSQL connections (port 5432)

#### Option B: Local Database on Each Machine
- Install PostgreSQL on each target machine
- Restore the database from backup
- Use `localhost` in the `.env` file

### 3. Build the Application

Before building:

1. **Copy `.env.example` to `.env`** in the project root
2. Update `.env` with your default/development database settings
3. Run the build command:

```bash
npm run electron:build
```

### 4. Distribute the Application

When distributing the installer to other machines:

1. **Send the .exe installer**
2. **Include a `.env.example` file** with instructions
3. **Instruct users to:**
   - Copy `.env.example` to `.env`
   - Update database credentials
   - Place `.env` file next to the installed executable

### 5. Verify Installation

After installation on the target machine, check:

1. `.env` file exists in: `C:\Users\<Username>\AppData\Local\Programs\plataforma-saae\resources\.env`
2. Database credentials are correct
3. Network connectivity to database server

## Troubleshooting

### Still getting connection errors?

1. **Check database connectivity:**
   ```bash
   psql -h DB_HOST -U DB_USER -d DB_NAME
   ```

2. **Verify PostgreSQL is running:**
   - Service name: `postgresql-x64-XX`
   - Port: 5432 (default)

3. **Check firewall settings:**
   - Allow incoming connections on port 5432
   - Windows Firewall and network firewalls

4. **Verify `.env` file location:**
   - Development: Project root
   - Production: `process.resourcesPath` (automatically handled)

### Check application logs:

Electron logs are saved to:
- Windows: `%USERPROFILE%\AppData\Roaming\plataforma-saae\logs\`

Look for connection errors or database-related messages.

## Security Notes

- **Never commit `.env` to version control** (already in `.gitignore`)
- **Use strong database passwords** in production
- **Consider using SSL connections** for remote databases (`DB_SSL=true`)
- **Restrict database user permissions** to only what's needed

## Alternative: Packaged Database (Optional)

If you need a fully portable solution with no external database:

1. Consider switching from PostgreSQL to SQLite
2. Package the SQLite database file with the app
3. Store in app data directory

Let me know if you need help implementing this option.
