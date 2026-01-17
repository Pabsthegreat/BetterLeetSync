1) End-to-end design overview
Goal

Build a manual-trigger Chrome extension that, after you solve a LeetCode problem in the browser, you click “Sync” and it will:

Extract from the current LeetCode problem page:

slug, title, difficulty, topics, description_html

your current editor code

Send payload to a private backend over HTTPS (or localhost / VPN).

Backend commits a single file per problem into your GitHub repo with:

a Description section (problem statement)

a Solution section (your code)

Backend updates/creates index.json at repo root with metadata:

name, slug, difficulty, topics, path, date_solved

Repo structure (must match)
index.json
easy/
  <slug>.<ext>
medium/
  <slug>.<ext>
hard/
  <slug>.<ext>


You want one file per problem only (no separate README/meta file). The file starts with Description, then Solution.

2) Data model requirements
index.json format

Location: repo root: index.json

Must be valid JSON (not JSONL)

Structure: an object with a top-level items array, to allow future expansion.

Example:

{
  "items": [
    {
      "slug": "two-sum",
      "name": "Two Sum",
      "difficulty": "Easy",
      "topics": ["Array", "Hash Table"],
      "path": "easy/two-sum/solution.py",
      "date_solved": "2026-01-17"
    }
  ]
}

Rules

slug is unique key.

If syncing an existing slug:

update path if difficulty changed (rare) or extension changes language

update date_solved only if it was missing; otherwise keep earliest date (configurable; default: keep earliest)

update topics/name/difficulty to latest extracted values (safe)

Must keep items sorted:

primary: date_solved descending

secondary: difficulty order Hard > Medium > Easy

tertiary: slug ascending

Difficulty mapping to folder

Easy → easy/

Medium → medium/

Hard → hard/

Difficulty must be extracted from page data; do not guess.

date_solved

Use backend server local date in ISO format: YYYY-MM-DD

Do not use LeetCode submission date (not required; also more complicated)

3) Single-file content format (solution.<ext>)
Hard requirement: file begins with Description section, then Solution

Use a language-agnostic “header block” format that works across Python/C++/Java/JS etc.

Standard template:

/*
[Description]
<plain text description>

[Examples]
<plain text examples if extractable; otherwise omit section>

[Constraints]
<plain text constraints if extractable; otherwise omit section>

[Metadata]
Title: <title>
Slug: <slug>
Difficulty: <difficulty>
Topics: <comma-separated topics>
Date Solved: <YYYY-MM-DD>
Source: https://leetcode.com/problems/<slug>/
*/

[Solution]
<actual code here>

Comment syntax by language (must implement)

.py → triple quotes """ ... """

.js, .ts, .java, .cpp, .c, .go, .rs → /* ... */

The code must be appended as-is

Do not reformat user code.

Do not add “AI-generated” comments.

The only added content is the header block plus a single line marker [Solution] before the code.

4) Extraction sources on LeetCode page
Primary source: window.__NEXT_DATA__

The extension should extract question data from embedded Next.js data to reduce DOM brittleness.

Fields needed (conceptual):

titleSlug

title

difficulty (Easy/Medium/Hard)

topicTags[] -> name

content (HTML string of description)

Code extraction: Monaco editor model

Injected page script should read:

window.monaco.editor.getModels()

choose the model with the largest getValue() length.

5) Sync protocol (Extension → Backend)
Endpoint

POST /sync

Payload JSON
{
  "slug": "two-sum",
  "title": "Two Sum",
  "difficulty": "Easy",
  "topics": ["Array", "Hash Table"],
  "description_html": "<p>Given an array...</p>",
  "code": "class Solution:\n    ...",
  "language": "python3",
  "source_url": "https://leetcode.com/problems/two-sum/"
}

Authentication (required)

Use HMAC with shared secret:

Headers:

X-Timestamp: <unix-seconds>

