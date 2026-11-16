import { useState } from 'react';
import { Sheet, Bar, Picker } from '../components/ui';
import TaskDetail from '../components/TaskDetail';
import { useStore, addToDay, setStatus, setStatusMany, toggleCheatDay, restoreToDay } from '../store';
import {
  getItemsForDate, getRemovedForDate, groupItems, progressOf, isMeasured, isPast, fromMin, prettyDate, wantsRemind,
} from '../logic';

const LABEL = { done: '✓ Done', undone: '✕ Not done', cheat: '🍰 Cheat', none: '' };

export default function DayPage({ date, onClose }) {
  const state = useStore();
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);

  const items = getItemsForDate(state, date);
  const removed = getRemovedForDate(state, date);
  const past = isPast(date);
  const cheatDay = !!state.cheatDays?.[date];

  const active = items.filter((i) => i.status !== 'cheat');
  const cheats = items.filter((i) => i.status === 'cheat');
  const unmarked = past ? active.filter((i) => i.status === 'none') : [];
  const rest = active.filter((i) => !unmarked.includes(i));
  const { blocks, free } = groupItems(rest);
  const doneN = active.filter((i) => i.status === 'done').length;
  const notDone = active.filter((i) => i.status !== 'done');

  function markAllDone(list, label) {
    if (!list.length) return;
    const measured = list.filter((i) => isMeasured(i.task)).length;
    const msg =
      `Mark ${label} ${list.length} task${list.length > 1 ? 's' : ''} as DONE?` +
      (measured
        ? `\n\n${measured} of them use a timer, subtasks, cost or percentage. Only the done mark changes — their progress stays exactly as you recorded it.`
        : '');
    if (confirm(msg)) setStatusMany(date, list.map((i) => i.task.id), 'done');
  }

  function cheatToggle() {
    if (cheatDay) return toggleCheatDay(date);
    if (
      confirm(
        `Make this a CHEAT DAY?\n\nEvery task that is not already marked done is excused: it is not counted as missed, your streaks stay safe, and no alarms ring. Work you marked done still counts.`
      )
    )
      toggleCheatDay(date);
  }

  const Row = ({ it, red, review }) => {
    const { task, entry, status } = it;
    const p = progressOf(task, entry);
    const done = status === 'done';
    const reached = isMeasured(task) && !done && p >= 99.99;
    return (
      <div className={'trow' + (red ? ' red' : '') + (status === 'cheat' ? ' cheat' : '')} onClick={() => setOpen(task.id)}>
        {review ? (
          <div className="rv" onClick={(ev) => ev.stopPropagation()}>
            <button className="rvb ok" title="Done" onClick={() => setStatus(date, task.id, 'done')}>✓</button>
            <button className="rvb no" title="Not done" onClick={() => setStatus(date, task.id, 'undone')}>✕</button>
            <button className="rvb ch" title="Cheat / excuse" onClick={() => setStatus(date, task.id, 'cheat')}>🍰</button>
          </div>
        ) : (
          <button
            className={'chk' + (done ? ' on' : '')}
            title={done ? 'Mark undone' : 'Mark done'}
            onClick={(ev) => {
              ev.stopPropagation();
              setStatus(date, task.id, done ? 'none' : status === 'cheat' ? 'none' : 'done');
            }}
          >
            {done ? '✓' : status === 'cheat' ? '🍰' : ''}
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <b className={done ? 'strike' : ''}>{task.title}</b>
          <div className="muted sm">
            {it.slot ? `🕘 ${fromMin(it.slot.start)}–${fromMin(it.slot.end)}` : 'Tap to choose a time'}
            {it.slot && wantsRemind(task, entry) && status !== 'cheat' ? '  ·  🔔' : ''}
            {task.linksOn && task.links?.length ? '  ·  🔗' : ''}
            {entry.note ? '  ·  📝' : ''}
            {status === 'undone' || (status === 'done' && !review) ? <span className={'pill ' + status}>{LABEL[status]}</span> : null}
          </div>
          {status !== 'cheat' && <Bar v={p} red={red} />}
          {reached && <div className="sm ok">🎯 Goal reached — tap ○ to mark it done</div>}
          {isMeasured(task) && done && p < 50 && <div className="sm bad">Marked done at {Math.round(p)}% progress</div>}
        </div>
      </div>
    );
  };

  const existing = new Set(items.map((i) => i.task.id));

  return (
    <Sheet
      title={prettyDate(date)}
      onClose={onClose}
      footer={<button className="btn" onClick={() => setAdding(true)}>+ Add a task to this day</button>}
    >
      <p className="muted" style={{ margin: '0 0 6px' }}>
        {items.length
          ? `${doneN} of ${active.length} done${cheats.length ? ` · ${cheats.length} excused` : ''}`
          : 'Nothing planned for this day yet.'}
      </p>
      {active.length > 0 && <Bar v={(doneN / active.length) * 100} />}

      {items.length > 0 && (
        <div className="chips" style={{ margin: '10px 0' }}>
          <button className="chip act" disabled={!notDone.length} onClick={() => markAllDone(notDone, 'all')}>✔ Mark all done</button>
          <button className={'chip act' + (cheatDay ? ' on cheatc' : '')} onClick={cheatToggle}>
            🍰 {cheatDay ? 'Cheat day ON — undo' : 'Cheat day'}
          </button>
        </div>
      )}

      {cheatDay && (
        <div className="cheatbox">
          🍰 <b>Cheat day.</b> Tasks not marked done are excused — not counted as missed, streaks are safe, no alarms.
        </div>
      )}

      {unmarked.length > 0 && (
        <div className="warnbox">
          <div className="whead">⚠ Unmarked · {unmarked.length}</div>
          <div className="sm" style={{ marginBottom: 8 }}>
            This day is over. Tasks you don't mark count as <b>NOT done</b>. Tell the app what really happened:
            <b> ✓</b> done, <b>✕</b> not done, <b>🍰</b> excused.
          </div>
          <div className="row" style={{ marginBottom: 4 }}>
            <button className="btn sm2" onClick={() => markAllDone(unmarked, 'these')}>✓ All done</button>
            <button className="btn sm2 ghost-b" onClick={() => setStatusMany(date, unmarked.map((i) => i.task.id), 'undone')}>✕ All not done</button>
          </div>
          {unmarked.map((it) => (
            <Row key={it.task.id} it={it} review />
          ))}
        </div>
      )}

      {blocks.map((b, i) =>
        b.type === 'single' ? (
          <Row key={i} it={b.item} />
        ) : (
          <div className="group" key={i}>
            <div className="ghead">⚠ Time clash · {b.label}</div>
            <div className="muted sm" style={{ marginBottom: 6 }}>These tasks overlap. Open one and move its time to fix the clash.</div>
            {b.items.map((it) => (
              <Row key={it.task.id} it={it} red />
            ))}
          </div>
        )
      )}

      {free.length > 0 && (
        <>
          <h4>Not scheduled yet</h4>
          {free.map((it) => (
            <Row key={it.task.id} it={it} />
          ))}
        </>
      )}

      {cheats.length > 0 && (
        <>
          <h4>🍰 Excused (cheat)</h4>
          {cheats.map((it) => (
            <Row key={it.task.id} it={it} />
          ))}
        </>
      )}

      {removed.length > 0 && (
        <details className="removed">
          <summary>Removed from this day ({removed.length})</summary>
          {removed.map((t) => (
            <div className="row between" key={t.id} style={{ padding: '6px 0' }}>
              <span>{t.title}</span>
              <button className="btn sm2 soft" onClick={() => restoreToDay(date, t.id)}>Restore</button>
            </div>
          ))}
        </details>
      )}

      {open && <TaskDetail date={date} taskId={open} onClose={() => setOpen(null)} />}
      {adding && (
        <Picker
          title="Add tasks"
          tasks={state.tasks.filter((t) => !existing.has(t.id))}
          onClose={() => setAdding(false)}
          onDone={(ids) => {
            ids.forEach((id) => addToDay(date, id));
            setAdding(false);
          }}
        />
      )}
    </Sheet>
  );
}
