# LeetCode Private Sync — Copilot Execution Instructions

You are implementing a Chrome Extension (Manifest V3) + Node.js backend that syncs LeetCode browser solutions into a GitHub repo with a strict repo structure and metadata index.

## Non-negotiable Requirements

### Target solutions repo structure
- Root contains `index.json`
- Solutions are stored under difficulty folder and slug folder:

easy/<slug>/solution.<ext>
medium/<slug>/solution.<ext>
hard/<slug>/solution.<ext>

### Single file per problem
Do NOT create README/meta per problem. The single solution file must contain:
1) A Description section (problem statement, examples, constraints, metadata)
2) A Solution section containing the code EXACTLY as in the editor

### index.json
Root `index.json` must track metadata for all synced problems:
Fields per item:
- slug (unique key)
- name (title)
- difficulty ("Easy"|"Medium"|"Hard")
- topics (array of strings)
- path (string path to solution file)
- date_solved (YYYY-MM-DD; backend server local date)

index.json must be valid JSON:
{
  "items": [ ... ]
}

Upsert semantics:
- If slug exists: update name/difficulty/topics/path to latest extracted values
- Keep earliest date_solved if already present; if missing set it
- Sort items by date_solved desc, then difficulty Hard>Medium>Easy, then slug asc

### Privacy/security
- Backend never logs into LeetCode.
- Extension never stores GitHub token.
- Extension authenticates to backend using HMAC headers:
  - X-Timestamp: unix seconds
  - X-Signature: hex(hmac_sha256(secret, timestamp + '.' + rawBody))
- Backend rejects stale timestamp (>60s) and signature mismatch.

## Extraction rules (extension)
- Extract question metadata from window.__NEXT_DATA__ (primary).
  Needed fields:
  - titleSlug -> slug
  - title
  - difficulty
  - topicTags[].name -> topics
  - content -> description_html
- Extract code from Monaco editor model:
  - window.monaco.editor.getModels()
  - choose model with largest getValue().length
- Manual trigger only: inject a "Sync" button on LeetCode problem pages. No auto sync.

## Backend rules
- Endpoint: POST /sync
- Payload:
{
  "slug","title","difficulty","topics","description_html","code","language","source_url"
}
- Convert HTML description to plain text with preserved structure.
- Render solution file header block (comment wrapper depends on extension):
  - py: triple quotes
  - others: /* ... */
- Include sections in header:
  [Description], [Examples] (optional), [Constraints] (optional), [Metadata]
  and then a line "[Solution]" followed by code.

Language->ext mapping:
python/python3->py; java->java; c++/cpp->cpp; c->c; javascript->js; typescript->ts; go/golang->go; rust->rs; default txt.

Compute output path from difficulty:
Easy->easy, Medium->medium, Hard->hard:
<difficultyFolder>/slug.<ext>

GitHub update:
- Use GitHub API with server-side token to update both:
  1) target solution file
  2) root index.json
- Prefer Git Data API to write both in a single commit. If using Contents API, ensure consistency and handle existing sha correctly.
- If neither solution content nor index.json changes, return ok with no_change=true.

## Project deliverables
Implement project as:
backend/ (Node.js express server)
extension/ (Manifest V3 extension with options page)

backend must be runnable with:
- npm install
- node server.js

extension must be loadable as unpacked extension.

Return clear errors on failures. Do not include any LeetCode credentials in backend. GitHub token only in backend env vars.

## Done criteria
1) Clicking Sync on a LeetCode problem page creates/updates the correct file path in GitHub repo with required header + code.
2) index.json is created/updated with correct item fields and sorting.
3) Works repeatedly without duplicates or invalid JSON.
