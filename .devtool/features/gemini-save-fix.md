---
id: gemini-save-fix
status: "review"
priority: "medium"
assignee: null
epic: null
dueDate: null
created: 2026-07-10T00:35:12-06:00
modified: 2026-07-10T00:36:59-06:00
completedAt: null
labels: []
order: 1
---
# Bug: Fix Gemini thread autosave trigger condition

Improve the Gemini userscript's auto-save trigger so that it waits until the actual response generation finishes rather than saving whenever a loading indicator/text state updates or when text stops updating for a brief period.
