import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cssPath = join(__dirname, '..', 'dist', 'extension.css');

const cssContent = readFileSync(cssPath, 'utf8');
const darkMarker = '/* ============================================================\n   AgentDock Studio — Dark Mode Theme Engine';

let baseContent;
if (cssContent.includes(darkMarker)) {
  baseContent = cssContent.split(darkMarker)[0].trimEnd();
} else {
  // Fallback search
  const altIndex = cssContent.indexOf('AgentDock Studio — Dark Mode Theme Engine');
  if (altIndex !== -1) {
    const cutIndex = cssContent.lastIndexOf('/*', altIndex);
    baseContent = cssContent.slice(0, cutIndex).trimEnd();
  } else {
    throw new Error('Dark mode section not found in dist/extension.css');
  }
}

const pitchBlackTheme = `
/* ============================================================
   AgentDock Studio — True Pitch Black (AMOLED / Obsidian) Dark Theme
   ============================================================ */

/* Pitch Black CSS Custom Properties */
[data-theme="dark"] {
  --bg: #000000;
  --bg-subtle: #080808;
  --bg-card: #0c0c0c;
  --bg-elevated: #141414;
  --border: #1e1e1e;
  --border-subtle: #161616;
  --border-focus: #22c55e;
  --line: #1e1e1e;
  --green: #22c55e;
  --green-hover: #16a34a;
  --green-active: #15803d;
  --green-glow: rgba(34, 197, 94, 0.22);
  --green-glow-strong: rgba(34, 197, 94, 0.45);
  --muted: #9ca3af;
  --text-main: #f3f4f6;
  --text-heading: #ffffff;
  --text-dim: #6b7280;
  color-scheme: dark;
}

/* Base Canvas & Body */
[data-theme="dark"],
[data-theme="dark"] body,
[data-theme="dark"] #app,
[data-theme="dark"] .main,
[data-theme="dark"] .workspace-area {
  background-color: #000000 !important;
  color: #f3f4f6 !important;
}

/* Sidebar Navigation (Desktop & Responsive Rail) */
[data-theme="dark"] .sidebar {
  background: #080808 !important;
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .brand {
  color: #ffffff !important;
}
[data-theme="dark"] .brand-mark {
  background: #15803d !important;
  color: #ffffff !important;
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.25) !important;
}
[data-theme="dark"] .workspace-switch {
  background: #111111 !important;
  border-color: #222222 !important;
  color: #ffffff !important;
}
[data-theme="dark"] .workspace-switch:hover {
  background: #181818 !important;
  border-color: #2e2e2e !important;
}
[data-theme="dark"] .workspace-switch small {
  color: #9ca3af !important;
}
[data-theme="dark"] .avatar {
  background: #181818 !important;
  border: 1px solid #262626 !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .nav-label {
  color: #555555 !important;
}
[data-theme="dark"] .nav-button {
  color: #9ca3af !important;
}
[data-theme="dark"] .nav-button:hover {
  background: #141414 !important;
  color: #ffffff !important;
}
[data-theme="dark"] .nav-button.active {
  background: #181818 !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .nav-button.active::before {
  background: #22c55e !important;
}
[data-theme="dark"] .nav-button .pill,
[data-theme="dark"] .pill {
  background: #1c1c1c !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .cost-card {
  background: #101010 !important;
  border-color: #202020 !important;
  color: #e5e7eb !important;
}
[data-theme="dark"] .cost-card p {
  color: #9ca3af !important;
}
[data-theme="dark"] .cost-card .seed {
  color: #4ade80 !important;
}
[data-theme="dark"] .user {
  color: #ffffff !important;
}
[data-theme="dark"] .user small {
  color: #888888 !important;
}

/* Mobile Bottom Navigation Bar in Dark Mode */
@media (max-width: 640px) {
  [data-theme="dark"] .sidebar {
    background: #080808 !important;
    border-top: 1px solid #1e1e1e !important;
    border-right: none !important;
  }
}

/* Topbar Header */
[data-theme="dark"] .topbar {
  background: #080808 !important;
  border-color: #1e1e1e !important;
  color: #9ca3af !important;
}
[data-theme="dark"] .breadcrumbs {
  color: #888888 !important;
}
[data-theme="dark"] .breadcrumbs strong {
  color: #ffffff !important;
}
[data-theme="dark"] .status {
  color: #9ca3af !important;
}
[data-theme="dark"] .status:before {
  background: #22c55e !important;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.7) !important;
}
[data-theme="dark"] #save-status {
  color: #888888 !important;
}

/* Action Buttons */
[data-theme="dark"] button.secondary,
[data-theme="dark"] .btn.secondary {
  background: #121212 !important;
  border-color: #242424 !important;
  color: #e5e7eb !important;
}
[data-theme="dark"] button.secondary:hover:not(:disabled),
[data-theme="dark"] .btn.secondary:hover:not(:disabled) {
  background: #1c1c1c !important;
  border-color: #383838 !important;
  color: #ffffff !important;
}
[data-theme="dark"] button.secondary:active:not(:disabled),
[data-theme="dark"] .btn.secondary:active:not(:disabled) {
  background: #161616 !important;
}
[data-theme="dark"] button.primary,
[data-theme="dark"] .btn.primary {
  background: #16a34a !important;
  border-color: #16a34a !important;
  color: #ffffff !important;
}
[data-theme="dark"] button.primary:hover:not(:disabled),
[data-theme="dark"] .btn.primary:hover:not(:disabled) {
  background: #22c55e !important;
  border-color: #22c55e !important;
  box-shadow: 0 4px 18px rgba(34, 197, 94, 0.4) !important;
}
[data-theme="dark"] button.primary:active:not(:disabled),
[data-theme="dark"] .btn.primary:active:not(:disabled) {
  background: #15803d !important;
}
[data-theme="dark"] button.danger,
[data-theme="dark"] .btn.danger {
  background: #160c0c !important;
  border-color: #3b1717 !important;
  color: #f87171 !important;
}
[data-theme="dark"] button.danger:hover:not(:disabled),
[data-theme="dark"] .btn.danger:hover:not(:disabled) {
  background: #241111 !important;
  border-color: #5c2020 !important;
  color: #fca5a5 !important;
}
[data-theme="dark"] .text-button {
  color: #9ca3af !important;
}
[data-theme="dark"] .text-button:hover {
  color: #4ade80 !important;
}

/* Typography & Headings */
[data-theme="dark"] .overline {
  color: #4ade80 !important;
}
[data-theme="dark"] h1,
[data-theme="dark"] h2,
[data-theme="dark"] h3,
[data-theme="dark"] h4,
[data-theme="dark"] .page-head h1,
[data-theme="dark"] .section-heading h2,
[data-theme="dark"] .settings-card h2,
[data-theme="dark"] .project-card h2,
[data-theme="dark"] .modal-head h2 {
  color: #ffffff !important;
}
[data-theme="dark"] .page-head p,
[data-theme="dark"] .settings-card p,
[data-theme="dark"] .project-card p,
[data-theme="dark"] .modal-body p {
  color: #9ca3af !important;
}
[data-theme="dark"] .bottom-note {
  color: #6b7280 !important;
}

/* Summary Strip Metrics */
[data-theme="dark"] .summary-strip {
  background: #080808 !important;
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .summary-item {
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .summary-icon {
  background: #161616 !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .summary-item small {
  color: #888888 !important;
}
[data-theme="dark"] .summary-item strong {
  color: #ffffff !important;
}
[data-theme="dark"] .summary-item em {
  color: #4ade80 !important;
}

/* Studio Panels & Tabs */
[data-theme="dark"] .panel {
  background: #0c0c0c !important;
  border-color: #1e1e1e !important;
  color: #f3f4f6 !important;
}
[data-theme="dark"] .panel-title {
  background: #0c0c0c !important;
  border-color: #1e1e1e !important;
  color: #ffffff !important;
}
[data-theme="dark"] .panel-title small {
  color: #888888 !important;
}
[data-theme="dark"] .panel-footer {
  background: #0c0c0c !important;
  border-color: #1e1e1e !important;
  color: #888888 !important;
}
[data-theme="dark"] .studio-tabs {
  background: #080808 !important;
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .tab {
  color: #888888 !important;
}
[data-theme="dark"] .tab:hover {
  color: #ffffff !important;
}
[data-theme="dark"] .tab.active {
  color: #4ade80 !important;
  border-color: #22c55e !important;
}
[data-theme="dark"] .device-btn {
  color: #71717a !important;
}
[data-theme="dark"] .device-btn:hover {
  color: #ffffff !important;
}
[data-theme="dark"] .device-btn.active {
  color: #4ade80 !important;
}

/* Preview Wrap & URL Bar */
[data-theme="dark"] .preview-wrap {
  background: #000000 !important;
}
[data-theme="dark"] .preview-pane {
  background: #000000 !important;
}
[data-theme="dark"] .urlbar {
  background: #080808 !important;
  border-color: #1e1e1e !important;
  color: #888888 !important;
}
[data-theme="dark"] .urlbar code {
  color: #4ade80 !important;
}
[data-theme="dark"] .urlbar .dot {
  background: #242424 !important;
}

/* Code Pane, File Browser & Editor */
[data-theme="dark"] .code-pane {
  background: #000000 !important;
}
[data-theme="dark"] .file-browser {
  background: #080808 !important;
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .file-tree-head {
  color: #888888 !important;
}
[data-theme="dark"] .tree-file {
  color: #9ca3af !important;
}
[data-theme="dark"] .tree-file:hover {
  background: #141414 !important;
  color: #ffffff !important;
}
[data-theme="dark"] .tree-file.active {
  background: #1a1a1a !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .file-count {
  color: #666666 !important;
}
[data-theme="dark"] .file-browser #file-search {
  background: #0c0c0c !important;
  border-color: #222222 !important;
  color: #ffffff !important;
}
[data-theme="dark"] .file-tabs {
  background: #080808 !important;
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .file-tab {
  color: #888888 !important;
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .file-tab.active {
  background: #121212 !important;
  color: #4ade80 !important;
  border-bottom-color: #22c55e !important;
}
[data-theme="dark"] .editor-container {
  background: #000000 !important;
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .line-numbers {
  background: #050505 !important;
  color: #4b5563 !important;
  border-right-color: #181818 !important;
}
[data-theme="dark"] .code-pane .editor-wrap textarea#editor {
  background: #000000 !important;
  color: #f3f4f6 !important;
}
[data-theme="dark"] .editor-status-bar {
  background: #080808 !important;
  border-top-color: #1e1e1e !important;
  color: #888888 !important;
}
[data-theme="dark"] .autocomplete-box {
  background: #0c0c0c !important;
  border-color: #262626 !important;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.85) !important;
}
[data-theme="dark"] .autocomplete-item {
  color: #d1d5db !important;
}
[data-theme="dark"] .autocomplete-item:hover,
[data-theme="dark"] .autocomplete-item.active {
  background: #1c1c1c !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .autocomplete-item small {
  color: #6b7280 !important;
}

/* Terminal & Execution Console */
[data-theme="dark"] .terminal-panel {
  background: #000000 !important;
  color: #f3f4f6 !important;
}
[data-theme="dark"] #term-output {
  background: #000000 !important;
  color: #e5e7eb !important;
}
[data-theme="dark"] .term-input-row {
  background: #080808 !important;
  border-top-color: #1e1e1e !important;
}
[data-theme="dark"] .term-input-row span {
  color: #22c55e !important;
}
[data-theme="dark"] #term-input {
  color: #ffffff !important;
}
[data-theme="dark"] #term-input::placeholder {
  color: #555555 !important;
}
[data-theme="dark"] .stdin-row {
  background: #080808 !important;
  border-top-color: #1e1e1e !important;
}
[data-theme="dark"] #stdin-input {
  background: #000000 !important;
  border-color: #242424 !important;
  color: #ffffff !important;
}
[data-theme="dark"] #stdin-input:focus {
  border-color: #22c55e !important;
}
[data-theme="dark"] .run-output {
  background: #0a0a0a !important;
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .run-toolbar {
  background: #080808 !important;
  border-bottom-color: #1e1e1e !important;
}
[data-theme="dark"] .run-output-text {
  background: #000000 !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .output-meta {
  background: #080808 !important;
  border-top-color: #1e1e1e !important;
  color: #888888 !important;
}
[data-theme="dark"] .output-actions {
  background: #080808 !important;
  border-top-color: #1e1e1e !important;
}
[data-theme="dark"] .output-placeholder {
  color: #666666 !important;
}

/* Inputs, Textareas, Selects & Forms */
[data-theme="dark"] input,
[data-theme="dark"] textarea,
[data-theme="dark"] select {
  background: #080808 !important;
  color: #ffffff !important;
  border-color: #242424 !important;
}
[data-theme="dark"] input:focus,
[data-theme="dark"] textarea:focus,
[data-theme="dark"] select:focus {
  border-color: #22c55e !important;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25) !important;
}
[data-theme="dark"] input::placeholder,
[data-theme="dark"] textarea::placeholder {
  color: #555555 !important;
}
[data-theme="dark"] .field small {
  color: #888888 !important;
}
[data-theme="dark"] .toggle-row {
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .context-option {
  border-color: #1e1e1e !important;
  color: #d1d5db !important;
}
[data-theme="dark"] .context-option small {
  color: #888888 !important;
}

/* Component & Project Cards */
[data-theme="dark"] .component-card,
[data-theme="dark"] .project-card,
[data-theme="dark"] .settings-card {
  background: #0a0a0a !important;
  border-color: #1e1e1e !important;
  color: #f3f4f6 !important;
}
[data-theme="dark"] .component-card:hover,
[data-theme="dark"] .project-card:hover {
  border-color: #2e2e2e !important;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7) !important;
}
[data-theme="dark"] .welcome-swatch {
  background: #181818 !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .component-art {
  background: #121212 !important;
}
[data-theme="dark"] .component-art.peach {
  background: #18120e !important;
}
[data-theme="dark"] .component-art.lavender {
  background: #16121c !important;
}
[data-theme="dark"] .component-art.sand {
  background: #181710 !important;
}
[data-theme="dark"] .mini-metric,
[data-theme="dark"] .mini-pricing,
[data-theme="dark"] .mini-faq {
  background: #111111 !important;
  border-color: #222222 !important;
  color: #e5e7eb !important;
}
[data-theme="dark"] .mini-line {
  background: #242424 !important;
}
[data-theme="dark"] .component-meta small {
  color: #888888 !important;
}
[data-theme="dark"] .component-meta .plus {
  border-color: #262626 !important;
  color: #4ade80 !important;
}

/* Assistant Panel */
[data-theme="dark"] .agent-identity {
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .agent-avatar {
  background: #141414 !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .agent-note {
  background: #101010 !important;
  border-color: #202020 !important;
  color: #9ca3af !important;
}
[data-theme="dark"] .agent-note strong {
  color: #4ade80 !important;
}
[data-theme="dark"] .agent-step {
  border-color: #1a1a1a !important;
  color: #9ca3af !important;
}
[data-theme="dark"] .step-number {
  border-color: #242424 !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .agent-step strong {
  color: #ffffff !important;
}
[data-theme="dark"] .agent-controls {
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .tiny-note {
  color: #71717a !important;
}

/* Console Panel & Checks */
[data-theme="dark"] .console-panel {
  background: #050505 !important;
}
[data-theme="dark"] .console-line {
  border-color: #141414 !important;
  color: #d1d5db !important;
}
[data-theme="dark"] .console-line span {
  color: #6b7280 !important;
}
[data-theme="dark"] .console-line.console-error {
  background: #1c0b0a !important;
  color: #f87171 !important;
}
[data-theme="dark"] .check {
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .check small {
  color: #888888 !important;
}

/* Badges, Notices, History & Kbd */
[data-theme="dark"] .badge {
  background: #132217 !important;
  border: 1px solid #1a3822 !important;
  color: #4ade80 !important;
}
[data-theme="dark"] .badge.warning {
  background: #241a08 !important;
  border: 1px solid #3d2c0e !important;
  color: #fbbf24 !important;
}
[data-theme="dark"] .notice {
  background: #08180e !important;
  border-color: #166534 !important;
  color: #86efac !important;
}
[data-theme="dark"] .inline-code {
  background: #0e0e0e !important;
  border: 1px solid #222222 !important;
  color: #e5e7eb !important;
}
[data-theme="dark"] .divider {
  background: #1e1e1e !important;
}
[data-theme="dark"] .history-item {
  border-color: #1e1e1e !important;
  color: #e5e7eb !important;
}
[data-theme="dark"] .history-item p {
  color: #9ca3af !important;
}
[data-theme="dark"] .empty {
  color: #71717a !important;
}
[data-theme="dark"] .kbd {
  background: #141414 !important;
  border-color: #262626 !important;
  color: #a1a1aa !important;
}

/* Modal Dialogs */
[data-theme="dark"] dialog {
  background: #0a0a0a !important;
  border-color: #242424 !important;
  color: #ffffff !important;
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.95) !important;
}
[data-theme="dark"] dialog::backdrop {
  background: rgba(0, 0, 0, 0.85) !important;
}
[data-theme="dark"] .modal-head {
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .modal-actions {
  border-color: #1e1e1e !important;
}
[data-theme="dark"] .diff-columns pre {
  background: #050505 !important;
  border: 1px solid #1a1a1a !important;
  color: #9ca3af !important;
}
[data-theme="dark"] .diff-columns pre:last-child {
  background: #03170a !important;
  border: 1px solid #14532d !important;
  color: #4ade80 !important;
}

/* Toast Notifications */
[data-theme="dark"] #toast {
  background: #111111 !important;
  color: #ffffff !important;
  border: 1px solid #22c55e !important;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.85) !important;
}

/* Auth Screens */
[data-theme="dark"] .auth-intro {
  background: #080808 !important;
  border-right: 1px solid #1a1a1a !important;
  color: #f3f4f6 !important;
}
[data-theme="dark"] .auth-intro h1 {
  color: #ffffff !important;
}
[data-theme="dark"] .auth-intro p {
  color: #9ca3af !important;
}
[data-theme="dark"] .auth-feature {
  color: #4ade80 !important;
}
[data-theme="dark"] .auth-intro small {
  color: #666666 !important;
}
[data-theme="dark"] .auth-form-wrap {
  background: #000000 !important;
}
[data-theme="dark"] .auth-form h2 {
  color: #ffffff !important;
}
[data-theme="dark"] .auth-form p {
  color: #9ca3af !important;
}
[data-theme="dark"] .auth-form .field input {
  background: #080808 !important;
  border-color: #242424 !important;
  color: #ffffff !important;
}

/* Pitch Black Scrollbars */
[data-theme="dark"] ::-webkit-scrollbar-track {
  background: #000000 !important;
}
[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: #242424 !important;
  border-radius: 6px !important;
}
[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
  background: #3a3a3a !important;
}
[data-theme="dark"] .run-output-text::-webkit-scrollbar-thumb,
[data-theme="dark"] #term-output::-webkit-scrollbar-thumb,
[data-theme="dark"] .editor-container textarea::-webkit-scrollbar-thumb {
  background: #242424 !important;
}
[data-theme="dark"] .run-output-text::-webkit-scrollbar-thumb:hover,
[data-theme="dark"] #term-output::-webkit-scrollbar-thumb:hover,
[data-theme="dark"] .editor-container textarea::-webkit-scrollbar-thumb:hover {
  background: #3a3a3a !important;
}
`;

const updatedCss = baseContent + '\n' + pitchBlackTheme.trim() + '\n';
writeFileSync(cssPath, updatedCss, 'utf8');
console.log('Successfully applied pitch black theme to dist/extension.css!');
