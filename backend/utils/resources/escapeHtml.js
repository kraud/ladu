// Minimal HTML-entity escaping for values interpolated into the email
// templates (`name`, `email`) — both come straight from user input at
// registration and were previously interpolated raw, a stored-HTML-injection
// vector through the display name.
"use strict";

const ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

module.exports = { escapeHtml };
