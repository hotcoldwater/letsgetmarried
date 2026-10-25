export const MAX_MONEY = 10000000000;

// Keep invalid input intact so a minus sign, decimal, or exponent can never
// silently turn into a different amount. Only thousands separators are removed.
export function moneyDigits(value) {
  return String(value ?? '').trim().replaceAll(',', '');
}

export function formatMoneyInput(value) {
  const raw = moneyDigits(value);
  if (!/^\d*$/.test(raw)) return String(value ?? '');
  return raw.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseMoneyInput(value, { optional = false } = {}) {
  const raw = moneyDigits(value);
  if (raw === '') {
    if (optional) return null;
    throw new Error('금액을 입력해 주세요. 0원도 입력할 수 있어요.');
  }
  const number = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number > MAX_MONEY) {
    throw new Error('0원 이상, 100억 원 이하 정수로 입력해 주세요.');
  }
  return number;
}

// Anchor the selection to digits instead of character offsets, since inserting
// a digit can also insert or move a comma to the left of the cursor.
export function formatMoneyEdit(value, start = value.length, end = start) {
  const formatted = formatMoneyInput(value);
  if (!/^[\d,\s]*$/.test(value)) return { value, start, end };
  const raw = moneyDigits(value), trimmedZeros = raw.length - raw.replace(/^0+(?=\d)/, '').length;
  const position = offset => {
    const digits = Math.max(0, (value.slice(0, offset).match(/\d/g) || []).length - trimmedZeros);
    if (!digits) return 0;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) if (/\d/.test(formatted[i]) && ++seen === digits) return i + 1;
    return formatted.length;
  };
  return { value: formatted, start: position(start), end: position(end) };
}
