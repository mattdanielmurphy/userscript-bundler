---
id: contained-error-indicator
status: "review"
priority: "medium"
assignee: null
epic: null
dueDate: null
created: 2026-07-16T18:43:00-06:00
modified: 2026-07-16T18:43:00-06:00
completedAt: null
labels: []
order: 2
---
# Bug: Contained on-screen error indicator (red dot) instead of notification popups

Modify the userscript error reporting mechanism so that errors do not cause notification popups (GM_notification) to appear. Instead, display a contained on-screen red dot when errors occur. Hovering or clicking the dot should copy the stack trace and display a nice visual feedback.
