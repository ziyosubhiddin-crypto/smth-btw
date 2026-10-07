/**
 * Salohiddin Calculator - Interactive Logic & Engine
 */

class SalohiddinCalculator {
  constructor() {
    this.currentValue = '0';
    this.previousValue = null;
    this.operator = null;
    this.waitingForOperand = false;
    this.formula = '';
    this.memory = 0;
    this.history = JSON.parse(localStorage.getItem('salohiddin_calc_history') || '[]');
    this.soundEnabled = localStorage.getItem('salohiddin_calc_sound') !== 'false';
    this.currentTheme = localStorage.getItem('salohiddin_calc_theme') || 'dark';

    this.audioCtx = null;

    this.initDOM();
    this.applyTheme(this.currentTheme);
    this.updateSoundIcon();
    this.renderHistory();
    this.bindEvents();
    this.updateDisplay();
  }

  initDOM() {
    this.displayValue = document.getElementById('displayValue');
    this.displayFormula = document.getElementById('displayFormula');
    this.clearBtn = document.getElementById('clearBtn');
    this.historyDrawer = document.getElementById('historyDrawer');
    this.historyList = document.getElementById('historyList');
    this.overlay = document.getElementById('overlay');
    this.toast = document.getElementById('toast');
    this.scientificPanel = document.getElementById('scientificPanel');
    this.modeTabs = document.querySelectorAll('.mode-tab');
    this.soundIcon = document.getElementById('soundIcon');
    this.themeIcon = document.getElementById('themeIcon');
  }

