'use client';
import { forwardRef, useImperativeHandle, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { formatMoneyEdit, formatMoneyInput, moneyDigits, parseMoneyInput } from '../lib/money-input.mjs';

const MoneyInput = forwardRef(function MoneyInput({ value, defaultValue = '', onValueChange, onKeyDown, onCompositionStart, onCompositionEnd, type, min, max, step, className = '', ...props }, ref) {
  const input = useRef(null), selection = useRef(null), composing = useRef(false);
  const [localValue, setLocalValue] = useState(defaultValue), [composition, setComposition] = useState(null);
  const [, render] = useReducer(n => n + 1, 0);
  const display = composition ?? formatMoneyInput(value === undefined ? localValue : value);
  useImperativeHandle(ref, () => input.current);
  useLayoutEffect(() => {
    const element = input.current;
    try { parseMoneyInput(display, { optional: !props.required }); element.setCustomValidity(''); }
    catch (error) { element.setCustomValidity(error.message); }
    if (selection.current && document.activeElement === element && !composing.current) {
      element.setSelectionRange(selection.current.start, selection.current.end);
    }
    selection.current = null;
  });
  const change = event => {
    const element = event.currentTarget;
    if (composing.current) { setComposition(element.value); return; }
    const edit = formatMoneyEdit(element.value, element.selectionStart, element.selectionEnd);
    // On mobile keyboards that omit keydown, deleting a separator must still
    // let the cursor move past it instead of getting stuck on the same comma.
    if (event.nativeEvent.inputType === 'deleteContentForward' && edit.start === edit.end && edit.value[edit.start] === ',') edit.start = ++edit.end;
    selection.current = edit;
    const raw = moneyDigits(edit.value);
    setLocalValue(raw);
    onValueChange?.(raw);
    render();
  };
  return <input {...props} ref={input} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} className={`money-input ${className}`} value={display}
    onChange={change}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.nativeEvent.isComposing || composing.current || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const element = event.currentTarget, cursor = element.selectionStart;
      if (cursor !== element.selectionEnd) return;
      if (event.key === 'Backspace' && element.value[cursor - 1] === ',') element.setSelectionRange(cursor - 1, cursor - 1);
      if (event.key === 'Delete' && element.value[cursor] === ',') element.setSelectionRange(cursor + 1, cursor + 1);
    }}
    onCompositionStart={event => { composing.current = true; setComposition(event.currentTarget.value); onCompositionStart?.(event); }}
    onCompositionEnd={event => { composing.current = false; setComposition(null); change(event); onCompositionEnd?.(event); }}
  />;
});
export default MoneyInput;
