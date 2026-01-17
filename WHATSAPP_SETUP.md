# Daily LeetCode Email Notifications

This GitHub Action sends you a random LeetCode problem via email every day at 7 AM.

## Features

- 📧 Sends a beautifully formatted HTML email daily with:
  - Problem description with metadata
  - Solution code with syntax highlighting
- 🎲 Randomly selects from your synced LeetCode problems
- 🔄 Avoids repeating problems for 10 days
- ⏰ Runs automatically at 7 AM daily
- 📊 Tracks problem history to ensure variety

## Setup

### 1. Set up SMTP Email

You can use any SMTP email provider:

#### Gmail (Recommended)
1. Enable 2-factor authentication on your Google account
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use these settings:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - User: Your Gmail address
   - Pass: The generated app password

#### Other Providers
- **Outlook/Hotmail**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **SendGrid**: `smtp.sendgrid.net:587`
- **Mailgun**: `smtp.mailgun.org:587`

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `SMTP_HOST`: Your SMTP server host (e.g., `smtp.gmail.com`)
- `SMTP_PORT`: SMTP port (usually `587` or `465`)
- `SMTP_USER`: Your email address
- `SMTP_PASS`: Your email password or app password
- `EMAIL_FROM`: Sender email address (usually same as SMTP_USER)
- `EMAIL_TO`: Recipient email address (where you want to receive problems)
- `LEETCODE_REPO`: Your solutions repository (format: `username/repo-name`)
- `GH_PAT`: GitHub Personal Access Token with `repo` permissions

### 3. Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope (full control of private repositories)
3. Copy the token and add it as `GH_PAT` secret

### 4. Adjust Timezone (Optional)

The workflow runs at 7 AM UTC by default. To change the time:

Edit [.github/workflows/daily-leetcode.yml](.github/workflows/daily-leetcode.yml):

```yaml
schedule:
  - cron: '0 7 * * *'  # Change hour (0-23 in UTC)
```

For example:
- `'0 14 * * *'` = 7 AM PST (UTC-7)
- `'0 12 * * *'` = 7 AM EST (UTC-5)
- `'30 6 * * *'` = 6:30 AM UTC

### 5. Enable GitHub Actions

1. Push these files to your repository
2. Go to Actions tab and enable workflows
3. The action will run automatically at the scheduled time
4. You can also trigger it manually using "Run workflow" button

## Testing

To test the setup without waiting for the scheduled run:

1. Go to Actions tab in GitHub
2. Select "Daily LeetCode WhatsApp" workflow
3. Click "Run workflow" → "Run workflow"
4. Check the logs for any errors

Or run locally:

```bash
cd scripts
npm install

# Set environment variables
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-app-password"
export EMAIL_FROM="your-email@gmail.com"
export EMAIL_TO="recipient@example.com"

# Run the script
node daily-leetcode.js
```

## Configuration

### Change Repeat Delay

To change how many days before a problem can be sent again, edit [scripts/daily-leetcode.js](scripts/daily-leetcode.js):

```javascript
const DAYS_BEFORE_REPEAT = 10; // Change this number
```

Email includes:
- Difficulty emoji and color coding (🟢 Easy, 🟡 Medium, 🔴 Hard)
- Problem title
- Description
- Topics/tags
- Solution code with syntax highlighting
- Beautiful HTML formatting for easy reading

## Files

- `.github/workflows/daily-leetcode.yml` - GitHub Actions workflow
- `scripts/daily-leetcode.js` - Main script
- `scripts/package.json` - Node.js dependencies
- `scripts/problem-history.json` - Tracks sent problems (auto-updated)

## Troubleshooting

### Email not received

1. Check spam/junk folder
2. Verify SMTP credentials are correct
3. For Gmail, ensure app password is used (not regular password)
4. Check GitHub Actions logs for errors
5. Verify email addresses are correctour number is connected
2. Check phone number format includes `whatsapp:` prefix
3. Review GitHub Actions logs for errors

### "No problems found" error

1. Ensure `LEETCODE_REPO` points to correct repository
2. Verify `index.json` exists in solutions repository root
3. Check `GH_PAT` has access to the repository

### Schedule not running

1. Ensure GitHub Actions is enabled in repository settings
**Completely Free!** 
- No costs when using Gmail or other free SMTP providers
- GitHub Actions is free for public repositories
- No ongoing fees or subscriptions required
- US: ~$0.005 per message
- Daily cost: ~$0.01 (2 messages/day)
- Monthly: ~$0.30

See [Twilio WhatsApp Pricing](https://www.twilio.com/whatsapp/pricing) for your region.

## Privacy
Email sent via standard SMTP (secure connection)
- GitHub secrets are encrypted
- Problem history is stored in your repository only
- No data is shared with third parties
- Works with any email provider you trustpository only
- No data is shared with third parties

## License

Part of BetterLeetSync project.
