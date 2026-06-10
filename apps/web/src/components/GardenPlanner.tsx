/**
 * Garden Planner — maps out upcoming plantings: assigning plants to beds for a
 * season with conflict detection (incompatible neighbours, overcrowding,
 * rotation violations) and a planting/harvest calendar. The supporting rules
 * and API arrive in Phase 4; this is the placeholder that frames the section.
 */
export function GardenPlanner() {
  return (
    <section aria-labelledby="planner-heading" className="card">
      <h3 id="planner-heading">Garden Planner</h3>

      <div className="placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="1.5" />
          <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
          <path d="M7.5 13.5l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="placeholder__lead">Plan a season before you plant.</p>
        <p className="muted">
          The planner is coming in the next phase. It will let you assign plants to beds
          for a season and warn you — at plan time — about incompatible neighbours,
          overcrowding, and crop-rotation conflicts, then generate a planting and harvest
          calendar from your hardiness zone.
        </p>
        <ul className="placeholder__list">
          <li>Assign plants to beds based on available space</li>
          <li>Conflict detection before anything goes in the ground</li>
          <li>Zone-aware planting &amp; harvest calendar</li>
          <li>Track plan vs. actual</li>
        </ul>
        <p className="muted">
          In the meantime, set up your beds in <strong>Garden Manager</strong> and browse
          the <strong>Plant Directory</strong> for spacing and companion guidance.
        </p>
      </div>
    </section>
  );
}
