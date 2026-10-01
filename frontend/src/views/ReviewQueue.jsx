import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { DecisionCard } from '../components/DecisionCard.jsx';

export function ReviewQueue({ refreshKey, onMutate }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.reviewQueue()
      .then(setList)
      .catch((e) => setErr(e.message));
  }, [refreshKey]);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 18 }}>
        <h2>Human Review Queue</h2>
        {list.length > 0 && (
          <span className="badge action-review">{list.length} pending</span>
        )}
      </div>

      {err && <p className="msg-err">{err}</p>}

      {list.length === 0 && !err
        ? (
          <div className="empty-state">
            <span className="empty-icon">✅</span>
            <p>Queue is clear — all low-risk, high-confidence tickets were auto-routed.</p>
          </div>
        )
        : list.map((d) => (
          <DecisionCard key={d.decisionId} d={d} onMutate={onMutate} />
        ))
      }
    </div>
  );
}