X-Signature: <hex-hmac-sha256(secret, timestamp + '.' + rawBody)>

Backend:

Reject if timestamp older than 60 seconds.

Reject if signature mismatch.

Reject if missing required fields.

6) GitHub update behavior (Backend)
Inputs

Backend holds:

GITHUB_TOKEN (fine-grained PAT; repo contents write only)

OWNER, REPO, BRANCH

SYNC_HMAC_SECRET

Outputs

Backend must commit:

Problem solution file at computed path

Root index.json updated/created

Both should be committed in a predictable way.

Commit strategy (must implement)

Use GitHub API to update files via the Contents API (simpler) OR Git Data API (single commit with multiple file changes). Choose one approach; implement correctly.

Preferred (clean): Git Data API (single commit)

Read current index.json + target file (if exists)

Create blobs for updated file and index

Create new tree referencing updated blobs

Create commit with that tree

Update branch ref to new commit

If Copilot chooses Contents API, it will create separate commits unless carefully batched; Git Data API is recommended.

Idempotency / dedupe rules

If solution file content is identical to existing → do not create a new commit unless index needs updates.

If index would not change and solution would not change → return ok: true with no_change: true.

7) Language → file extension mapping

Backend determines extension based on language string:

python / python3 → py

c++ / cpp → cpp

c → c

java → java

javascript → js

typescript → ts

go / golang → go

rust → rs

If unknown, default txt.

8) HTML → plain text conversion

The description is delivered as HTML (description_html).

Backend must:

Convert to readable plain text for the header block.

Keep structure:

preserve paragraphs and line breaks

preserve bullet points

preserve code blocks as indented blocks or fenced blocks (but inside comment header, so just indent is fine)

Implement using a safe HTML-to-text conversion (no external network calls). If using Node:

either implement a minimal sanitizer + text extraction

or use a small library (allowed) to convert html→text deterministically

9) Chrome extension UX requirements
Trigger model

Manual only:

a fixed “Sync” button injected on LeetCode problem pages

clicking triggers extraction + POST to backend

Config

Extension stores:

backend URL

shared secret

Store in chrome.storage.local. Provide a minimal options.html page to set these.

10) Failure modes & required handling

Extension must display clear errors:

“Could not read editor code”

“Could not parse NEXT_DATA”

“Backend rejected signature”

“GitHub API error”

Backend must return structured JSON:

{ "ok": false, "error": "..." }

11) Implementation deliverables Copilot must produce
Repository layout for the project (not your LeetCode solutions repo)

Create a new repo (or a folder) called leetcode-private-sync/ with:

backend/
  package.json
  server.js
  README.md
extension/
  manifest.json
  content.js
  inject.js
  options.html
  options.js
  icon.png (optional)

Backend must run locally

node server.js listening on configurable port.

Extension must be loadable as unpacked extension

Chrome → Extensions → Developer mode → Load unpacked → extension/

12) Step-by-step instructions Copilot must follow

This section is the “execution plan” Copilot should implement exactly.

Implement backend POST /sync with:

JSON body parsing with size limit (2–3 MB)

HMAC validation with timestamp window

file path computation based on difficulty + slug + extension

HTML→text conversion

solution file render using the language-appropriate comment wrapper

index.json load-or-create + upsert + stable sorting

GitHub commit(s) to update both target solution file and index.json

return {ok:true, path, index_updated, commit_sha, no_change}

Implement extension:

options page to set backend URL and shared secret

content script that injects “Sync” button on https://leetcode.com/problems/*

inject.js that:

reads window.__NEXT_DATA__ to extract {slug,title,difficulty,topics,description_html}

reads Monaco model for code

posts extracted data back to content script (window.postMessage)

content script that:

retrieves settings from storage

computes HMAC signature using WebCrypto

sends POST to backend

shows result to user (alert or small toast)

Ensure privacy:

no LeetCode cookies sent

backend never calls LeetCode

GitHub token only on backend