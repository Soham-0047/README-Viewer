/**
 * MarkVault — File Templates
 * Each template has: id, name, icon, category, description, content
 */

const Templates = (() => {

  const TEMPLATES = [
    {
      id: 'blank',
      name: 'Blank',
      icon: '📄',
      category: 'Basic',
      description: 'Empty file',
      content: `# Untitled\n\n`,
    },
    {
      id: 'meeting',
      name: 'Meeting Notes',
      icon: '📋',
      category: 'Work',
      description: 'Agenda, notes, action items',
      content: `# Meeting: {title}

**Date:** ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
**Attendees:** 
**Facilitator:** 

---

## Agenda

1. 
2. 
3. 

---

## Notes

### Topic 1


### Topic 2


---

## Action Items

| Task | Owner | Due Date | Status |
|------|-------|----------|--------|
|      |       |          | 🔲 Open |
|      |       |          | 🔲 Open |

---

## Next Meeting

**Date:** 
**Topics:** 
`,
    },
    {
      id: 'blog',
      name: 'Blog Post',
      icon: '✍️',
      category: 'Writing',
      description: 'Full blog post structure',
      content: `---
title: "Your Post Title"
date: ${new Date().toISOString().split('T')[0]}
tags: []
---

# Your Post Title

*A one-sentence hook that makes people want to keep reading.*

---

## Introduction

Start with the problem or question you're addressing. Why does this matter?

## Section 1: {Main Point}

Your first main argument or section.

> **Key insight:** Pull out your most important point as a blockquote.

## Section 2: {Main Point}

Support with examples, data, or reasoning.

\`\`\`
// Code example if relevant
\`\`\`

## Section 3: {Main Point}

Third point.

## Conclusion

Summarize what you covered and what the reader should take away.

**Call to action:** What should the reader do next?

---

*Written by [Your Name]. Published on [Publication].*
`,
    },
    {
      id: 'readme',
      name: 'README',
      icon: '📦',
      category: 'Technical',
      description: 'GitHub-style project README',
      content: `# Project Name

> One-line description of what this does and why it's useful.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ Features

- Feature one
- Feature two
- Feature three

## 🚀 Quick Start

\`\`\`bash
# Install
npm install your-package

# Run
npm start
\`\`\`

## 📖 Usage

\`\`\`javascript
import { thing } from 'your-package';

const result = thing({ option: 'value' });
console.log(result);
\`\`\`

## 🛠 API Reference

### \`functionName(params)\`

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | ✅ | What it does |
| param2 | number | ❌ | Default: 0 |

**Returns:** \`Promise<Result>\`

## 🤝 Contributing

1. Fork the repo
2. Create a branch: \`git checkout -b feature/my-feature\`
3. Commit: \`git commit -m 'Add my feature'\`
4. Push: \`git push origin feature/my-feature\`
5. Open a Pull Request

## 📄 License

MIT © [Your Name](https://github.com/yourusername)
`,
    },
    {
      id: 'api-docs',
      name: 'API Documentation',
      icon: '🔌',
      category: 'Technical',
      description: 'REST API endpoint docs',
      content: `# API Documentation

**Base URL:** \`https://api.example.com/v1\`
**Authentication:** Bearer token in \`Authorization\` header

---

## Authentication

\`\`\`http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
\`\`\`

---

## Endpoints

### GET /resource

Retrieve a list of resources.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| limit | query | integer | No | Max results (default: 20) |
| offset | query | integer | No | Pagination offset |

**Response 200:**

\`\`\`json
{
  "data": [
    {
      "id": "abc123",
      "name": "Example",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "offset": 0
}
\`\`\`

### POST /resource

Create a new resource.

**Request body:**

\`\`\`json
{
  "name": "string (required)",
  "description": "string (optional)"
}
\`\`\`

**Response 201:**

\`\`\`json
{
  "id": "abc123",
  "name": "string",
  "created_at": "2024-01-01T00:00:00Z"
}
\`\`\`

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request — invalid parameters |
| 401 | Unauthorized — invalid API key |
| 404 | Not Found |
| 429 | Rate Limited — slow down |
| 500 | Server Error |
`,
    },
    {
      id: 'weekly-review',
      name: 'Weekly Review',
      icon: '📅',
      category: 'Personal',
      description: 'Weekly wins, lessons, goals',
      content: `# Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

## 🏆 Wins this week

- 
- 
- 

## 📚 What I learned

- 
- 

## 🚧 What didn't go well

- 
- 

## 🔋 Energy & health

**Rating (1-10):** 
**Notes:** 

## 📊 Goals check-in

| Goal | Progress | Notes |
|------|----------|-------|
| | 🟡 In progress | |
| | ✅ Done | |
| | ❌ Missed | |

## 🎯 Next week priorities

1. 
2. 
3. 

## 💭 Random thoughts / ideas

`,
    },
    {
      id: 'research',
      name: 'Research Notes',
      icon: '🔬',
      category: 'Academic',
      description: 'Literature review & notes',
      content: `# Research: {Topic}

**Started:** ${new Date().toLocaleDateString()}
**Status:** 🔵 In progress

---

## Research Question

What am I trying to find out?

## Background

What do I already know?

## Sources

### Source 1: {Title}

**Author:** 
**Year:** 
**URL/DOI:** 

**Summary:**

**Key quotes:**

> 

**My thoughts:**

---

### Source 2: {Title}

**Author:** 
**Year:** 
**URL/DOI:** 

**Summary:**

**Key quotes:**

> 

---

## Synthesis

What patterns or themes emerge across sources?

## Gaps / Open Questions

- 
- 

## Conclusions

What have I found?

## References

1. 
2. 
`,
    },
    {
      id: 'decision',
      name: 'Decision Doc',
      icon: '⚖️',
      category: 'Work',
      description: 'Options analysis and decision record',
      content: `# Decision: {Title}

**Date:** ${new Date().toLocaleDateString()}
**Decision maker(s):** 
**Status:** 🔲 Pending

---

## Context

What situation requires a decision? Why does this matter now?

## Problem Statement

Specific problem we're solving.

## Options Considered

### Option A: {Name}

**Description:** 

**Pros:**
- 
- 

**Cons:**
- 
- 

**Estimated cost/effort:** 

---

### Option B: {Name}

**Description:** 

**Pros:**
- 
- 

**Cons:**
- 
- 

**Estimated cost/effort:** 

---

### Option C: Do nothing

**Pros:**
- No cost
- No risk

**Cons:**
- Problem persists

---

## Comparison Matrix

| Criteria | Weight | Option A | Option B | Option C |
|----------|--------|----------|----------|----------|
| Cost | 30% | | | |
| Speed | 25% | | | |
| Risk | 25% | | | |
| Impact | 20% | | | |
| **Total** | | | | |

## Decision

**We will:** Option _

**Rationale:** 

**Risks & mitigations:** 

## Next Steps

- [ ] 
- [ ] 

---

*Decision made by: [Name] on [Date]*
`,
    },
    {
      id: 'changelog',
      name: 'Changelog',
      icon: '📝',
      category: 'Technical',
      description: 'Keep a changelog (keepachangelog.com)',
      content: `# Changelog

All notable changes to this project will be documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- 

### Changed
- 

### Fixed
- 

---

## [1.0.0] — ${new Date().toISOString().split('T')[0]}

### Added
- Initial release
- Core feature one
- Core feature two

### Security
- 

---

## [0.1.0] — ${new Date(Date.now() - 30*86400000).toISOString().split('T')[0]}

### Added
- Beta release
`,
    },
  ];

  function getAll()         { return TEMPLATES; }
  function getById(id)      { return TEMPLATES.find(t => t.id === id) || null; }
  function getCategories()  { return [...new Set(TEMPLATES.map(t => t.category))]; }
  function getByCategory(c) { return TEMPLATES.filter(t => t.category === c); }

  return { getAll, getById, getCategories, getByCategory };
})();
