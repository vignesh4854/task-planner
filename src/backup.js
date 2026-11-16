import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getState, saveSettings, replaceAll } from './store';
import { today } from './logic';

const MARK = 'task-planner-backup';

export function backupJson() {
  const s = getState();
  return JSON.stringify(
    {
      app: MARK,
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { tasks: s.tasks, entries: s.entries, cheatDays: s.cheatDays || {}, settings: s.settings || {} },
    },
    null,
    1
  );
}

// Native: write a file and open the Android share sheet (save to Drive / Files / WhatsApp…)
// Web preview: normal download
export async function exportBackup() {
  const json = backupJson();
  const name = `taskplanner-backup-${today()}.json`;
  if (Capacitor.isNativePlatform()) {
    const r = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Task Planner backup', files: [r.uri], dialogTitle: 'Save your backup' });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name;
    a.click();
  }
  saveSettings({ lastBackup: new Date().toISOString() });
}

export async function copyBackup() {
  await navigator.clipboard.writeText(backupJson());
  saveSettings({ lastBackup: new Date().toISOString() });
}

// Reads + validates a backup. Returns { tasks, entries, cheatDays, settings, counts } or throws a friendly Error.
export function parseBackup(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid backup file (cannot read it).');
  }
  // accept our wrapper, or the raw stored state (e.g. copied from the old app)
  const d = j && j.app === MARK ? j.data : j;
  if (!d || !Array.isArray(d.tasks) || typeof d.entries !== 'object' || d.entries === null) {
    throw new Error('This file does not look like a Task Planner backup.');
  }
  if (d.tasks.some((t) => !t || typeof t.id !== 'string' || typeof t.title !== 'string')) {
    throw new Error('The backup contains damaged tasks, so it was not imported.');
  }
  // sound files live inside the old app and are not part of a backup
  let soundsReset = 0;
  const tasks = d.tasks.map((t) => {
    if (t.sound?.enabled || t.sound?.path) soundsReset++;
    return { ...t, sound: { enabled: false, name: '', path: '' } };
  });
  const settings = { ...(d.settings || {}), universal: null };
  if (d.settings?.universal?.path) soundsReset++;
  return {
    tasks,
    entries: d.entries,
    cheatDays: d.cheatDays || {},
    settings,
    counts: { tasks: tasks.length, days: Object.keys(d.entries).length, soundsReset },
  };
}

export const applyBackup = (parsed) => replaceAll(parsed);
