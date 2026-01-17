# BetterLeetSync

A complete LeetCode solution management system that automatically syncs your solutions to GitHub with proper organization, and sends you daily problem reminders via email.

## 🎯 What It Does

1. **Auto-sync solutions** - Click a button on LeetCode to instantly push your solution to GitHub
2. **Organized structure** - Automatically organizes by difficulty (easy/medium/hard) with metadata tracking
3. **Daily reminders** - Get a random LeetCode problem in your inbox every morning at 7 AM
4. **Smart tracking** - Maintains an index of all problems and avoids repeating problems for 10 days

---

## 🚀 How to Use

### Syncing Solutions (Extension)

1. **Go to any LeetCode problem**
   - Example: https://leetcode.com/problems/two-sum/

2. **Write your solution** in the code editor

3. **Click the purple 📤 Sync button**
   - The button appears on the problem page after loading
   - Usually near the Submit button or floating at bottom-right

4. **Check your GitHub repo**
   - Your solution is automatically committed with proper metadata
   - View at: `https://github.com/YOUR_USERNAME/YOUR_REPO`

**What gets synced:**
- ✅ Problem description with examples and constraints
- ✅ Your complete solution code
- ✅ Metadata (difficulty, topics, date solved)
- ✅ Organized in `difficulty/problem-slug/solution.ext` structure
- ✅ Updated `index.json` with all problem metadata

### Daily Email Reminders

Every day at 7 AM, you'll receive a beautifully formatted email with:
- 🎯 A random problem from your synced solutions
- 📝 Full problem description and constraints
- 💻 Solution code with syntax highlighting
- 🏷️ Difficulty level and topic tags

No action needed - just check your email!

---

## 📦 Complete Setup Guide

### Prerequisites

- Node.js 16+ installed
- GitHub account
- Chrome browser
- Email account (Gmail recommended for SMTP)

---

### Part 1: Backend Server Setup

The backend server handles syncing solutions to GitHub.

#### 1. Clone and Install

```bash
git clone https://github.com/Pabsthegreat/BetterLeetSync.git
cd BetterLeetSync/backend
npm install
```

