require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { parseDocument } = require('htmlparser2');
const { textContent } = require('domutils');

const app = express();
const PORT = process.env.PORT || 3456;

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-secret-change-me';

// Middleware
app.use(cors());

// Custom middleware to capture raw body for HMAC verification
app.use(express.json({ 
  limit: '5mb',
  verify: (req, res, buf, encoding) => {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}));

// Language to file extension mapping
const LANG_EXT_MAP = {
  'python': 'py',
  'python3': 'py',
  'java': 'java',
  'c++': 'cpp',
  'cpp': 'cpp',
  'c': 'c',
  'javascript': 'js',
  'typescript': 'ts',
  'go': 'go',
  'golang': 'go',
  'rust': 'rs',
  'ruby': 'rb',
  'swift': 'swift',
  'kotlin': 'kt',
  'scala': 'scala',
  'php': 'php',
  'csharp': 'cs',
  'c#': 'cs'
};

// Difficulty folder mapping
const DIFFICULTY_FOLDER_MAP = {
  'Easy': 'easy',
  'Medium': 'medium',
  'Hard': 'hard'
};

// HMAC verification middleware
function verifyHMAC(req, res, next) {
  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];

  if (!timestamp || !signature) {
    return res.status(401).json({ error: 'Missing authentication headers' });
  }

  // Check timestamp freshness (60 seconds)
  const now = Math.floor(Date.now() / 1000);
  const reqTime = parseInt(timestamp, 10);
  if (Math.abs(now - reqTime) > 60) {
    return res.status(401).json({ error: 'Request timestamp too old or in future' });
  }

  // Verify signature
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expectedSig = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(timestamp + '.' + rawBody)
    .digest('hex');

  console.log('HMAC Debug:');
  console.log('  Secret:', HMAC_SECRET);
  console.log('  Timestamp:', timestamp);
  console.log('  Body length:', rawBody.length);
  console.log('  Expected sig:', expectedSig);
  console.log('  Received sig:', signature);

  if (signature !== expectedSig) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

// Convert HTML to plain text with structure
function htmlToPlainText(html) {
  if (!html) return '';
  
  // Parse HTML
  const doc = parseDocument(html);
  let text = textContent(doc);
  
  // Clean up whitespace
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return text;
}

// Get file extension for language
function getExtension(language) {
  const lang = (language || '').toLowerCase();
  return LANG_EXT_MAP[lang] || 'txt';
}

// Get comment wrapper for file type
function getCommentWrapper(ext) {
  if (ext === 'py') {
    return { start: '"""', end: '"""' };
  }
  return { start: '/*', end: '*/' };
}

// Build solution file content with header
function buildSolutionContent(data, ext) {
  const { title, slug, difficulty, topics, description_html, code, source_url } = data;
  const wrapper = getCommentWrapper(ext);
  
  const descriptionText = htmlToPlainText(description_html);
  
  const header = `${wrapper.start}
[Description]
${title}
${source_url}

${descriptionText}

[Metadata]
- Difficulty: ${difficulty}
- Topics: ${topics.join(', ')}
- Slug: ${slug}
${wrapper.end}

// [Solution]
`;

  return header + code;
}

// GitHub API helpers
async function githubRequest(endpoint, method = 'GET', body = null) {
  const url = `https://api.github.com${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  console.log(`GitHub API ${method} ${endpoint}: ${response.status}`);
  
  // Only treat 404 as "not found" for GET requests
  if (response.status === 404 && method === 'GET') {
    return null;
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GitHub API Error (${response.status}):`, errorText);
    throw new Error(`GitHub API error ${response.status}: ${errorText}`);
  }
  
  const jsonResponse = await response.json();
  console.log(`GitHub API response:`, jsonResponse ? 'OK' : 'NULL');
  return jsonResponse;
}

