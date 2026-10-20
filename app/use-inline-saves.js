'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldCommand, fieldKey, fieldValue } from '../lib/inline-planner.mjs';

export default function useInlineSaves(queue, snapshotRef) {
  const [drafts, setDrafts] = useState({});
  const draftsRef = useRef({});
  const running = useRef(new Map());
  const publish = useCallback(next => { draftsRef.current = next; setDrafts(next); }, []);
  const edit = useCallback((config, value) => {
    const key = fieldKey(config), previous = draftsRef.current[key];
    publish({ ...draftsRef.current, [key]: {
      config, value, base: previous && previous.status !== 'saved' ? previous.base : fieldValue(snapshotRef.current.state, config),
      revision: (previous?.revision || 0) + 1, status: 'editing', error: '', conflict: false,
    } });
    return key;
  }, [publish, snapshotRef]);
  const save = useCallback(function saveDraft(key) {
    const entry = draftsRef.current[key];
    if (!entry || entry.status === 'saved') return Promise.resolve(true);
    if (running.current.has(key)) return running.current.get(key).then(ok => ok ? saveDraft(key) : false);
    const { config, value, base, revision } = entry;
    publish({ ...draftsRef.current, [key]: { ...entry, status: 'saving', error: '' } });
    const promise = queue.command(state => fieldCommand(state, config, value, base)).then(() => {
      const current = draftsRef.current[key], savedValue = fieldValue(snapshotRef.current.state, config);
      publish({ ...draftsRef.current, [key]: current.revision === revision
        ? { ...current, base: savedValue, status: 'saved', error: '', conflict: false }
        : { ...current, base: savedValue } });
      return true;
    }).catch(error => {
      const current = draftsRef.current[key];
      publish({ ...draftsRef.current, [key]: { ...current, status: 'error', error: error.message, conflict: !!error.conflict, currentValue: error.currentValue } });
      return false;
    }).finally(() => running.current.delete(key));
    running.current.set(key, promise);
    return promise;
  }, [publish, queue, snapshotRef]);
  const retry = useCallback(key => {
    const entry = draftsRef.current[key];
    if (!entry) return;
    try {
      publish({ ...draftsRef.current, [key]: { ...entry, base: fieldValue(snapshotRef.current.state, entry.config), status: 'editing' } });
      return save(key);
    } catch { return false; }
  }, [publish, save, snapshotRef]);
  const discard = useCallback(key => {
    const next = { ...draftsRef.current }; delete next[key]; publish(next);
  }, [publish]);
  const flush = useCallback(async () => {
    const results = await Promise.all(Object.keys(draftsRef.current).map(key => {
      if (draftsRef.current[key].status === 'error') return false;
      return save(key);
    }));
    await queue.idle();
    return results.every(Boolean);
  }, [save, queue]);
  useEffect(() => {
    const beforeUnload = event => {
      if (queue.pending || Object.values(draftsRef.current).some(d => d.status !== 'saved')) { event.preventDefault(); event.returnValue = ''; }
    };
    const hidden = () => { if (document.hidden) flush(); };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('visibilitychange', hidden); };
  }, [flush, queue]);
  return { drafts, edit, save, retry, discard, flush };
}
