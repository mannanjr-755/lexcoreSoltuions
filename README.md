# Lexcore Solutions ERP + CRM

Premium enterprise ERP/CRM with Super Admin authentication, live MongoDB dashboard, CRM, profile, settings, activity logs, and notifications.

## Quick Start

1. Ensure `.env.local` exists with your MongoDB Atlas URI, JWT secrets, Super Admin credentials, and SMTP settings (see `.env.example`).
2. Install dependencies: `npm install`
3. Start: `npm run dev`
4. Seed Super Admin once: `POST /api/setup/seed` (uses `SUPER_ADMIN_*` from `.env.local`)
5. Login at `/login`

Health check: `GET /api/health`

## Implemented Features

### Authentication (Super Admin Only)
- Login with JWT + HTTP-only cookies
- Logout
- Change password (backend validated)
- Forgot password with real SMTP OTP email
- Reset password with OTP verification
- Remember Me
- Account lockout after 5 failed attempts (30 min)
- Login history (IP, browser, user agent)
- Last login time tracking
- No public registration

### Admin Dashboard
- Live MongoDB aggregations for customers, projects, revenue, expenses, profit
- Revenue analytics charts (Recharts)
- Monthly reports
- Recent activities
- Upcoming deadlines
- Latest payments
- Auto-refresh every 60s

### Profile Management
- Update name, phone, company, designation, address, photo URL
- Change password
- Last login info

### System Settings
- Company profile, SMTP, currency, timezone, language, theme
- Security settings (session timeout, lockout rules)
- Stored in MongoDB

### CRM Customers
- List with live financial rollups
- Unique Customer ID generation
- Payment calculations
- Activity logging + notifications on create

### Security
- bcrypt password hashing
- JWT HTTP-only cookies
- Rate limiting on auth routes
- XSS/CSRF headers via middleware
- RBAC permission system (future roles ready)
- Activity audit logs

### UI
- Premium dark + gold theme (#09090B / #F4B400)
- Space Grotesk + Inter fonts
- Framer Motion animations
- Glassmorphism cards
- Responsive layout
- Global search
- Notification bell

## Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Production server
- `npm run typecheck` - TypeScript check
- `npm run lint` - ESLint
- `npm run seed` - Seed Super Admin (server must be running)

## Deploy (Vercel + MongoDB Atlas)

1. Set all env vars from `.env.example` in Vercel dashboard
2. Deploy: `vercel --prod`
3. Run seed once: `POST https://your-app.vercel.app/api/setup/seed`
4. Configure SMTP for password reset emails

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Super Admin login |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Current user |
| `/api/auth/change-password` | POST | Change password |
| `/api/auth/forgot-password` | POST | Send OTP email |
| `/api/auth/verify-otp` | POST | Verify OTP |
| `/api/auth/reset-password` | POST | Reset password |
| `/api/dashboard/stats` | GET | Dashboard data |
| `/api/profile` | GET/PATCH | Profile |
| `/api/settings` | GET/PATCH | System settings |
| `/api/notifications` | GET/PATCH/DELETE | Notifications |
| `/api/activity-logs` | GET | Activity logs |
| `/api/search` | GET | Global search |
| `/api/crm/customers` | GET/POST | CRM customers |
| `/api/setup/seed` | POST | One-time Super Admin seed |
