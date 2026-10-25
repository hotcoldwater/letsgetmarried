'use client';
import { createContext, useContext, useId, useLayoutEffect, useRef, useState } from 'react';
import { fieldKey, fieldValue } from '../lib/inline-planner.mjs';
import { formatMoneyInput } from '../lib/money-input.mjs';
import MoneyInput from './money-input';

export const InlineContext = createContext(null);
export const useInline = () => useContext(InlineContext);

export function EditableField({ kind, record, ownerId, field, label, options, multiline = false, optional = false, disabled = false, className = '', ...props }) {
  const { state, saves } = useInline();
  const config = { kind, id: record?.id || '', ownerId, field, label, type: props.type, optional, required: props.required, maxLength: props.maxLength };
  const key = fieldKey(config), draft = saves.drafts[key], id = useId(), input = useRef(null), composing = useRef(false);
  const current = fieldValue(state, config), value = draft && draft.status !== 'saved' ? draft.value : current;
  useLayoutEffect(() => {
    if (multiline && input.current) {
      input.current.style.height = 'auto';
      input.current.style.height = input.current.scrollHeight + 'px';
    }
  }, [value, multiline]);
  const changeValue = next => {
    const updatedKey = saves.edit(config, next);
    if (options || props.type === 'checkbox') saves.save(updatedKey);
  };
  const common = {
    ...props, ref: input, id, disabled, value: props.type === 'checkbox' ? undefined : value,
    checked: props.type === 'checkbox' ? !!value : undefined,
    onChange: event => changeValue(props.type === 'checkbox' ? event.target.checked : event.target.value),
    onBlur: () => { if (!composing.current && draft?.status !== 'error') saves.save(key); },
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: () => { composing.current = false; },
    onKeyDown: event => {
      if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing && !composing.current) { event.preventDefault(); event.currentTarget.blur(); }
    },
    'aria-invalid': draft?.status === 'error' || undefined,
    'aria-describedby': draft?.status === 'error' ? `${id}-error` : undefined,
  };
  const control = options ? <select {...common}>{options.map(([v, text]) => <option value={v} key={v}>{text}</option>)}</select>
    : multiline ? <textarea {...common} rows={1} />
      : props.type === 'number' ? <MoneyInput {...common} onValueChange={changeValue} />
      : <input {...common} />;
  return <div className={`inline-field ${className} ${props.type === 'checkbox' ? 'inline-check-field' : ''}`}>
    <label htmlFor={id}>{props.type === 'checkbox' && control}<span>{label}</span></label>
    {props.type !== 'checkbox' && control}
    {draft?.status && <span className={`inline-field-status ${draft.status}`} role="status">{draft.status === 'saving' ? '저장 중…' : draft.status === 'editing' ? '입력 중' : draft.status === 'saved' ? '저장 완료' : '저장하지 못했어요'}</span>}
    {draft?.status === 'error' && <div className="inline-field-error" id={`${id}-error`} role="alert">
      <p>{draft.error}</p>
      {draft.conflict && <p>최신 내용: {draft.currentValue == null || draft.currentValue === '' ? '(비어 있음)' : props.type === 'number' ? `${formatMoneyInput(draft.currentValue)}원` : String(draft.currentValue)}</p>}
      <div><button type="button" onClick={() => saves.retry(key)}>{draft.conflict ? '내 내용 저장' : '다시 저장'}</button><button type="button" onClick={() => saves.discard(key)}>최신 내용 사용</button></div>
    </div>}
  </div>;
}

export function OptionalField(props) {
  const { state, saves } = useInline();
  const config = { kind: props.kind, id: props.record?.id || '', ownerId: props.ownerId, field: props.field };
  const draft = saves.drafts[fieldKey(config)];
  const [expanded, expand] = useState(false);
  if (expanded || fieldValue(state, config) !== '' || draft && draft.status !== 'saved') return <EditableField {...props} autoFocus={expanded} />;
  return <button type="button" className="inline-add-field" disabled={props.disabled} onClick={() => expand(true)}>+ {props.label}</button>;
}

export function QuickAdd({ label, placeholder, create, compact = false, disabled = false, maxLength = 200 }) {
  const [value, setValue] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState('');
  const id = useId();
  return <form className={`inline-quick ${compact ? 'compact' : ''}`} onSubmit={async event => {
    event.preventDefault();
    if (!value.trim() || pending) return;
    setPending(true); setError('');
    try { await create(value.trim()); setValue(''); }
    catch (e) { setError(e.message || '추가하지 못했어요. 다시 시도해 주세요.'); }
    finally { setPending(false); }
  }}>
    <label className="sr-only" htmlFor={id}>{label}</label><input id={id} value={value} onChange={e => setValue(e.target.value)} disabled={disabled} readOnly={pending} required maxLength={maxLength} placeholder={placeholder || label} />
    <button type="submit" disabled={disabled || pending || !value.trim()}>{pending ? '저장 중…' : '+ 추가'}</button>
    {error && <p className="inline-field-error" role="alert">{error}</p>}
  </form>;
}
