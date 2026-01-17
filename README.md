# BetterLeetSync

Sync your LeetCode solutions to GitHub automatically.

## Setup Complete ✅

Your extension is installed and connected to the backend!

## How to Use

### 1. Go to Any LeetCode Problem
Visit any problem, for example:
- https://leetcode.com/problems/two-sum/
- https://leetcode.com/problems/add-two-numbers/
- https://leetcode.com/problems/reverse-integer/

### 2. Write Your Solution
Write or paste your solution in the code editor.

### 3. Click the Sync Button
Look for the purple **📤 Sync** button that appears on the page (usually near the Submit button or floating at the bottom-right).

### 4. Check Your GitHub Repo
After syncing, check your repo at:
https://github.com/Pabsthegreat/Leetcode

You should see:
- `index.json` - Metadata index of all synced problems
- Solution files in folders like:
  - `easy/two-sum/solution.py`
  - `medium/add-two-numbers/solution.js`
  - `hard/median-of-two-sorted-arrays/solution.cpp`

## File Structure

Solutions are organized by difficulty:
```
Leetcode/
├── index.json           # Index of all problems
├── easy/
│   └── problem-slug/
│       └── solution.ext
├── medium/
│   └── problem-slug/
│       └── solution.ext
└── hard/
    └── problem-slug/
        └── solution.ext
```

## Troubleshooting

### Sync Button Not Appearing
1. Make sure you're on a problem page (URL should be `/problems/...`)
2. Wait for the page to fully load
3. Refresh the page if needed

### Sync Fails
1. Check that backend server is running: `cd backend && node server.js`
2. Verify extension settings have the correct HMAC secret
3. Check that your GitHub token has `repo` scope
4. Ensure the GitHub repository exists

### Backend Configuration
Backend is configured in `backend/.env`:
- GitHub Token: Set ✅
- GitHub Owner: Pabsthegreat ✅
- GitHub Repo: Leetcode ✅
- HMAC Secret: Set ✅

### Extension Configuration
Extension settings should match:
- Backend URL: `http://localhost:3456` ✅
- HMAC Secret: `leetcodeverylongsectretthatissecure12345` ✅

## Test Now!

1. Open https://leetcode.com/problems/two-sum/
2. Write a simple solution in the editor
3. Look for the **📤 Sync** button
4. Click it and watch your repo update!
