const expressionEl = document.getElementById('expression');
const resultEl = document.getElementById('result');
const historyListEl = document.getElementById('historyList');
const copyBtn = document.getElementById('copyResult');

let expr = '';
let memory = 0;
const history = [];

const OPERATORS = {
  '+': { precedence: 2, assoc: 'L', args: 2 },
  '-': { precedence: 2, assoc: 'L', args: 2 },
  '*': { precedence: 3, assoc: 'L', args: 2 },
  '/': { precedence: 3, assoc: 'L', args: 2 },
  '%': { precedence: 3, assoc: 'L', args: 2 },
  '^': { precedence: 4, assoc: 'R', args: 2 },
  'u-': { precedence: 5, assoc: 'R', args: 1 }
};
const FUNCTIONS = new Set(['sqrt', 'sin', 'cos', 'tan', 'log', 'ln']);

function updateDisplay(value = null) {
  expressionEl.textContent = expr || '0';
  if (value !== null) resultEl.textContent = value;
}

function isDigit(ch) { return /[0-9]/.test(ch); }

function appendValue(v) { expr += v; updateDisplay(); }
function appendFunction(fn) { expr += `${fn}(`; updateDisplay(); }
function clearAll() { expr = ''; updateDisplay('0'); }
function backspace() { expr = expr.slice(0, -1); updateDisplay(); }

function tokenize(input) {
  const tokens = [];
  for (let i = 0; i < input.length;) {
    const ch = input[i];
    if (ch === ' ') { i++; continue; }
    if (isDigit(ch) || ch === '.') {
      let num = ch; i++;
      while (i < input.length && (isDigit(input[i]) || input[i] === '.')) num += input[i++];
      if ((num.match(/\./g) || []).length > 1) throw new Error('Invalid decimal');
      tokens.push({ type: 'number', value: num });
      continue;
    }
    if (/[a-z]/i.test(ch)) {
      let name = ch; i++;
      while (i < input.length && /[a-z]/i.test(input[i])) name += input[i++];
      if (!FUNCTIONS.has(name)) throw new Error(`Unknown function: ${name}`);
      tokens.push({ type: 'fn', value: name });
      continue;
    }
    if ('+-*/%^()'.includes(ch)) {
      tokens.push({ type: ch === '(' || ch === ')' ? 'paren' : 'op', value: ch }); i++; continue;
    }
    throw new Error(`Unexpected token: ${ch}`);
  }
  return tokens;
}

function toRpn(tokens) {
  const out = [], stack = [];
  let prev = null;
  for (const t of tokens) {
    if (t.type === 'number') out.push(t);
    else if (t.type === 'fn') stack.push(t);
    else if (t.type === 'op') {
      let op = t.value;
      if (op === '-' && (!prev || (prev.type === 'op') || (prev.type === 'paren' && prev.value === '(') || prev.type === 'fn')) op = 'u-';
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === 'op' && (
          (OPERATORS[op].assoc === 'L' && OPERATORS[op].precedence <= OPERATORS[top.value].precedence) ||
          (OPERATORS[op].assoc === 'R' && OPERATORS[op].precedence < OPERATORS[top.value].precedence)
        )) out.push(stack.pop());
        else break;
      }
      stack.push({ type: 'op', value: op });
    } else if (t.type === 'paren' && t.value === '(') stack.push(t);
    else if (t.type === 'paren' && t.value === ')') {
      while (stack.length && stack[stack.length - 1].value !== '(') out.push(stack.pop());
      if (!stack.length) throw new Error('Mismatched parentheses');
      stack.pop();
      if (stack.length && stack[stack.length - 1].type === 'fn') out.push(stack.pop());
    }
    prev = t;
  }
  while (stack.length) {
    const s = stack.pop();
    if (s.type === 'paren') throw new Error('Mismatched parentheses');
    out.push(s);
  }
  return out;
}

