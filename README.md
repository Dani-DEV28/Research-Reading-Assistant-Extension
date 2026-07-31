# Research Reading Assistant Extension

## Development Plan

## 1. Product Overview

The Research Reading Assistant is a browser extension designed to help researchers actively read and review academic papers.

The core workflow is:

**Select paper → Create review checklist → Read sections → Answer personal questions → Store research memory**

The product is not a paper summarizer. The AI component is limited to reviewing and validating the user's checklist, mapping paper sections, and suggesting improvements. The user remains responsible for defining what they want to learn from the paper.

---

# 2. Product Goals

## Primary Goals

* Help users read research papers with intention.
* Convert passive reading into structured review.
* Allow users to define questions they want answered.
* Track progress through important paper sections.
* Build a personal research memory database.

## Non-Goals

The product will not:

* Automatically summarize entire papers.
* Replace researcher judgment.
* Generate final conclusions on behalf of the user.
* Continuously analyze the paper during reading.

---

# 3. Core User Workflow

## Step 1: Open Research Paper

Supported sources:

* arXiv HTML papers
* Research websites with structured HTML

The extension extracts:

* Title
* Abstract
* Section headings
* Figures
* Tables
* Methods sections
* Results sections
* Conclusion sections

---

# Step 2: Activate Review Mode

The user starts a review session.

The extension asks:

```
What are you trying to understand from this paper?
```

Example:

```
Evaluate whether this method improves model efficiency.
```

---

# Step 3: Create Checklist

The user selects sections to review.

Default checklist:

```
☐ Title
☐ Figure 1
☐ Abstract
☐ Introduction
☐ Methods
☐ Results
☐ Conclusion
```

The user can customize the checklist.

---

# Step 4: Add Reflection Questions

Each checklist item requires a user question.

Example:

## Title

Question:

```
What problem does this paper claim to solve?
```

---

## Figure 1

Question:

```
Can I explain the overall system architecture?
```

---

## Abstract

Question:

```
What is the main contribution and evidence?
```

---

## Methods

Question:

```
How does the proposed method work and what assumptions exist?
```

---

## Conclusion

Question:

```
Did the authors support their original claim?
```

---

# Step 5: Guided Reading

The extension monitors reading progress.

When the user finishes a selected section:

Example:

```
✓ Abstract completed

Your review question:

"What is the main contribution and evidence?"

Your answer:

[________________]

Save Answer
```

After completion:

```
Next section:

Methods

Question:

"How does the proposed method work and what assumptions exist?"
```

---

# 4. AI Responsibilities

The AI system has limited responsibilities.

## 4.1 Checklist Validation

The AI reviews whether the checklist matches the user's goal.

Example:

User goal:

```
Evaluate model efficiency
```

Checklist:

```
☑ Abstract
☑ Conclusion
```

AI recommendation:

```
Consider adding:
☐ Results
☐ Computational Analysis
☐ Ablation Study
```

The user decides whether to accept suggestions.

---

## 4.2 Section Mapping

Different papers use different names.

Examples:

```
Methodology
Approach
Model Design
Experimental Setup
```

The AI maps them into standard categories:

```
METHODS
```

---

## 4.3 Question Quality Review

The AI checks whether questions are useful.

Example:

User question:

```
Is this paper good?
```

AI suggestion:

```
This question is broad.

Consider:
"What evidence supports the authors' main claim?"
```

---

# 5. Technical Architecture

```
Browser Extension
|
├── Content Script
│   ├── Detect paper structure
│   ├── Identify sections
│   └── Track reading position
|
├── Review Manager
│   ├── Checklist workflow
│   ├── Question prompts
│   └── Completion tracking
|
├── Local Storage
│   ├── Paper metadata
│   ├── Checklists
│   ├── User answers
│   └── Reading history
|
└── AI Validation Layer
    ├── Section mapping
    ├── Checklist review
    └── Question suggestions
```

---

# 6. Storage Design

## MVP Storage

Use:

```
chrome.storage.local
```

For:

* Active reviews
* User preferences
* Current progress

## Scalable Storage

Use:

```
IndexedDB
```

Structure:

```
ResearchMemory

├── Papers
│
├── ReviewSessions
│
├── ChecklistItems
│
└── UserResponses
```

---

# 7. Data Model

Example:

```json
{
  "paper_id": "arxiv_2601_00046",

  "review_goal":
    "Understand if this method improves efficiency",

  "checklist": [
    {
      "section": "Methods",

      "question":
        "How does the method work?",

      "status":
        "completed",

      "answer":
        "Uses transformer architecture with reduced parameters."
    }
  ]
}
```

---

# 8. MVP Development Roadmap

## Phase 1: Browser Extension Foundation

Goals:

* Create Chrome extension
* Detect supported paper pages
* Extract HTML structure
* Identify sections

Deliverables:

* Manifest V3 extension
* DOM parser
* Section detector

---

## Phase 2: Checklist System

Goals:

* Allow users to create review plans
* Add questions per section
* Save locally

Deliverables:

* Checklist UI
* Question editor
* Local storage

---

## Phase 3: Reading Tracker

Goals:

* Detect section completion
* Prompt reflection questions

Deliverables:

* Scroll tracking
* Section progress
* Completion prompts

---

## Phase 4: AI Validation Layer

Goals:

* Improve checklist quality
* Map section names
* Recommend missing sections

