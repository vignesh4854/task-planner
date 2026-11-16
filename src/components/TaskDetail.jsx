import { useState, useEffect } from 'react';
import { Sheet, Toggle, Bar } from './ui';
import TaskForm from './TaskForm';
import { useStore, patchEntry, removeFromDay, setStatus } from '../store';
import { isNative } from '../notify';
import {
  getSlot, fromMin, toMin, getItemsForDate, overlaps, progressOf, effStatus, effMetric, isMeasured, isPast, spentSec, fmtSec, wantsRemind, prettyDate, linkLabel,
} from '../logic';

function useTick(on) {
  const [, s] = useState(0);
  useEffect(() => {
    if (!on) return;
    const i = setInterval(() => s((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, [on]);
}

export default function TaskDetail({ date, taskId, onClose }) {
  const state = useStore();
  const task = state.tasks.find((x) => x.id === taskId);
  if (!task) return null;
  return <Inner state={state} task={task} date={date} onClose={onClose} />;
}

function Inner({ state, task, date, onClose }) {
  const id = task.id;
  const e = state.entries[date + '|' + id] || {};
  const slot = getSlot(task, e);
  const [tm, setTm] = useState({
    on: !!slot,
    start: slot ? fromMin(slot.start) : '09:00',
    end: slot ? fromMin(slot.end) : '10:00',
  });
  const [edit, setEdit] = useState(false);
  useTick(!!e.timerStart);

  const patch = (p) => patchEntry(date, id, p);
  const prog = progressOf(task, e);
  const status = effStatus(state, date, e);
  const done = status === 'done';
  const dayCheat = !!state.cheatDays?.[date];
  const em = effMetric(task);
  const overdue = isPast(date) && status === 'none';
  const sb = task.subtasks;
  const sd = e.subDone || {};
  const m = task.metric;

  function saveTime() {
    if (!tm.on) {
      patch({ start: null, end: null, remind: false });
      return;
    }
    if (toMin(tm.end) <= toMin(tm.start)) return alert('End time must be after start time');
    const ns = { start: toMin(tm.start), end: toMin(tm.end) };
    const bad = getItemsForDate(state, date).filter((i) => i.task.id !== id && i.slot && overlaps(i.slot, ns));
    if (bad.length && !confirm(`This overlaps with: ${bad.map((b) => b.task.title).join(', ')}.\nIt will go into a red conflict group. Continue?`)) return;
    patch({ start: tm.start, end: tm.end });
  }

  function toggleSub(i) {
    const it = sb.items[i];
    const nd = { ...sd };
    if (sb.type === 'sequence') {
      if (nd[it.id]) for (let k = i; k < sb.items.length; k++) delete nd[sb.items[k].id];
      else {
        if (i > 0 && !nd[sb.items[i - 1].id]) return;
        nd[it.id] = true;
      }
    } else if (nd[it.id]) delete nd[it.id];
    else nd[it.id] = true;
    patch({ subDone: nd });
  }

  const spent = spentSec(e);
  const targetMin = +m.target || (slot ? slot.end - slot.start : 60);
  const recurring = !!task.recurring?.enabled && !(task.manualDates || []).includes(date);

  function remove() {
    const msg = recurring
      ? `Remove “${task.title}” from this day only?\n\nThe task and all its other days stay. You can restore it from the day page.`
      : `Remove “${task.title}” from this day?\n\nYou can restore it from the day page.`;
    if (confirm(msg)) {
      removeFromDay(date, id);
      onClose();
    }
  }

  return (
    <Sheet title={task.title} onClose={onClose} footer={
      done ? (
        <button className="btn ghost-b" onClick={() => setStatus(date, id, 'none')}>↩ Mark undone</button>
      ) : (
        <button className="btn ok-b" onClick={() => setStatus(date, id, 'done')}>✓ Mark done</button>
      )
    }>
      <p className="muted">{prettyDate(date)}</p>
      {task.goal && <p>🎯 {task.goal}</p>}

      {task.linksOn && task.links?.length > 0 && (
        <div className="links">
          {task.links.map((l) => (
            <a
              key={l.id}
              className="linkbtn"
              href={l.url}
              target={isNative ? undefined : '_blank'}
              rel="noopener noreferrer"
            >
              🔗 <span>{linkLabel(l)}</span> <i>↗</i>
            </a>
          ))}
        </div>
      )}

      {overdue && (
        <div className="warnbox">
          <div className="whead">⚠ Unmarked</div>
          <div className="sm">This day is over and the task is unmarked, so it counts as <b>NOT done</b>. Choose what happened below.</div>
        </div>
      )}

      <div className="card">
        <b>Progress {Math.round(prog)}%</b>
        <Bar v={prog} />
        <div className="muted sm">
          {isMeasured(task)
            ? `From your ${em === 'time' ? 'timer' : em === 'subtasks' ? 'subtasks' : em === 'cost' ? 'cost' : 'percentage'} — the done mark does not change it.`
            : 'This task has no timer, subtasks or metric, so the done mark is its progress.'}
        </div>
      </div>

      <div className="card">
        <b>Status for this day</b>
        <div className="seg stat">
          {[
            ['done', '✓ Done'],
            ['undone', '✕ Not done'],
            ['cheat', '🍰 Cheat'],
            ['none', '○ Unmarked'],
          ].map(([k, l]) => (
            <button key={k} className={status === k ? 'on ' + k : ''} onClick={() => setStatus(date, id, k)}>{l}</button>
          ))}
        </div>
        <div className="muted sm">
          {dayCheat && status === 'cheat'
            ? 'The whole day is a cheat day (turn it off on the day page). Excused tasks do not count as missed.'
            : status === 'cheat'
            ? 'Excused: not counted as missed, and it will not break your streak.'
            : status === 'none'
            ? overdue
              ? 'Unmarked after the day is over counts as NOT done.'
              : 'Not marked yet.'
            : status === 'undone'
            ? 'Counted as not done.'
            : isMeasured(task)
            ? 'Marked done. Your performance still comes from the real progress above.'
            : 'Marked done.'}
        </div>
      </div>

      {/* TIME */}
      <div className="card">
        <Toggle on={tm.on} onChange={(v) => setTm({ ...tm, on: v })} label="Schedule for this day" />
        {tm.on && (
          <div className="row">
            <input className="in" type="time" value={tm.start} onChange={(ev) => setTm({ ...tm, start: ev.target.value })} />
            <span>to</span>
            <input className="in" type="time" value={tm.end} onChange={(ev) => setTm({ ...tm, end: ev.target.value })} />
          </div>
        )}
        <button className="btn ghost-b" onClick={saveTime}>Save time</button>
        <Toggle
          on={wantsRemind(task, e)}
          onChange={(v) => patch({ remind: v })}
          label="Ring alarm"
          hint="Sound and vibration at the start time"
          disabled={!slot}
        />
        {!slot && <p className="muted sm">Save a time first to switch the alarm on.</p>}
      </div>

      {/* SUBTASKS */}
      {sb?.enabled && sb.items.length > 0 && (
        <div className="card">
          <b>{sb.type === 'sequence' ? '➡ Steps, in order' : sb.type === 'todo' ? '☑ Checklist' : '🔗 Linked tasks'}</b>
          {sb.items.map((it, i) => {
            const locked = sb.type === 'sequence' && i > 0 && !sd[sb.items[i - 1].id];
            return (
              <div key={it.id} className={'sub' + (locked ? ' locked' : '') + (sb.type === 'sequence' ? ' seq' : '')}>
                <button className={'chk' + (sd[it.id] ? ' on' : '')} onClick={() => toggleSub(i)} disabled={locked}>
                  {sd[it.id] ? '✓' : sb.type === 'sequence' ? i + 1 : ''}
                </button>
                <div style={{ flex: 1 }}>
                  <div className={sd[it.id] ? 'strike' : ''}>{it.title}</div>
                  {it.description && <div className="muted sm">{it.description}</div>}
                  {sb.type === 'sequence' && it.est && <div className="muted sm">≈ {it.est} min</div>}
                </div>
                {sb.type === 'todo' && sb.useWeight && <span className="badge">{it.weight || 0}%</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* METRIC INPUT */}
      <div className="card">
        {em === 'time' && (
          <>
            <b>Timer</b>
            <div className="timer">{fmtSec(spent)}</div>
            <div className="muted sm" style={{ textAlign: 'center' }}>target {targetMin} min</div>
            <div className="row">
              {e.timerStart ? (
                <button className="btn" onClick={() => patch({ spent: spentSec(e), timerStart: null })}>⏸ Pause</button>
              ) : (
                <button className="btn" onClick={() => patch({ timerStart: Date.now() })}>▶ Play</button>
              )}
              <button className="btn ghost-b" onClick={() => patch({ spent: 0, timerStart: null })}>Reset</button>
            </div>
          </>
        )}
        {em === 'cost' && (
          <>
            <b>Money spent (target {m.target || 0})</b>
            <input className="in" type="number" min="0" value={e.cost ?? ''} onChange={(ev) => patch({ cost: ev.target.value })} placeholder="Amount so far" />
          </>
        )}
        {em === 'percent' && (
          <>
            <b>Percentage done: {e.percent || 0}%</b>
            <input type="range" min="0" max="100" value={e.percent || 0} onChange={(ev) => patch({ percent: +ev.target.value })} style={{ width: '100%' }} />
          </>
        )}
        {em === 'subtasks' && <b>Progress comes from the subtasks above</b>}
        {em === 'complete' && <b>Plain task — mark it done below when finished</b>}
      </div>

      {task.notesOn && (
        <div className="card">
          <b>📝 Notes for this day</b>
          <textarea
            className="in"
            rows={4}
            placeholder="How did it go? Anything to remember…"
            value={e.note || ''}
            onChange={(ev) => patch({ note: ev.target.value })}
          />
        </div>
      )}

      <div className="row">
        <button className="btn ghost-b" onClick={() => setEdit(true)}>Edit task</button>
        <button className="btn danger" onClick={remove}>Remove from this day</button>
      </div>
      {edit && <TaskForm task={task} onClose={() => setEdit(false)} />}
    </Sheet>
  );
}