function decimalPlaces(n) {
  const s = n.toString();
  if (s.includes('e-')) return parseInt(s.split('e-')[1], 10);
  return (s.split('.')[1] || '').length;
}
function preciseBinary(a, b, op) {
  if (op === '+' || op === '-') {
    const scale = 10 ** Math.max(decimalPlaces(a), decimalPlaces(b));
    return op === '+' ? (Math.round(a * scale) + Math.round(b * scale)) / scale : (Math.round(a * scale) - Math.round(b * scale)) / scale;
  }
  if (op === '*') {
    const da = decimalPlaces(a), db = decimalPlaces(b);
    const ia = Number(a.toString().replace('.', ''));
    const ib = Number(b.toString().replace('.', ''));
    return (ia * ib) / 10 ** (da + db);
  }
  if (op === '/') { if (b === 0) throw new Error('Division by zero'); return a / b; }
  if (op === '%') { if (b === 0) throw new Error('Division by zero'); return a % b; }
  if (op === '^') return a ** b;
  throw new Error('Bad operator');
}

function evalRpn(rpn) {
  const st = [];
  for (const t of rpn) {
    if (t.type === 'number') st.push(Number(t.value));
    else if (t.type === 'op') {
      if (t.value === 'u-') { if (!st.length) throw new Error('Invalid expression'); st.push(-st.pop()); continue; }
      const b = st.pop(), a = st.pop();
      if (a === undefined || b === undefined) throw new Error('Invalid expression');
      st.push(preciseBinary(a, b, t.value));
    } else if (t.type === 'fn') {
      const x = st.pop();
      if (x === undefined) throw new Error('Invalid function usage');
      let v;
      if (t.value === 'sqrt') { if (x < 0) throw new Error('Invalid sqrt domain'); v = Math.sqrt(x); }
      if (t.value === 'sin') v = Math.sin(x);
      if (t.value === 'cos') v = Math.cos(x);
      if (t.value === 'tan') v = Math.tan(x);
      if (t.value === 'log') { if (x <= 0) throw new Error('Invalid log domain'); v = Math.log10(x); }
      if (t.value === 'ln') { if (x <= 0) throw new Error('Invalid ln domain'); v = Math.log(x); }
      st.push(v);
    }
  }
  if (st.length !== 1 || !Number.isFinite(st[0])) throw new Error('Invalid expression');
  return Number(st[0].toPrecision(15));
}

function calculate() {
  if (!expr.trim()) return;
  try {
    const result = evalRpn(toRpn(tokenize(expr)));
    updateDisplay(result.toString());
    history.unshift(`${expr} = ${result}`);
    if (history.length > 20) history.pop();
    renderHistory();
    expr = result.toString();
  } catch (err) {
    updateDisplay('Error');
  }
}

function renderHistory() {
  historyListEl.innerHTML = history.map(item => `<li>${item}</li>`).join('');
}

document.querySelector('.keypad').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.value) appendValue(btn.dataset.value);
  if (btn.dataset.fn) appendFunction(btn.dataset.fn);
  if (btn.dataset.action === 'clear') clearAll();
  if (btn.dataset.action === 'backspace') backspace();
  if (btn.dataset.action === 'equals') calculate();
  if (btn.dataset.action === 'memory-clear') memory = 0;
  if (btn.dataset.action === 'memory-recall') { expr += memory.toString(); updateDisplay(); }
  if (btn.dataset.action === 'memory-add') memory += Number(resultEl.textContent) || 0;
  if (btn.dataset.action === 'memory-subtract') memory -= Number(resultEl.textContent) || 0;
});

document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (/^[0-9]$/.test(k) || '+-*/%^().'.includes(k)) appendValue(k);
  if (k === 'Enter' || k === '=') { e.preventDefault(); calculate(); }
  if (k === 'Backspace') backspace();
  if (k === 'Escape') clearAll();
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultEl.textContent);
    copyBtn.textContent = '✓';
    setTimeout(() => (copyBtn.textContent = '⧉'), 800);
  } catch {
    copyBtn.textContent = '!';
    setTimeout(() => (copyBtn.textContent = '⧉'), 800);
  }
});

updateDisplay('0');