Deliverables:

* Local AI integration
* Checklist review pipeline

---

## Phase 5: Research Memory

Goals:

* Store completed reviews
* Search previous notes

Deliverables:

* Paper library
* Review history
* Export functionality

---

# 9. Future Features

## Voice Interaction

* Spoken answers
* Voice-based review sessions
* Screen-reader integration

## Cross-Paper Comparison

Example:

```
Compare methods between:

Paper A
Paper B
Paper C
```

## Personal Research Assistant

Use stored reviews to answer:

```
Which papers used this technique?
```

```
What limitations did researchers report?
```

---

# 10. Success Metrics

Measure:

* Number of completed paper reviews
* Checklist completion rate
* User retention
* Average questions answered per paper
* Number of papers stored in research memory

---

# Product Vision

The goal is to create a persistent research reading companion that helps users transform papers into structured knowledge.

The key loop:

```
Read
 ↓
Reflect
 ↓
Answer
 ↓
Remember
```

The user's questions drive the experience. AI supports the workflow by improving structure and organization, while the user's own reasoning remains the source of understanding.

---

# 11. MVP Phase 1 Implementation

## Current File Structure

```
Research-Read-Assistant-ext/
│
├── manifest.json                 Manifest V3 definition
│
├── background/
│   └── service-worker.js         Initializes default preferences on install
│
├── content/
│   ├── detector.js               DOM parser + section detector (title, abstract,
│   │                             sections, figures, methods, conclusion)
│   └── content.js                Content script: handles popup messages
│
├── popup/
│   ├── popup.html                Popup UI with RUN DETECT button + structure checklist
│   ├── popup.css                 Popup styling
│   └── popup.js                  Popup logic: cache lookup, detection, checklist toggles
│
├── storage/
│   └── papers.js                 PaperStorage cache module (save, read, progress, evict)
│
└── README.md
```

## Loading the Extension

1. Open `chrome://extensions`.
2. Enable "Developer mode" (top-right).
3. Click "Load unpacked" and select this project folder.
4. Pin the extension from the toolbar.

## Using "RUN DETECT"

1. Open a research paper page (arXiv HTML, ar5iv, or any page with structured HTML).
2. Click the extension icon to open the popup.
3. Click **RUN DETECT**.
4. Open the page console (F12 > Console) to view the detected output:
   - Title
   - Abstract
   - Sections (headings + snippets)
   - Figures (captions, alt text, source URLs)
   - Methods (detected by keyword-matching section headings)
   - Conclusion (detected by keyword-matching section headings)

## Structure Checklist

When the popup opens on a page whose URL is already cached, the paper's structure is
loaded from the cache and rendered as a checkable checklist:

- One item per extracted part: Abstract, each Section, each Figure, Methods, Conclusion.
- Checking an item persists immediately via `PaperStorage.setProgress`.
- Re-opening the popup (or re-detecting the same paper) keeps the checkmarks.
- Unrecognized pages show an empty state prompting **RUN DETECT**.
- RUN DETECT stays enabled even when cached data is loaded, so the user can re-extract
  and overwrite the cache entry (existing checkmarks are preserved).

Checklist item keys: `abstract`, `section_<i>`, `figure_<i>`, `methods`, `conclusion`.

## Read Mode

The **READ** button enters a focused reading session:

- **Hides untracked items** - only checked (tracked) checklist items remain visible.
- **Prompts for a reading question** - a modal opens so the user can record the question
  they want to answer from this paper.
- The question is saved on the paper record as `review_goal` (via `PaperStorage.setReviewGoal`)
  and pre-filled the next time READ is pressed.
- Pressing **READ** again (now labeled **EXIT READ**) restores all items.
- Requires at least one tracked item; otherwise the popup prompts the user to track items first.

## Detection Cache

Detected papers are cached in `chrome.storage.local` under the `papers` key.

Cache rules:

- A paper is cached only when **RUN DETECT** is clicked.
- Entries expire **7 days** after detection.
- The cache keeps at most **10 papers** (oldest detected papers are evicted first).
- Cache reads/writes go through `storage/papers.js` (`PaperStorage`).

Storage schema:

```json
{
  "papers": {
    "arxiv_2401.00001": {
      "paper_id": "arxiv_2401.00001",
      "source": "arxiv",
      "url": "https://arxiv.org/abs/2401.00001",
      "title": "...",
      "abstract": "...",
      "sections": [...],
      "figures": [...],
      "methods": {},
      "conclusion": {},
      "detected_at": 1753920000000,
      "review_goal": "What problem does this paper claim to solve?",
      "progress": {
        "abstract": true,
        "section_0": false,
        "figure_0": true,
        "methods": false,
        "conclusion": false
      }
    }
  }
}
```

Paper IDs are derived from the URL: `arxiv.org/abs|pdf/<id>` becomes `arxiv_<id>`;
any other page becomes `page_` + a stable hash of the URL.

## Supported Sources

- arXiv HTML papers (`arxiv.org`, `ar5iv.org`)
- Academic sites exposing `citation_title` / `citation_abstract` meta tags
- Generic structured HTML with `article`, `section`, and heading elements

## Future Phases

Phase 2 (Checklist System), Phase 3 (Reading Tracker), Phase 4 (AI Validation Layer),
and Phase 5 (Research Memory) build on this foundation as described in the roadmap above.

