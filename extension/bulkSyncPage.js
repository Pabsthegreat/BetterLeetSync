// Bulk Sync Page Script

const LEETCODE_API = 'https://leetcode.com/graphql';

// Generate HMAC signature
async function generateSignature(secret, timestamp, body) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(timestamp + '.' + body);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Get user's solved problems
async function getSolvedProblems() {
  try {
    const response = await fetch('https://leetcode.com/api/problems/all/', {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!data.stat_status_pairs) {
      throw new Error('Could not fetch problems list. Make sure you are logged into LeetCode.');
    }
    
    const solved = data.stat_status_pairs
      .filter(item => item.status === 'ac')
      .map(item => ({
        id: item.stat.question_id,
        title: item.stat.question__title,
        titleSlug: item.stat.question__title_slug,
        timestamp: Date.now()
      }))
      .sort((a, b) => b.id - a.id);
    
    return solved;
  } catch (error) {
    console.error('Error fetching solved problems:', error);
    throw error;
  }
}

// Get problem details
async function getProblemDetails(titleSlug) {
  const query = `
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        title
        titleSlug
        content
        difficulty
        topicTags {
          name
        }
      }
    }
  `;

  const response = await fetch(LEETCODE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': `https://leetcode.com/problems/${titleSlug}/`,
    },
    credentials: 'include',
    body: JSON.stringify({
      query,
      variables: { titleSlug }
    })
  });

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'Failed to fetch problem details');
  }
  
  return data.data.question;
}

// Get last accepted submission using GraphQL
async function getLastSubmission(titleSlug) {
  try {
    // Step 1: Get list of submissions to find an accepted one
    const listQuery = `
      query getSubmissions($offset: Int!, $limit: Int!, $questionSlug: String!) {
        submissionList(
          offset: $offset
          limit: $limit
          questionSlug: $questionSlug
        ) {
          submissions {
            id
            statusDisplay
            lang
            timestamp
          }
        }
      }
    `;

    const listResponse = await fetch(LEETCODE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': `https://leetcode.com/problems/${titleSlug}/`,
      },
      credentials: 'include',
      body: JSON.stringify({
        query: listQuery,
        variables: { questionSlug: titleSlug, offset: 0, limit: 20 }
      })
    });

    const listData = await listResponse.json();
    
    if (listData.errors) {
      console.error('GraphQL errors fetching submissions:', listData.errors);
      return null;
    }
    
    const submissions = listData.data?.submissionList?.submissions || [];
    console.log(`Found ${submissions.length} submissions for ${titleSlug}`);
    
    // Find first accepted submission
    const accepted = submissions.find(s => s.statusDisplay === 'Accepted');
    
    if (!accepted) {
      console.log(`No accepted submission found for ${titleSlug}`);
      return null;
    }

    console.log('Accepted submission ID:', accepted.id);

    // Step 2: Fetch the submission code using GraphQL
    const detailQuery = `
      query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          code
          timestamp
          lang {
            name
            verboseName
          }
        }
      }
    `;

    const detailResponse = await fetch(LEETCODE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': `https://leetcode.com/problems/${titleSlug}/submissions/${accepted.id}/`,
      },
      credentials: 'include',
      body: JSON.stringify({
        query: detailQuery,
        variables: { submissionId: parseInt(accepted.id) }
      })
    });

    const detailData = await detailResponse.json();
    
    if (detailData.errors) {
      console.error('GraphQL errors fetching submission details:', detailData.errors);
      return null;
    }

    const details = detailData.data?.submissionDetails;
    if (!details || !details.code) {
      console.log('No code found in submission details');
      return null;
    }

    console.log(`Got code for ${titleSlug}: ${details.code.length} chars`);
    
    // Map LeetCode language names to standard extensions
    const langName = details.lang?.name || accepted.lang;
    const langMap = {
      'python': 'python',
      'python3': 'python3',
      'java': 'java',
      'cpp': 'cpp',
      'c++': 'cpp',
      'c': 'c',
      'javascript': 'javascript',
      'typescript': 'typescript',
      'go': 'golang',
      'golang': 'golang',
      'rust': 'rust',
      'ruby': 'ruby',
      'swift': 'swift',
      'kotlin': 'kotlin',
      'scala': 'scala',
      'php': 'php',
      'csharp': 'csharp',
      'c#': 'csharp'
    };
    const mappedLang = langMap[langName?.toLowerCase()] || langName || 'txt';

    return {
      id: accepted.id,
      statusDisplay: 'Accepted',
      lang: mappedLang,
      timestamp: details.timestamp || Date.now(),
      code: details.code
    };
  } catch (error) {
    console.error(`Error fetching submission for ${titleSlug}:`, error);
    return null;
  }
}