  // --- Sound Effects using Web Audio API ---
  playClickSound(freq = 600, duration = 0.04) {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.audioCtx.currentTime + duration);

      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio fallback silent
    }
  }

  // --- Number Input ---
  inputDigit(digit) {
    this.playClickSound(550, 0.03);
    if (this.waitingForOperand) {
      this.currentValue = String(digit);
      this.waitingForOperand = false;
    } else {
      if (this.currentValue === '0' && digit !== '.') {
        this.currentValue = String(digit);
      } else {
        if (this.currentValue.length < 16) {
          this.currentValue += String(digit);
        }
      }
    }
    this.updateDisplay();
  }

  inputDecimal() {
    this.playClickSound(600, 0.03);
    if (this.waitingForOperand) {
      this.currentValue = '0.';
      this.waitingForOperand = false;
    } else if (!this.currentValue.includes('.')) {
      this.currentValue += '.';
    }
    this.updateDisplay();
  }

  // --- Negate (±) ---
  toggleSign() {
    this.playClickSound(500, 0.04);
    if (this.currentValue !== '0') {
      this.currentValue = String(-parseFloat(this.currentValue));
      this.updateDisplay();
    }
  }

  // --- Operators (+, -, *, /, %, ^) ---
  handleOperator(nextOperator) {
    this.playClickSound(720, 0.04);
    const inputValue = parseFloat(this.currentValue);

    if (this.operator && this.waitingForOperand) {
      this.operator = nextOperator;
      this.formula = `${this.formatDisplayNumber(this.previousValue)} ${this.getOperatorSymbol(nextOperator)}`;
      this.updateDisplay();
      return;
    }

    if (this.previousValue === null && !isNaN(inputValue)) {
      this.previousValue = inputValue;
    } else if (this.operator) {
      const result = this.calculate(this.previousValue, inputValue, this.operator);
      if (result === 'Xatolik') {
        this.currentValue = 'Xatolik';
        this.resetState();
        this.updateDisplay();
        return;
      }
      this.currentValue = String(this.cleanNumber(result));
      this.previousValue = result;
    }

    this.waitingForOperand = true;
    this.operator = nextOperator;
    this.formula = `${this.formatDisplayNumber(this.previousValue)} ${this.getOperatorSymbol(nextOperator)}`;
    this.updateDisplay();
  }

  // --- Calculation Engine ---
  calculate(first, second, op) {
    switch (op) {
      case '+':
        return first + second;
      case '-':
        return first - second;
      case '*':
        return first * second;
      case '/':
        if (second === 0) return 'Xatolik';
        return first / second;
      case '%':
        return (first * second) / 100;
      case '^':
        return Math.pow(first, second);
      default:
        return second;
    }
  }

  // --- Equals (=) ---
  handleEquals() {
    this.playClickSound(880, 0.06);
    if (this.operator === null || this.previousValue === null) {
      return;
    }

    const inputValue = parseFloat(this.currentValue);
    const result = this.calculate(this.previousValue, inputValue, this.operator);

    if (result === 'Xatolik') {
      this.showToast("0 ga bo'lish mumkin emas!");
      this.currentValue = 'Xatolik';
      this.formula = '';
      this.resetState();
      this.updateDisplay();
      return;
    }

    const cleanRes = this.cleanNumber(result);
    const fullFormula = `${this.formatDisplayNumber(this.previousValue)} ${this.getOperatorSymbol(this.operator)} ${this.formatDisplayNumber(inputValue)} =`;

    this.saveToHistory(fullFormula, cleanRes);

    this.formula = fullFormula;
    this.currentValue = String(cleanRes);
    this.previousValue = null;
    this.operator = null;
    this.waitingForOperand = true;
    this.updateDisplay();
  }

  // --- Scientific Operations ---
  handleScientific(action) {
    this.playClickSound(650, 0.04);
    const val = parseFloat(this.currentValue);
    let result = 0;
    let label = '';

    switch (action) {
      case 'sin':
        // using degrees for intuitive consumer use
        const radSin = (val * Math.PI) / 180;
        result = Math.sin(radSin);
        label = `sin(${val}°)`;
        break;
      case 'cos':
        const radCos = (val * Math.PI) / 180;
        result = Math.cos(radCos);
        label = `cos(${val}°)`;
        break;
      case 'tan':
        if (val % 180 === 90) {
          this.showToast("Aniqlanmagan qiymat!");
          return;
        }
        const radTan = (val * Math.PI) / 180;
        result = Math.tan(radTan);
        label = `tan(${val}°)`;
        break;
      case 'sqrt':
        if (val < 0) {
          this.showToast("Manfiy sondan ildiz olinmaydi!");
          return;
        }
        result = Math.sqrt(val);
        label = `√(${val})`;
        break;
      case 'log':
        if (val <= 0) {
          this.showToast("Faqat musbat sonlar uchun!");
          return;
        }
        result = Math.log10(val);
        label = `log(${val})`;
        break;
      case 'ln':
        if (val <= 0) {
          this.showToast("Faqat musbat sonlar uchun!");
          return;
        }
        result = Math.log(val);
        label = `ln(${val})`;
        break;
      case 'square':
        result = Math.pow(val, 2);
        label = `sqr(${val})`;
        break;
      case 'fact':
        if (val < 0 || !Number.isInteger(val) || val > 170) {
          this.showToast("0 dan 170 gacha butun son kiriting");
          return;
        }
        result = this.factorial(val);
        label = `fact(${val})`;
        break;
      case 'pi':
        result = Math.PI;
        label = 'π';
        break;
      case 'e':
        result = Math.E;
        label = 'e';
        break;
      case 'abs':
        result = Math.abs(val);
        label = `|${val}|`;
        break;
      default:
        return;
    }

    const cleanRes = this.cleanNumber(result);
    this.formula = `${label} =`;
    this.currentValue = String(cleanRes);
    this.waitingForOperand = true;
    this.saveToHistory(this.formula, cleanRes);
    this.updateDisplay();
  }

  factorial(n) {
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  // --- Clear / Backspace ---
  clearAll() {
    this.playClickSound(400, 0.04);
    this.currentValue = '0';
    this.resetState();
    this.formula = '';
    this.updateDisplay();
  }

  deleteDigit() {
    this.playClickSound(480, 0.03);
    if (this.waitingForOperand) return;
    if (this.currentValue.length > 1 && this.currentValue !== 'Xatolik') {
      this.currentValue = this.currentValue.slice(0, -1);
    } else {
      this.currentValue = '0';
    }
    this.updateDisplay();
  }

  resetState() {
    this.previousValue = null;
    this.operator = null;
    this.waitingForOperand = false;
  }

  // --- Memory Operations ---
  handleMemory(action) {
    this.playClickSound(580, 0.03);
    const val = parseFloat(this.currentValue) || 0;
    switch (action) {
      case 'MC':
        this.memory = 0;
        this.showToast("Xotira tozalandi (0)");
        break;
      case 'MR':
        this.currentValue = String(this.cleanNumber(this.memory));
        this.waitingForOperand = true;
        this.showToast(`Xotiradan: ${this.memory}`);
        break;
      case 'M+':
        this.memory += val;
        this.showToast(`Xotiraga qo'shildi (+${val})`);
        break;
      case 'M-':
        this.memory -= val;
        this.showToast(`Xotiradan ayirildi (-${val})`);
        break;
      case 'MS':
        this.memory = val;
        this.showToast(`Xotiraga saqlandi: ${val}`);
        break;
    }
    this.updateMemoryIndicators();
    this.updateDisplay();
  }

  updateMemoryIndicators() {
    const memBtns = document.querySelectorAll('.mem-btn');
    memBtns.forEach(btn => {
      if (this.memory !== 0) {
        btn.classList.add('has-memory');
      } else {
        btn.classList.remove('has-memory');
      }
    });
  }

  // --- Helper Methods ---
  cleanNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return num;
    const precision = 12;
    return parseFloat(num.toPrecision(precision)) / 1;
  }

  getOperatorSymbol(op) {
    switch (op) {
      case '+': return '+';
      case '-': return '−';
      case '*': return '×';
      case '/': return '÷';
      case '%': return '%';
      case '^': return '^';
      default: return op;
    }
  }

  formatDisplayNumber(num) {
    if (num === null || num === undefined) return '';
    if (typeof num === 'string' && isNaN(Number(num))) return num;
    const parts = String(num).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
  }

  updateDisplay() {
    if (this.currentValue === 'Xatolik') {
      this.displayValue.textContent = 'Xatolik';
    } else {
      this.displayValue.textContent = this.formatDisplayNumber(this.currentValue);
    }
    this.displayFormula.textContent = this.formula;

    // Adjust font size dynamically if number is long
    const len = this.displayValue.textContent.length;
    if (len > 12) {
      this.displayValue.style.fontSize = '1.7rem';
    } else if (len > 9) {
      this.displayValue.style.fontSize = '2.1rem';
    } else {
      this.displayValue.style.fontSize = '2.5rem';
    }
  }

  // --- History Management ---
  saveToHistory(expression, result) {
    const item = {
      id: Date.now(),
      expr: expression,
      res: result,
      time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
    };
    this.history.unshift(item);
    if (this.history.length > 30) this.history.pop();
    localStorage.setItem('salohiddin_calc_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  renderHistory() {
    if (!this.historyList) return;
    if (this.history.length === 0) {
      this.historyList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p>Hozircha tarix mavjud emas</p>
        </div>
      `;
      return;
    }

    this.historyList.innerHTML = this.history.map(item => `
      <div class="history-item" data-res="${item.res}">
        <div class="history-expr">${item.expr}</div>
        <div class="history-res">${this.formatDisplayNumber(item.res)}</div>
      </div>
    `).join('');

    // Click item to paste back to calculator
    this.historyList.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.getAttribute('data-res');
        this.currentValue = val;
        this.waitingForOperand = true;
        this.updateDisplay();
        this.toggleHistoryDrawer(false);
        this.showToast(`Natija olindi: ${val}`);
      });
    });
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem('salohiddin_calc_history');
    this.renderHistory();
    this.showToast("Tarix tozalandi");
  }

  toggleHistoryDrawer(open) {
    if (open) {
      this.historyDrawer.classList.add('open');
      this.overlay.classList.add('active');
    } else {
      this.historyDrawer.classList.remove('open');
      this.overlay.classList.remove('active');
    }
  }

  // --- Themes ---
  toggleTheme() {
    const themes = ['dark', 'light', 'cyberpunk'];
    const nextIndex = (themes.indexOf(this.currentTheme) + 1) % themes.length;
    this.currentTheme = themes[nextIndex];
    this.applyTheme(this.currentTheme);
    localStorage.setItem('salohiddin_calc_theme', this.currentTheme);
    this.showToast(`Mavzu: ${this.currentTheme.toUpperCase()}`);
  }

  applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    if (this.themeIcon) {
      if (theme === 'light') {
        this.themeIcon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
      } else if (theme === 'cyberpunk') {
        this.themeIcon.innerHTML = `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>`;
      } else {
        this.themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
      }
    }
  }

  // --- Sound Toggle ---
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('salohiddin_calc_sound', this.soundEnabled);
    this.updateSoundIcon();
    this.showToast(this.soundEnabled ? "Ovoz yoqildi 🔔" : "Ovoz o'chirildi 🔕");
    if (this.soundEnabled) this.playClickSound(800, 0.05);
  }

  updateSoundIcon() {
    if (!this.soundIcon) return;
    if (this.soundEnabled) {
      this.soundIcon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      `;
    } else {
      this.soundIcon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      `;
    }
  }

  // --- Toast ---
  showToast(message) {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2200);
  }

  // --- Clipboard Copy ---
  copyResult() {
    const textToCopy = this.currentValue;
    navigator.clipboard.writeText(textToCopy).then(() => {
      this.showToast(`Nusxalandi: ${textToCopy}`);
      const copyText = document.getElementById('copyText');
      if (copyText) {
        copyText.textContent = "Nusxalandi!";
        setTimeout(() => copyText.textContent = "Nusxa", 1500);
      }
    }).catch(() => {
      this.showToast("Nusxalashda xatolik");
    });
  }

  // --- Event Binding ---
  bindEvents() {
    // Mode Switcher
    this.modeTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.modeTabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mode = e.currentTarget.getAttribute('data-mode');
        if (mode === 'scientific') {
          this.scientificPanel.classList.remove('hidden');
        } else {
          this.scientificPanel.classList.add('hidden');
        }
      });
    });

    // Keypad Clicks
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.getAttribute('data-action');
        const val = btn.getAttribute('data-value');

        switch (action) {
          case 'num':
            if (val === '.') this.inputDecimal();
            else this.inputDigit(val);
            break;
          case 'operator':
            this.handleOperator(val);
            break;
          case 'calculate':
            this.handleEquals();
            break;
          case 'clear':
            this.clearAll();
            break;
          case 'delete':
            this.deleteDigit();
            break;
          case 'negate':
            this.toggleSign();
            break;
          case 'sci':
            this.handleScientific(val);
            break;
        }
      });
    });

    // Memory Bar
    document.querySelectorAll('.mem-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleMemory(btn.getAttribute('data-mem'));
      });
    });

    // Sound Toggle
    document.getElementById('soundToggle')?.addEventListener('click', () => this.toggleSound());

    // Theme Toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    // History Drawer
    document.getElementById('historyToggle')?.addEventListener('click', () => this.toggleHistoryDrawer(true));
    document.getElementById('closeHistoryBtn')?.addEventListener('click', () => this.toggleHistoryDrawer(false));
    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => this.clearHistory());
    this.overlay?.addEventListener('click', () => this.toggleHistoryDrawer(false));

    // Copy Button
    document.getElementById('copyBtn')?.addEventListener('click', () => this.copyResult());

    // Physical Keyboard Support
    window.addEventListener('keydown', (e) => {
      if (e.key >= '0' && e.key <= '9') {
        this.inputDigit(e.key);
      } else if (e.key === '.') {
        this.inputDecimal();
      } else if (e.key === '+' || e.key === '-') {
        this.handleOperator(e.key);
      } else if (e.key === '*') {
        this.handleOperator('*');
      } else if (e.key === '/') {
        e.preventDefault();
        this.handleOperator('/');
      } else if (e.key === '%') {
        this.handleOperator('%');
      } else if (e.key === '^') {
        this.handleOperator('^');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        this.handleEquals();
      } else if (e.key === 'Backspace') {
        this.deleteDigit();
      } else if (e.key === 'Escape') {
        this.clearAll();
      }
    });
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.salohiddinCalc = new SalohiddinCalculator();
});