// Get file content from GitHub
async function getFileContent(path) {
  const result = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`);
  if (!result) return null;
  
  return {
    sha: result.sha,
    content: Buffer.from(result.content, 'base64').toString('utf-8')
  };
}

// Get or create index.json
async function getIndex() {
  const result = await getFileContent('index.json');
  if (!result) {
    return { items: [], sha: null };
  }
  
  try {
    const parsed = JSON.parse(result.content);
    return { items: parsed.items || [], sha: result.sha };
  } catch (e) {
    return { items: [], sha: result.sha };
  }
}

// Sort index items per spec
function sortIndexItems(items) {
  const difficultyOrder = { 'Hard': 0, 'Medium': 1, 'Easy': 2 };
  
  return items.sort((a, b) => {
    // First by date_solved desc
    if (a.date_solved !== b.date_solved) {
      return b.date_solved.localeCompare(a.date_solved);
    }
    // Then by difficulty Hard > Medium > Easy
    const diffA = difficultyOrder[a.difficulty] ?? 3;
    const diffB = difficultyOrder[b.difficulty] ?? 3;
    if (diffA !== diffB) {
      return diffA - diffB;
    }
    // Then by slug asc
    return a.slug.localeCompare(b.slug);
  });
}

// Update index.json with new/updated item
function updateIndexItems(items, newItem) {
  const existing = items.find(i => i.slug === newItem.slug);
  
  if (existing) {
    // Update existing - keep earliest date_solved
    existing.name = newItem.name;
    existing.difficulty = newItem.difficulty;
    existing.topics = newItem.topics;
    existing.path = newItem.path;
    if (!existing.date_solved) {
      existing.date_solved = newItem.date_solved;
    }
  } else {
    items.push(newItem);
  }
  
  return sortIndexItems(items);
}

// Create or update file using GitHub Contents API
async function createOrUpdateFile(path, content, message) {
  const existing = await getFileContent(path);
  
  const body = {
    message,
    content: Buffer.from(content).toString('base64')
  };
  
  if (existing) {
    // Check if content is the same
    if (existing.content === content) {
      return { changed: false, sha: existing.sha };
    }
    body.sha = existing.sha;
  }
  
  const result = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    'PUT',
    body
  );
  
  if (!result) {
    throw new Error(`Failed to create/update file: ${path}`);
  }
  
  return { changed: true, sha: result.content?.sha || result.sha };
}

// Sync endpoint
app.post('/sync', verifyHMAC, async (req, res) => {
  try {
    const { slug, title, difficulty, topics, description_html, code, language, source_url } = req.body;

    // Validate required fields
    if (!slug || !title || !difficulty || !code || !language) {
      return res.status(400).json({ 
        error: 'Missing required fields: slug, title, difficulty, code, language' 
      });
    }

    // Validate GitHub config
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return res.status(500).json({ 
        error: 'Server not configured: missing GitHub credentials' 
      });
    }

    const ext = getExtension(language);
    const difficultyFolder = DIFFICULTY_FOLDER_MAP[difficulty] || 'unknown';
    const solutionPath = `${difficultyFolder}/${slug}/solution.${ext}`;
    
    // Build solution file content
    const solutionContent = buildSolutionContent({
      title,
      slug,
      difficulty,
      topics: topics || [],
      description_html: description_html || '',
      code,
      source_url: source_url || ''
    }, ext);

    // Get current date for date_solved
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Get current index
    const { items: indexItems, sha: indexSha } = await getIndex();

    // Prepare new index item
    const newIndexItem = {
      slug,
      name: title,
      difficulty,
      topics: topics || [],
      path: solutionPath,
      date_solved: today
    };

    // Check if solution content changed
    const existingSolution = await getFileContent(solutionPath);
    const solutionChanged = !existingSolution || existingSolution.content !== solutionContent;

    // Check if index needs update
    const existingIndexItem = indexItems.find(i => i.slug === slug);
    const indexNeedsUpdate = !existingIndexItem || 
      existingIndexItem.name !== title ||
      existingIndexItem.difficulty !== difficulty ||
      JSON.stringify(existingIndexItem.topics) !== JSON.stringify(topics || []) ||
      existingIndexItem.path !== solutionPath;

    if (!solutionChanged && !indexNeedsUpdate) {
      return res.json({ 
        success: true, 
        no_change: true, 
        message: 'No changes detected' 
      });
    }

    // Update solution file
    if (solutionChanged) {
      await createOrUpdateFile(
        solutionPath,
        solutionContent,
        `Sync solution: ${title}`
      );
    }

    // Update index.json
    const updatedItems = updateIndexItems(indexItems, newIndexItem);
    const indexContent = JSON.stringify({ items: updatedItems }, null, 2);
    
    await createOrUpdateFile(
      'index.json',
      indexContent,
      `Update index: ${title}`
    );

    res.json({
      success: true,
      path: solutionPath,
      message: `Synced: ${title}`
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    configured: !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO)
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`BetterLeetSync backend running on port ${PORT}`);
  console.log(`GitHub repo: ${GITHUB_OWNER}/${GITHUB_REPO}`);
  if (!GITHUB_TOKEN) {
    console.warn('WARNING: GITHUB_TOKEN not set!');
  }
});
