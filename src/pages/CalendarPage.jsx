import { useState } from 'react';
import DayPage from './DayPage';
import { useStore } from '../store';
import { fmt, today, addDays, getItemsForDate, hasConflict } from '../logic';

export default function CalendarPage() {
  const state = useStore();
  const [cur, setCur] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [day, setDay] = useState(null);
  // past days (last 14) that still have unmarked tasks
  const pending = [];
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today(), -i);
    const n = getItemsForDate(state, d).filter((it) => it.status === 'none').length;
    if (n) pending.push({ d, n });
  }
  const pendingTotal = pending.reduce((a, x) => a + x.n, 0);
  const y = cur.getFullYear();
  const m = cur.getMonth();
  const first = new Date(y, m, 1).getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(fmt(new Date(y, m, d)));

  return (
    <div className="page">
      {pendingTotal > 0 && (
        <div className="warnbox tap" onClick={() => setDay(pending[pending.length - 1].d)}>
          <div className="whead">⚠ {pendingTotal} unmarked task{pendingTotal > 1 ? 's' : ''} on {pending.length} past day{pending.length > 1 ? 's' : ''}</div>
          <div className="sm">They count as NOT done until you mark them. Tap to review the oldest day.</div>
        </div>
      )}
      <div className="cal-h">
        <button className="ghost" onClick={() => setCur(new Date(y, m - 1, 1))}>‹</button>
        <h2 style={{ margin: 0 }}>{cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button className="ghost" onClick={() => setCur(new Date(y, m + 1, 1))}>›</button>
      </div>
      <div className="cal-g big">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
          <div key={w} className="cal-w">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const items = getItemsForDate(state, d);
          const bad = hasConflict(items);
          const live = items.filter((it) => it.status !== 'cheat');
          const all = live.length > 0 && live.every((it) => it.status === 'done');
          const unm = d < today() && live.some((it) => it.status === 'none');
          const cheat = !!state.cheatDays?.[d] || (items.length > 0 && live.length === 0);
          return (
            <button key={i} className={'cal-d big' + (d === today() ? ' today' : '')} onClick={() => setDay(d)}>
              {+d.slice(8)}
              {items.length > 0 && (
                <span className={'dot' + (bad ? ' bad' : unm ? ' warn' : all ? ' ok' : cheat ? ' cheatc' : '')}>{unm ? '!' : cheat ? '🍰' : items.length}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="muted sm">🔴 time clash · 🟠 unmarked · 🟢 all done · 🟣 cheat day · 🔵 planned. Tap a date to open it.</p>
      <button className="btn ghost-b" onClick={() => { setCur(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setDay(today()); }}>
        Today
      </button>
      {day && <DayPage date={day} onClose={() => setDay(null)} />}
    </div>
  );
}