#### 2. Create GitHub Personal Access Token

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Click **"Generate new token (classic)"**
3. Give it a name: `LeetCode Sync`
4. Select scopes: **`repo`** (full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token** (starts with `ghp_...`)

#### 3. Create Solutions Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `Leetcode` or `LeetCode-Solutions`)
3. Choose **Public** or **Private**
4. **Don't** initialize with README
5. Click **"Create repository"**

#### 4. Configure Backend

Create `backend/.env` file:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your details:

```env
GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE
GITHUB_OWNER=your-github-username
GITHUB_REPO=Leetcode
HMAC_SECRET=your-random-secret-string-min-32-chars
PORT=3456
```

**Important:** Make `HMAC_SECRET` a long random string (32+ characters). Save it - you'll need it for the extension!

#### 5. Start the Server

```bash
node server.js
```

You should see: `Server running on http://localhost:3456`

**Keep this terminal running** while using the extension.

---

### Part 1B: Cloud Deployment (Railway) - Optional but Recommended

Instead of running the server locally, deploy to Railway for 24/7 availability. **Free tier available!**

#### Why Deploy to Cloud?
- ✅ No need to keep your computer running
- ✅ Access from anywhere
- ✅ More reliable syncing
- ✅ Free tier: 500 hours/month ($5 credit)

#### Step-by-Step Railway Deployment

**1. Sign Up for Railway**
   - Go to [railway.app](https://railway.app)
   - Click **"Login with GitHub"**
   - Authorize Railway to access your repos

**2. Create New Project**
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Choose your **BetterLeetSync** repository
   - Railway will detect it's a Node.js app

**3. Add Environment Variables**
   - After deployment starts, click on your service
   - Go to **"Variables"** tab
   - Click **"New Variable"** and add these **one by one**:

   ```
   Variable Name: GITHUB_TOKEN
   Value: ghp_YOUR_TOKEN_HERE
   
   Variable Name: GITHUB_OWNER
   Value: your-github-username
   
   Variable Name: GITHUB_REPO
   Value: Leetcode
   
   Variable Name: HMAC_SECRET
   Value: your-random-secret-string-min-32-chars
   ```

   **Important:** Do **not** set `PORT=3456` (or any fixed port) in Railway. Railway injects its own `PORT`, and overriding it can prevent the app from starting.

   - Railway will automatically redeploy after adding variables (~30 seconds)

**4. Get Your Public URL**
   - Click on your service in Railway
   - Look for the **"Settings"** tab
   - Find **"Networking"** section
   - Click **"Generate Domain"** if no domain exists
   - Copy the URL (e.g., `https://betterleetsync-production.up.railway.app`)

**5. Verify Deployment**
   - Open in browser: `https://your-railway-url/health`
   - Should see: `{"status":"ok","configured":true}`
   - If shows `"configured":false`, check your environment variables

**6. Update Extension Settings**
   - Instead of `http://localhost:3456`
   - Use: `https://your-railway-url` (include `https://`)
   - Make sure HMAC Secret matches what you set in Railway
   - Click **"Save Settings"**

**That's it!** Your backend is now running 24/7 in the cloud.

#### Railway Tips

- **Free Tier Limits**: 500 hours/month, 1GB outbound bandwidth
- **Your Usage**: ~10-100 requests/month (well within free tier)
- **Monitoring**: View logs in Railway dashboard → Deployments tab
- **Updates**: Push to GitHub → Railway auto-deploys new changes
- **Sleeping**: Railway may sleep after inactivity, wakes up automatically on first request

---

### Part 2: Chrome Extension Setup

#### 1. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `extension/` folder from this project
5. Extension icon should appear in your toolbar

#### 2. Configure Extension

1. Click the extension icon in Chrome toolbar
2. Click **"Options"** or right-click → **"Options"**
3. Enter settings:
   - **Backend URL**: 
     - Local: `http://localhost:3456`
     - Railway: `https://your-railway-url` (from Part 1B)
   - **HMAC Secret**: The same secret from backend `.env` or Railway variables
4. Click **"Save Settings"**
5. Click **"Test Connection"** - should show "Connected!"

#### 3. Test the Extension

1. Go to https://leetcode.com/problems/two-sum/
2. Write a simple solution in any language
3. Look for the **📤 Sync** button on the page
4. Click it - you should see a success message
5. Check your GitHub repo - the solution should be there!

---

### Part 3: Daily Email Setup (Optional)

Get random LeetCode problems in your inbox every morning!

#### 1. Set Up SMTP Email

**For Gmail (Recommended):**

1. Enable 2-Factor Authentication on your Google account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"
4. **Save the 16-character password** (e.g., `abcd efgh ijkl mnop`)

**For other providers:**
- Outlook: `smtp-mail.outlook.com:587`
- Yahoo: `smtp.mail.yahoo.com:587`
- SendGrid, Mailgun, etc. also work

#### 2. Configure GitHub Secrets

1. Go to your **BetterLeetSync** repository (this one)
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add these:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `SMTP_HOST` | SMTP server address | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | Your email address | `you@gmail.com` |
| `SMTP_PASS` | Email app password | `abcd efgh ijkl mnop` |
| `EMAIL_FROM` | Sender email | `you@gmail.com` |
| `EMAIL_TO` | Where to receive emails | `you@gmail.com` |
| `LEETCODE_REPO` | Your solutions repo | `username/Leetcode` |
| `GH_PAT` | GitHub token (from Part 1) | `ghp_...` |

#### 3. Enable GitHub Actions

1. Go to the **Actions** tab in this repository
2. Enable workflows if prompted
3. The workflow runs automatically at 7 AM daily
4. To test now: Click **"Daily LeetCode Email"** → **"Run workflow"**

#### 4. Adjust Time Zone (Optional)

By default, emails send at 7 AM UTC. To change:

Edit `.github/workflows/daily-leetcode.yml`:

```yaml
schedule:
  - cron: '0 14 * * *'  # 7 AM PST (UTC-7)
```

Timezone reference:
- `'0 7 * * *'` = 7 AM UTC
- `'0 12 * * *'` = 7 AM EST (UTC-5)
- `'0 14 * * *'` = 7 AM PST (UTC-7)
- `'30 6 * * *'` = 6:30 AM UTC

---

## 📁 Repository Structure

```
BetterLeetSync/
├── backend/              # Node.js server
│   ├── server.js        # Main backend logic
│   ├── package.json     # Dependencies
│   └── .env.example     # Config template
├── extension/           # Chrome extension
│   ├── manifest.json    # Extension manifest
│   ├── content.js       # Page interaction
│   ├── popup.js         # Extension popup
│   └── options.js       # Settings page
├── scripts/             # Daily email system
│   ├── daily-leetcode.js
│   ├── package.json
│   └── problem-history.json
├── .github/workflows/   # GitHub Actions
│   └── daily-leetcode.yml
└── README.md           # This file
```

**Your Solutions Repository Structure:**
```
Leetcode/
├── index.json          # Metadata index
├── easy/
│   ├── two-sum/
│   │   └── solution.py
│   └── valid-parentheses/
│       └── solution.js
├── medium/
│   └── add-two-numbers/
│       └── solution.cpp
└── hard/
    └── median-of-two-sorted-arrays/
        └── solution.java
```

---

## 🔧 Troubleshooting

### Extension Issues

**Sync button not appearing:**
- Ensure you're on a problem page (`/problems/...`)
- Refresh the page
- Check browser console for errors (F12)

**Sync fails with authentication error:**
- Verify HMAC secret matches between extension and backend
- Check backend server is running on `localhost:3456`

**404 Error:**
- Ensure backend URL in extension settings is correct
- Include `https://` for Railway, `http://` for localhost
- Backend must be running (check Railway logs or local terminal)

### Backend Issues

**Server won't start:**
```bash
# Check if port is in use
lsof -i :3456
# Kill existing process
pkill -f "node server.js"
```

**GitHub push fails:**
- Verify `GITHUB_TOKEN` has `repo` scope
- Ensure repository exists and you have write access
- Check `GITHUB_OWNER` and `GITHUB_REPO` are correct

### Email Issues

**Not receiving emails:**
- Check spam/junk folder
- Verify SMTP credentials in GitHub secrets
- For Gmail, ensure app password is used (not regular password)
- Check GitHub Actions logs for errors

**Workflow not running:**
- Go to Actions tab → Enable workflows
- Repository must have activity (at least one commit) for scheduled runs

**"No problems found" error:**
- Ensure your solutions repository has `index.json`
- Sync at least one problem first
- Check `LEETCODE_REPO` secret format: `username/repo-name`

---

## 🎨 Features

### Solution File Format

Each solution file contains:

```python
"""
[Description]
Two Sum

Given an array of integers nums and an integer target, return indices...

[Examples]
Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]

[Constraints]
- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9

[Metadata]
Difficulty: Easy
Topics: Array, Hash Table
Source: https://leetcode.com/problems/two-sum/
Date Solved: 2026-01-17

[Solution]
"""

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # Your code here
```

### Email Features

- 🎨 Beautiful HTML formatting
- 📱 Mobile-responsive design
- 🎯 Color-coded difficulty badges
- 💻 Syntax-highlighted code
- 🏷️ Topic tags included
- 📅 Date stamp on each email

### Privacy & Security

- ✅ Backend never logs into LeetCode
- ✅ Extension never stores GitHub token
- ✅ HMAC authentication between extension and backend
- ✅ GitHub secrets are encrypted
- ✅ All data stays in your repositories
- ✅ No third-party analytics or tracking

---

## 💰 Cost

**Completely Free!**
- ✅ GitHub Actions free for public repos
- ✅ Gmail SMTP is free
- ✅ Railway free tier: 500 hours/month (more than enough)
- ✅ No subscriptions or paid services required
- ✅ Optional: Self-hosted backend (runs on your machine)

---

## 🤝 Contributing

Found a bug or have a feature request? Open an issue or submit a pull request!

---

## 📄 License

MIT License - feel free to use and modify!

---

## 🙏 Acknowledgments

Built to help developers maintain their LeetCode progress on GitHub and stay consistent with daily practice.

Happy coding! 🚀
