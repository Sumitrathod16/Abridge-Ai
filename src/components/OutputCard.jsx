import { useState } from 'react';

function copyText(text, onToast) {
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); onToast('Copied to clipboard.'); }
    catch { onToast('Could not copy — select the text manually.'); }
    document.body.removeChild(ta);
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => onToast('Copied to clipboard.'), fallback);
  } else { fallback(); }
}

export default function OutputCard({ index, title, body, agent, badge, copyable, children, onToast }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!copyable) return;
    copyText(copyable, msg => { onToast(msg); setCopied(true); setTimeout(() => setCopied(false), 1400); });
  };

  return (
    <article className="card" data-agent={agent || ''}>
      <div className="card-head">
        <div className="card-title">
          <span className="card-index">0{index}</span>
          <span>{title}</span>
        </div>
        <div className="card-head-actions">
          {badge && <span className="card-badge">{badge}</span>}
          {copyable && (
            <button
              type="button"
              className={`card-copy${copied ? ' is-copied' : ''}`}
              onClick={handleCopy}
              aria-label={`Copy ${title} output`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>
      <div className="card-body">
        {body && <pre>{body}</pre>}
        {children}
      </div>
    </article>
  );
}
