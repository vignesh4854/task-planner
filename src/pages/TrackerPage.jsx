import { useState } from 'react';
import { useStore } from '../store';
import { Bar } from '../components/ui';
import { Ring } from '../components/charts';
import TaskStatsPage from '../components/TaskStatsPage';
import OverallPage from '../components/OverallPage';
import { taskStats, today, getItemsForDate } from '../logic';
import { overallStats, scoreLabel } from '../stats';

export default function TrackerPage() {
  const state = useStore();
  const [open, setOpen] = useState(null);
  const [overall, setOverall] = useState(false);
  const tracked = state.tasks.filter((t) => t.tracker);
  const o = overallStats(state, 30);
  const todayItems = getItemsForDate(state, today());
  const todayLive = todayItems.filter((i) => i.status !== 'cheat');
  const todayDone = todayLive.filter((i) => i.status === 'done').length;

  return (
    <div className="page">
      <h2 style={{ margin: 0 }}>Tracker</h2>

      <div className="card tap hero" onClick={() => setOverall(true)}>
        <div className="row">
          <Ring value={o.score} size={76} stroke={8} color={o.score >= 70 ? 'var(--ok)' : o.score >= 40 ? 'var(--pri)' : 'var(--bad)'} />
          <div style={{ flex: 1 }}>
            <div className="muted sm">Overall · last 30 days</div>
            <b style={{ fontSize: 18 }}>{scoreLabel(o.score)}</b>
            <div className="muted sm">
              {o.planned ? `${o.completion}% finished · ${o.consistency}% consistent` : 'Plan tasks to see stats'}
            </div>
          </div>
          <span className="chev">›</span>
        </div>
        <div className="muted sm">Today: {todayDone}/{todayLive.length} done{todayItems.length > todayLive.length ? ' · cheat day' : ''}</div>
        <Bar v={todayLive.length ? (todayDone / todayLive.length) * 100 : 0} />
      </div>

      <h4>Tracked tasks</h4>
      {!tracked.length && (
        <div className="empty">
          <p>No tracked tasks yet.</p>
          <p className="muted">Open a task and switch on “Track streaks &amp; stats”.</p>
        </div>
      )}

      {tracked.map((t) => {
        const s = taskStats(t, state);
        return (
          <div className="card tap trk" key={t.id} onClick={() => setOpen(t.id)}>
            <div className="row between">
              <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</b>
              <span className="chev">›</span>
            </div>
            <div className="row" style={{ gap: 14 }}>
              <span>🔥 {s.streak}</span>
              <span>✔ {s.rate30}%</span>
              <span className="muted sm">{s.doneN}/{s.sched} days</span>
              {s.cheat > 0 && <span className="muted sm">🍰 {s.cheat}</span>}
              {s.unmarked > 0 && <span className="sm bad">⚠ {s.unmarked} unmarked</span>}
            </div>
            <div className="mini-strip">
              {s.strip.map((c) => (
                <i key={c.date} className={c.done ? 'on' : c.cheat ? 'cheat' : c.scheduled ? 'miss' : ''} />
              ))}
            </div>
          </div>
        );
      })}

      {open && <TaskStatsPage taskId={open} onClose={() => setOpen(null)} />}
      {overall && <OverallPage onClose={() => setOverall(false)} />}
    </div>
  );
}
