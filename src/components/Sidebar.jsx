export default function Sidebar({ history, activeId, onLoad, onDelete, onClear, onOverview }) {
  return (
    <aside className="side" aria-label="Primary navigation">
      <div className="side-brand">
        <button type="button" className="side-logo-btn" onClick={onOverview} aria-label="AbridgeAI home">
          <img src="/logo.png" alt="AbridgeAI" className="navbar-logo" />
        </button>
      </div>

      <nav className="side-nav" aria-label="Sections">
        <button type="button" className="side-link is-active" onClick={onOverview} data-view="overview">
          <svg className="side-link-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="11" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="3" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="11" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Overview
        </button>
      </nav>

      <div className="side-history-section">
        <div className="side-history-header">
          <span className="side-history-title">
            Projects
            {history.length > 0 && (
              <span className="side-history-count" id="side-history-count">{history.length}</span>
            )}
          </span>
          {history.length > 0 && (
            <button type="button" className="rail-action" onClick={onClear} id="history-clear">
              Clear all
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="history-empty" id="history-empty">No projects yet.</div>
        ) : (
          <ol className="history-list-flat" id="history-list">
            {history.map(item => (
              <li
                key={item.id}
                className={`history-row${item.id === activeId ? ' is-active' : ''}`}
                tabIndex={0}
                aria-label={`Open project ${item.name || item.idea || 'untitled'}`}
                onClick={() => onLoad(item)}
                onKeyDown={e => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLoad(item); }
                }}
              >
                <div>
                  <p className="history-row-title">{item.name || item.idea || 'Untitled'}</p>
                  <div className="history-row-meta">{item.time || ''}</div>
                </div>
                <button
                  type="button"
                  className="history-item-del"
                  aria-label={`Delete ${item.name || item.idea || 'project'}`}
                  onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="side-spacer" />
    </aside>
  );
}
