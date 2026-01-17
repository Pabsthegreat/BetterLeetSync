const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Configuration
const SOLUTIONS_PATH = path.join(__dirname, '../../solutions');
const HISTORY_FILE = path.join(__dirname, 'problem-history.json');
const DAYS_BEFORE_REPEAT = 10;

// SMTP configuration
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM;
const emailTo = process.env.EMAIL_TO;

// Validate environment variables
if (!smtpHost || !smtpUser || !smtpPass || !emailFrom || !emailTo) {
  console.error('Missing required environment variables');
  console.error('Required: SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO');
  process.exit(1);
}

// Create email transporter
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort == 465, // true for 465, false for other ports
  auth: {
    user: smtpUser,
    pass: smtpPass
  }
});

// Load problem history
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return { sent: [] };
  }
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading history:', error);
    return { sent: [] };
  }
}

// Save problem history
function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Load index.json from solutions repository
function loadIndex() {
  const indexPath = path.join(SOLUTIONS_PATH, 'index.json');
  if (!fs.existsSync(indexPath)) {
    throw new Error('index.json not found in solutions repository');
  }
  const data = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(data);
}

// Get problems that haven't been sent in the last N days
function getAvailableProblems(allProblems, history) {
  const now = Date.now();
  const cutoffTime = now - (DAYS_BEFORE_REPEAT * 24 * 60 * 60 * 1000);
  
  // Filter out recently sent problems
  const recentSlugs = new Set(
    history.sent
      .filter(entry => new Date(entry.sent_at).getTime() > cutoffTime)
      .map(entry => entry.slug)
  );
  
  return allProblems.items.filter(problem => !recentSlugs.has(problem.slug));
}

// Parse solution file to extract description and code
function parseSolutionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find the [Solution] marker
  const solutionMarkerIndex = content.indexOf('[Solution]');
  
  if (solutionMarkerIndex === -1) {
    // Fallback: try to find code by looking for common patterns
    return {
      description: content.substring(0, Math.min(1000, content.length)),
      code: content
    };
  }
  
  // Everything before [Solution] is description
  let description = content.substring(0, solutionMarkerIndex).trim();
  
  // Remove comment markers from description
  description = description
    .replace(/^\/\*\*/gm, '')
    .replace(/^\*\//gm, '')
    .replace(/^\* ?/gm, '')
    .replace(/^"""/gm, '')
    .replace(/^'''/gm, '')
    .trim();
  
  // Everything after [Solution] is code
  let code = content.substring(solutionMarkerIndex + '[Solution]'.length).trim();
  
  return { description, code };
}

// Format HTML email content
function formatEmailHTML(problem, description, code) {
  const emoji = {
    'Easy': '🟢',
    'Medium': '🟡',
    'Hard': '🔴'
  };
  
  const difficultyEmoji = emoji[problem.difficulty] || '';
  const difficultyColor = {
    'Easy': '#00b8a3',
    'Medium': '#ffc01e',
    'Hard': '#ef4743'
  };
  const color = difficultyColor[problem.difficulty] || '#666';
  
  const topics = problem.topics && problem.topics.length > 0 
    ? `<p style="color: #666; font-size: 14px;">🏷️ ${problem.topics.join(', ')}</p>` 
    : '';
  
  // Escape HTML in description and code
  const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  const descHtml = escapeHtml(description).replace(/\n/g, '<br>');
  const codeHtml = escapeHtml(code);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily LeetCode Problem</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 20px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px;">📚 Daily LeetCode Challenge</h1>
              <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </td>
          </tr>
          
          <!-- Problem Title -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <h2 style="margin: 0; font-size: 22px; color: #1a1a1a;">
                ${difficultyEmoji} ${problem.name}
              </h2>
              <p style="margin: 10px 0 0 0; font-size: 14px;">
                <span style="background-color: ${color}; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 500;">${problem.difficulty}</span>
              </p>
              ${topics}
            </td>
          </tr>
          
          <!-- Problem Description -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #1a1a1a; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">📝 Problem Description</h3>
              <div style="color: #333; line-height: 1.6; font-size: 14px;">
                ${descHtml}
              </div>
            </td>
          </tr>
          
          <!-- Solution Code -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #1a1a1a; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">💻 Solution</h3>
              <div style="background-color: #f8f8f8; border-radius: 6px; padding: 15px; overflow-x: auto;">
                <pre style="margin: 0; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.5; color: #333; white-space: pre-wrap; word-wrap: break-word;"><code>${codeHtml}</code></pre>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #666; font-size: 13px;">Keep practicing and stay consistent! 🚀</p>
              <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">Sent by BetterLeetSync</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Send email
async function sendEmail(problem, description, code) {
  try {
    const htmlContent = formatEmailHTML(problem, description, code);
    
    const mailOptions = {
      from: {
        name: 'LeetCode Daily',
        address: emailFrom
      },
      to: emailTo,
      subject: `🎯 Daily LeetCode: ${problem.name} (${problem.difficulty})`,
      html: htmlContent,
      text: `${problem.name}\n\nDifficulty: ${problem.difficulty}\n\n${description}\n\n--- Solution ---\n\n${code}`
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('Loading problem index...');
    const index = loadIndex();
    
    if (!index.items || index.items.length === 0) {
      console.error('No problems found in index.json');
      process.exit(1);
    }
    
    console.log(`Found ${index.items.length} total problems`);
    
    console.log('Loading history...');
    const history = loadHistory();
    console.log(`History contains ${history.sent.length} sent problems`);
    
    console.log('Finding available problems...');
    const availableProblems = getAvailableProblems(index, history);
    
    if (availableProblems.length === 0) {
      console.log('No available problems (all sent recently). Clearing old history...');
      // Clear problems older than DAYS_BEFORE_REPEAT days
      const cutoffTime = Date.now() - (DAYS_BEFORE_REPEAT * 24 * 60 * 60 * 1000);
      history.sent = history.sent.filter(
        entry => new Date(entry.sent_at).getTime() > cutoffTime
      );
      saveHistory(history);
      
      // Try again
      const retryAvailable = getAvailableProblems(index, history);
      if (retryAvailable.length === 0) {
        console.error('Still no available problems after cleanup');
        process.exit(1);
      }
      availableProblems.push(...retryAvailable);
    }
    
    console.log(`${availableProblems.length} problems available`);
    
    // Select random problem
    const randomProblem = availableProblems[Math.floor(Math.random() * availableProblems.length)];
    console.log(`Selected problem: ${randomProblem.slug} (${randomProblem.name})`);
    
    // Read solution file
    const solutionPath = path.join(SOLUTIONS_PATH, randomProblem.path);
    console.log(`Reading solution file: ${solutionPath}`);
    
    if (!fs.existsSync(solutionPath)) {
      console.error(`Solution file not found: ${solutionPath}`);
      process.exit(1);
    }
    
    const { description, code } = parseSolutionFile(solutionPath);
    
    // Send email with both description and code
    console.log('Sending email...');
    await sendEmail(randomProblem, description, code);
    
    // Update history
    history.sent.push({
      slug: randomProblem.slug,
      name: randomProblem.name,
      difficulty: randomProblem.difficulty,
      sent_at: new Date().toISOString()
    });
    
    // Keep only recent history (last 30 days)
    const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    history.sent = history.sent.filter(
      entry => new Date(entry.sent_at).getTime() > monthAgo
    );
    
    saveHistory(history);
    console.log('History updated successfully');
    
    console.log('✅ Daily LeetCode problem sent successfully!');
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run main function
main();