// Sync a single problem
async function syncProblem(titleSlug, updateProgress) {
  try {
    updateProgress(`Fetching ${titleSlug}...`);
    
    const [problemDetails, submission] = await Promise.all([
      getProblemDetails(titleSlug),
      getLastSubmission(titleSlug)
    ]);

    if (!submission || !submission.code) {
      throw new Error('No accepted submission found');
    }

    const syncData = {
      slug: problemDetails.titleSlug,
      title: problemDetails.title,
      difficulty: problemDetails.difficulty,
      topics: problemDetails.topicTags.map(t => t.name),
      description_html: problemDetails.content,
      code: submission.code,
      language: submission.lang,
      source_url: `https://leetcode.com/problems/${titleSlug}/`
    };

    const settings = await chrome.storage.sync.get(['backendUrl', 'hmacSecret']);
    const backendUrl = settings.backendUrl || 'http://localhost:3456';
    const hmacSecret = settings.hmacSecret || '';

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify(syncData);
    const signature = await generateSignature(hmacSecret, timestamp, body);

    const response = await fetch(`${backendUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature
      },
      body: body
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sync failed');
    }

    return { success: true, title: problemDetails.title };
  } catch (error) {
    return { success: false, title: titleSlug, error: error.message };
  }
}

// Main bulk sync function
async function startBulkSync(onProgress, onComplete) {
  try {
    onProgress('Fetching your solved problems...');
    
    const solvedProblems = await getSolvedProblems();
    const total = solvedProblems.length;
    
    if (total === 0) {
      onComplete({ success: true, synced: 0, failed: 0, errors: [] });
      return;
    }

    onProgress(`Found ${total} solved problems. Starting sync...`);

    const results = {
      synced: 0,
      failed: 0,
      errors: []
    };

    const batchSize = 3;
    for (let i = 0; i < solvedProblems.length; i += batchSize) {
      const batch = solvedProblems.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(problem => 
          syncProblem(problem.titleSlug, (msg) => {
            onProgress(`[${i + 1}/${total}] ${msg}`);
          })
        )
      );

      batchResults.forEach(result => {
        if (result.success) {
          results.synced++;
          onProgress(`✓ Synced: ${result.title}`);
        } else {
          results.failed++;
          results.errors.push({ title: result.title, error: result.error });
          onProgress(`✗ Failed: ${result.title} - ${result.error}`);
        }
      });

      if (i + batchSize < solvedProblems.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    onComplete(results);
  } catch (error) {
    onComplete({ success: false, error: error.message });
  }
}

// Page UI

document.getElementById('start-btn').addEventListener('click', async () => {
  const startBtn = document.getElementById('start-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const logContainer = document.getElementById('log-container');
  const summaryDiv = document.getElementById('summary');
  
  startBtn.disabled = true;
  progressContainer.style.display = 'block';
  logContainer.innerHTML = '';
  summaryDiv.style.display = 'none';
  
  let totalProblems = 0;
  let processedProblems = 0;
  
  function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = message;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  
  function updateProgress(current, total) {
    processedProblems = current;
    totalProblems = total;
    const percent = total > 0 ? (current / total * 100) : 0;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Processing: ${current} / ${total} problems`;
  }
  
  try {
    await startBulkSync(
      (message) => {
        // Parse progress messages
        if (message.includes('Found') && message.includes('solved problems')) {
          const match = message.match(/Found (\d+)/);
          if (match) {
            totalProblems = parseInt(match[1]);
            updateProgress(0, totalProblems);
          }
        } else if (message.match(/\[(\d+)\/(\d+)\]/)) {
          const match = message.match(/\[(\d+)\/(\d+)\]/);
          updateProgress(parseInt(match[1]), parseInt(match[2]));
        }
        
        // Determine log type
        let type = 'info';
        if (message.startsWith('✓')) type = 'success';
        if (message.startsWith('✗')) type = 'error';
        
        addLog(message, type);
      },
      (results) => {
        if (results.success === false) {
          addLog(`✗ Bulk sync failed: ${results.error}`, 'error');
          startBtn.disabled = false;
          return;
        }
        
        // Show summary
        progressText.textContent = 'Complete!';
        progressFill.style.width = '100%';
        
        summaryDiv.innerHTML = `
          <h3>Sync Complete!</h3>
          <div class="summary-stats">
            <div class="stat">
              <div class="stat-value">${results.synced}</div>
              <div class="stat-label">Synced</div>
            </div>
            <div class="stat">
              <div class="stat-value">${results.failed}</div>
              <div class="stat-label">Failed</div>
            </div>
            <div class="stat">
              <div class="stat-value">${results.synced + results.failed}</div>
              <div class="stat-label">Total</div>
            </div>
          </div>
        `;
        summaryDiv.style.display = 'block';
        summaryDiv.className = 'summary';
        
        addLog(`\n✅ Bulk sync completed successfully!`, 'success');
        addLog(`Total synced: ${results.synced}`, 'success');
        if (results.failed > 0) {
          addLog(`Failed: ${results.failed}`, 'error');
          results.errors.forEach(err => {
            addLog(`  - ${err.title}: ${err.error}`, 'error');
          });
        }
        
        startBtn.disabled = false;
        startBtn.textContent = 'Sync Again';
      }
    );
  } catch (error) {
    addLog(`✗ Error: ${error.message}`, 'error');
    startBtn.disabled = false;
  }
});
