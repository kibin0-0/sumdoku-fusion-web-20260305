const SIZE = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;
const DIGITS = [1, 2, 3, 4, 5, 6];
const DIGIT_SET = new Set(DIGITS);

const CAGES = [
  { name: "A", target: 3, cells: [[0, 0], [0, 1]] },
  { name: "B", target: 7, cells: [[0, 2], [0, 3]] },
  { name: "C", target: 11, cells: [[0, 4], [0, 5]] },
  { name: "D", target: 6, cells: [[1, 0], [2, 0]] },
  { name: "E", target: 11, cells: [[1, 1], [1, 2]] },
  { name: "F", target: 6, cells: [[1, 3], [1, 4], [1, 5]] },
  { name: "G", target: 9, cells: [[2, 1], [3, 1]] },
  { name: "H", target: 9, cells: [[2, 2], [2, 3]] },
  { name: "I", target: 7, cells: [[2, 4], [2, 5]] },
  { name: "J", target: 8, cells: [[3, 0], [4, 0]] },
  { name: "K", target: 3, cells: [[3, 2], [3, 3]] },
  { name: "L", target: 7, cells: [[3, 4], [3, 5]] },
  { name: "M", target: 9, cells: [[4, 1], [4, 2]] },
  { name: "N", target: 5, cells: [[4, 4], [5, 4]] },
  { name: "O", target: 7, cells: [[4, 5], [5, 5]] },
  { name: "P", target: 9, cells: [[5, 0], [5, 1], [5, 2]] },
  { name: "Q", target: 9, cells: [[4, 3], [5, 3]] },
];

const INITIAL_GIVENS = new Map([
  ["0,0", 1],
  ["0,3", 4],
  ["1,1", 5],
  ["1,5", 3],
  ["2,2", 4],
  ["3,4", 3],
  ["4,3", 6],
  ["5,5", 5],
]);

const CAGE_COLORS = [
  "#FDE68A",
  "#BFDBFE",
  "#C7F9CC",
  "#FBCFE8",
  "#DDD6FE",
  "#FED7AA",
  "#A7F3D0",
  "#E9D5FF",
  "#FECACA",
  "#99F6E4",
  "#FDE2E4",
  "#CFFAFE",
  "#E5E7EB",
  "#FEF3C7",
  "#D1FAE5",
  "#DBEAFE",
  "#F5D0FE",
];

const boardEl = document.getElementById("board");
const legendEl = document.getElementById("legend");
const selectionInfoEl = document.getElementById("selectionInfo");
const statusEl = document.getElementById("status");

const btnClear = document.getElementById("btnClear");
const btnCheck = document.getElementById("btnCheck");
const btnHint = document.getElementById("btnHint");
const btnReset = document.getElementById("btnReset");
const btnSolve = document.getElementById("btnSolve");

const cellToCage = new Map();
const cageCellSets = new Map();
const cageAnchors = new Map();
const cageColors = new Map();

let board = createEmptyBoard();
let fixedCells = new Set(INITIAL_GIVENS.keys());
let selected = null;
let solution = null;
let solutionCount = 0;

function cellKey(r, c) {
  return `${r},${c}`;
}

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneBoard(src) {
  return src.map((row) => [...row]);
}

function validateCageLayout() {
  const seen = new Set();
  for (const cage of CAGES) {
    for (const [r, c] of cage.cells) {
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
        throw new Error(`케이지 좌표 범위 오류: ${cage.name} -> (${r},${c})`);
      }
      const key = cellKey(r, c);
      if (seen.has(key)) {
        throw new Error(`중복 케이지 셀 오류: (${r},${c})`);
      }
      seen.add(key);
      cellToCage.set(key, cage);
    }
    const set = new Set(cage.cells.map(([r, c]) => cellKey(r, c)));
    cageCellSets.set(cage.name, set);
    const anchor = [...cage.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[0];
    cageAnchors.set(cage.name, anchor);
  }
  if (seen.size !== SIZE * SIZE) {
    throw new Error("케이지 배치가 전체 보드를 덮지 않습니다.");
  }
}

function setupCageColors() {
  CAGES.forEach((cage, index) => {
    cageColors.set(cage.name, CAGE_COLORS[index % CAGE_COLORS.length]);
  });
}

function resetBoard() {
  board = createEmptyBoard();
  for (const [key, value] of INITIAL_GIVENS.entries()) {
    const [r, c] = key.split(",").map(Number);
    board[r][c] = value;
  }
}

function rowValues(working, r) {
  const values = new Set();
  for (let c = 0; c < SIZE; c += 1) {
    if (working[r][c] !== 0) {
      values.add(working[r][c]);
    }
  }
  return values;
}

function colValues(working, c) {
  const values = new Set();
  for (let r = 0; r < SIZE; r += 1) {
    if (working[r][c] !== 0) {
      values.add(working[r][c]);
    }
  }
  return values;
}

function boxValues(working, r, c) {
  const values = new Set();
  const br = Math.floor(r / BOX_ROWS) * BOX_ROWS;
  const bc = Math.floor(c / BOX_COLS) * BOX_COLS;
  for (let rr = br; rr < br + BOX_ROWS; rr += 1) {
    for (let cc = bc; cc < bc + BOX_COLS; cc += 1) {
      if (working[rr][cc] !== 0) {
        values.add(working[rr][cc]);
      }
    }
  }
  return values;
}

function cageFeasibleWithValue(working, r, c, value) {
  const cage = cellToCage.get(cellKey(r, c));
  const usedValues = [];
  let emptySlots = 0;

  for (const [rr, cc] of cage.cells) {
    if (rr === r && cc === c) {
      continue;
    }
    const v = working[rr][cc];
    if (v === 0) {
      emptySlots += 1;
    } else {
      usedValues.push(v);
    }
  }

  if (usedValues.includes(value)) {
    return false;
  }

  const currentSum = usedValues.reduce((sum, v) => sum + v, 0) + value;
  if (currentSum > cage.target) {
    return false;
  }

  if (emptySlots === 0) {
    return currentSum === cage.target;
  }

  const usedSet = new Set(usedValues);
  usedSet.add(value);
  const available = DIGITS.filter((digit) => !usedSet.has(digit)).sort((a, b) => a - b);
  if (available.length < emptySlots) {
    return false;
  }

  const minRest = available.slice(0, emptySlots).reduce((sum, v) => sum + v, 0);
  const maxRest = available.slice(available.length - emptySlots).reduce((sum, v) => sum + v, 0);
  const restTarget = cage.target - currentSum;
  return minRest <= restTarget && restTarget <= maxRest;
}

function isValidMove(working, r, c, value) {
  if (!DIGIT_SET.has(value)) {
    return false;
  }

  for (let cc = 0; cc < SIZE; cc += 1) {
    if (cc !== c && working[r][cc] === value) {
      return false;
    }
  }

  for (let rr = 0; rr < SIZE; rr += 1) {
    if (rr !== r && working[rr][c] === value) {
      return false;
    }
  }

  const br = Math.floor(r / BOX_ROWS) * BOX_ROWS;
  const bc = Math.floor(c / BOX_COLS) * BOX_COLS;
  for (let rr = br; rr < br + BOX_ROWS; rr += 1) {
    for (let cc = bc; cc < bc + BOX_COLS; cc += 1) {
      if ((rr !== r || cc !== c) && working[rr][cc] === value) {
        return false;
      }
    }
  }

  return cageFeasibleWithValue(working, r, c, value);
}

function candidatesForCell(working, r, c) {
  if (working[r][c] !== 0) {
    return [];
  }
  const banned = new Set([...rowValues(working, r), ...colValues(working, c), ...boxValues(working, r, c)]);
  const out = [];
  for (const digit of DIGITS) {
    if (!banned.has(digit) && cageFeasibleWithValue(working, r, c, digit)) {
      out.push(digit);
    }
  }
  return out.sort((a, b) => a - b);
}

function isCompleteAndValid(working) {
  for (let r = 0; r < SIZE; r += 1) {
    const rowSet = new Set(working[r]);
    if (rowSet.size !== SIZE || [...rowSet].some((v) => !DIGIT_SET.has(v))) {
      return false;
    }
  }

  for (let c = 0; c < SIZE; c += 1) {
    const colSet = new Set();
    for (let r = 0; r < SIZE; r += 1) {
      colSet.add(working[r][c]);
    }
    if (colSet.size !== SIZE || [...colSet].some((v) => !DIGIT_SET.has(v))) {
      return false;
    }
  }

  for (let br = 0; br < SIZE; br += BOX_ROWS) {
    for (let bc = 0; bc < SIZE; bc += BOX_COLS) {
      const boxSet = new Set();
      for (let r = br; r < br + BOX_ROWS; r += 1) {
        for (let c = bc; c < bc + BOX_COLS; c += 1) {
          boxSet.add(working[r][c]);
        }
      }
      if (boxSet.size !== SIZE || [...boxSet].some((v) => !DIGIT_SET.has(v))) {
        return false;
      }
    }
  }

  for (const cage of CAGES) {
    const values = cage.cells.map(([r, c]) => working[r][c]);
    if (values.some((v) => v === 0)) {
      return false;
    }
    if (new Set(values).size !== values.length) {
      return false;
    }
    const sum = values.reduce((acc, v) => acc + v, 0);
    if (sum !== cage.target) {
      return false;
    }
  }

  return true;
}

function findSolution(limit = 2, startBoard = board) {
  const working = cloneBoard(startBoard);
  let bestSolution = null;
  let found = 0;

  function backtrack() {
    if (found >= limit) {
      return;
    }

    const emptyCells = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (working[r][c] === 0) {
          emptyCells.push([r, c]);
        }
      }
    }

    if (emptyCells.length === 0) {
      if (isCompleteAndValid(working)) {
        found += 1;
        if (bestSolution === null) {
          bestSolution = cloneBoard(working);
        }
      }
      return;
    }

    let selectedCell = null;
    let selectedCandidates = null;
    for (const [r, c] of emptyCells) {
      const candidates = candidatesForCell(working, r, c);
      if (selectedCandidates === null || candidates.length < selectedCandidates.length) {
        selectedCell = [r, c];
        selectedCandidates = candidates;
      }
      if (selectedCandidates.length === 0) {
        return;
      }
    }

    const [r, c] = selectedCell;
    for (const value of selectedCandidates) {
      working[r][c] = value;
      backtrack();
      working[r][c] = 0;
      if (found >= limit) {
        return;
      }
    }
  }

  backtrack();
  return { bestSolution, found };
}

function findSingleHint() {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[r][c] === 0) {
        return [r, c, solution[r][c]];
      }
    }
  }
  return null;
}

function setValue(r1, c1, value) {
  const r = r1 - 1;
  const c = c1 - 1;
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
    return "좌표 범위는 1~6입니다.";
  }
  if (!DIGIT_SET.has(value)) {
    return "값 범위는 1~6입니다.";
  }
  if (fixedCells.has(cellKey(r, c))) {
    return "초기 고정 숫자는 변경할 수 없습니다.";
  }

  const old = board[r][c];
  board[r][c] = 0;
  const valid = isValidMove(board, r, c, value);
  if (!valid) {
    board[r][c] = old;
    return "해당 위치에 그 숫자를 넣으면 스도쿠/케이지 규칙을 위반합니다.";
  }
  board[r][c] = value;
  return `(${r1},${c1}) <- ${value} 입력 완료`;
}

function clearValue(r1, c1) {
  const r = r1 - 1;
  const c = c1 - 1;
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
    return "좌표 범위는 1~6입니다.";
  }
  if (fixedCells.has(cellKey(r, c))) {
    return "초기 고정 숫자는 지울 수 없습니다.";
  }
  board[r][c] = 0;
  return `(${r1},${c1}) 값을 비웠습니다.`;
}

function checkBoard() {
  for (let r = 0; r < SIZE; r += 1) {
    const seen = new Set();
    for (let c = 0; c < SIZE; c += 1) {
      const v = board[r][c];
      if (v === 0) {
        continue;
      }
      if (seen.has(v)) {
        return `행 ${r + 1}에 중복 숫자가 있습니다.`;
      }
      seen.add(v);
    }
  }

  for (let c = 0; c < SIZE; c += 1) {
    const seen = new Set();
    for (let r = 0; r < SIZE; r += 1) {
      const v = board[r][c];
      if (v === 0) {
        continue;
      }
      if (seen.has(v)) {
        return `열 ${c + 1}에 중복 숫자가 있습니다.`;
      }
      seen.add(v);
    }
  }

  for (let br = 0; br < SIZE; br += BOX_ROWS) {
    for (let bc = 0; bc < SIZE; bc += BOX_COLS) {
      const seen = new Set();
      for (let r = br; r < br + BOX_ROWS; r += 1) {
        for (let c = bc; c < bc + BOX_COLS; c += 1) {
          const v = board[r][c];
          if (v === 0) {
            continue;
          }
          if (seen.has(v)) {
            return `박스 (${br + 1}~${br + BOX_ROWS}, ${bc + 1}~${bc + BOX_COLS})에 중복 숫자가 있습니다.`;
          }
          seen.add(v);
        }
      }
    }
  }

  for (const cage of CAGES) {
    const values = cage.cells
      .map(([r, c]) => board[r][c])
      .filter((v) => v !== 0);
    if (new Set(values).size !== values.length) {
      return `케이지 ${cage.name}에 중복 숫자가 있습니다.`;
    }
    const currentSum = values.reduce((acc, v) => acc + v, 0);
    if (currentSum > cage.target) {
      return `케이지 ${cage.name}의 현재 합이 목표 합(${cage.target})을 초과했습니다.`;
    }
    if (values.length === cage.cells.length && currentSum !== cage.target) {
      return `케이지 ${cage.name}의 합이 목표 합(${cage.target})과 다릅니다.`;
    }
  }

  const allFilled = board.every((row) => row.every((v) => v !== 0));
  if (allFilled) {
    if (isCompleteAndValid(board)) {
      return "정답입니다! 모든 규칙을 만족했습니다.";
    }
    return "모든 칸을 채웠지만 규칙 위반이 있습니다.";
  }
  return "현재까지는 규칙 위반이 없습니다.";
}

function applyHint() {
  const hint = findSingleHint();
  if (hint === null) {
    return "이미 모든 칸이 채워져 있습니다.";
  }
  const [r, c, v] = hint;
  board[r][c] = v;
  return `힌트: (${r + 1},${c + 1}) = ${v}`;
}

function revealSolution() {
  board = cloneBoard(solution);
}

function inferStatusType(message) {
  if (message.includes("정답")) {
    return "ok";
  }
  if (message.includes("위반이 없습니다") || message.includes("입력 완료")) {
    return "ok";
  }
  if (
    message.includes("중복") ||
    message.includes("초과") ||
    message.includes("다릅니다") ||
    message.includes("위반")
  ) {
    return "err";
  }
  return "warn";
}

function setStatus(message, type = inferStatusType(message)) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function updateSelectionInfo() {
  if (!selected) {
    selectionInfoEl.textContent = "선택된 칸: 없음";
    return;
  }
  const [r, c] = selected;
  const cage = cellToCage.get(cellKey(r, c));
  const cageSum = cage.cells
    .map(([rr, cc]) => board[rr][cc])
    .filter((v) => v !== 0)
    .reduce((sum, v) => sum + v, 0);
  const fixed = fixedCells.has(cellKey(r, c)) ? "고정 숫자" : "입력 가능";
  selectionInfoEl.textContent = `선택된 칸: (${r + 1},${c + 1}) | 케이지 ${cage.name} 합 ${cageSum}/${cage.target} | ${fixed}`;
}

function renderBoardValues() {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      const valueEl = cell.querySelector(".value");
      const value = board[r][c];
      valueEl.textContent = value === 0 ? "" : String(value);

      const isFixed = fixedCells.has(cellKey(r, c));
      cell.classList.toggle("fixed", isFixed);
      cell.classList.toggle("editable", !isFixed);
      cell.classList.toggle("selected", !!selected && selected[0] === r && selected[1] === c);
    }
  }
}

function drawLegend() {
  legendEl.innerHTML = "";
  for (const cage of CAGES) {
    const item = document.createElement("div");
    item.className = "legend-item";
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.backgroundColor = cageColors.get(cage.name);
    const text = document.createElement("span");
    text.textContent = `${cage.name}: 합 ${cage.target}`;
    item.append(chip, text);
    legendEl.appendChild(item);
  }
}

function buildBoardDom() {
  boardEl.innerHTML = "";
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${r + 1}행 ${c + 1}열`);

      if (r % BOX_ROWS === 0) {
        cell.classList.add("top-thick");
      }
      if (r === SIZE - 1) {
        cell.classList.add("bottom-thick");
      }
      if (c % BOX_COLS === 0) {
        cell.classList.add("left-thick");
      }
      if (c === SIZE - 1) {
        cell.classList.add("right-thick");
      }

      const cage = cellToCage.get(cellKey(r, c));
      const cageSet = cageCellSets.get(cage.name);
      cell.style.backgroundColor = cageColors.get(cage.name);

      const neighbors = {
        top: cellKey(r - 1, c),
        bottom: cellKey(r + 1, c),
        left: cellKey(r, c - 1),
        right: cellKey(r, c + 1),
      };

      if (!cageSet.has(neighbors.top)) {
        cell.classList.add("cage-top");
      }
      if (!cageSet.has(neighbors.bottom)) {
        cell.classList.add("cage-bottom");
      }
      if (!cageSet.has(neighbors.left)) {
        cell.classList.add("cage-left");
      }
      if (!cageSet.has(neighbors.right)) {
        cell.classList.add("cage-right");
      }

      const anchor = cageAnchors.get(cage.name);
      if (anchor[0] === r && anchor[1] === c) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = `${cage.name}:${cage.target}`;
        cell.appendChild(tag);
      }

      const value = document.createElement("span");
      value.className = "value";
      cell.appendChild(value);

      cell.addEventListener("click", () => {
        selected = [r, c];
        updateSelectionInfo();
        renderBoardValues();
      });

      boardEl.appendChild(cell);
    }
  }
}

function inputNumber(value) {
  if (!selected) {
    setStatus("먼저 칸을 선택하세요.", "warn");
    return;
  }
  const [r, c] = selected;
  const message = setValue(r + 1, c + 1, value);
  setStatus(message);
  updateSelectionInfo();
  renderBoardValues();
  const check = checkBoard();
  if (check.startsWith("정답입니다")) {
    setStatus(check, "ok");
  }
}

function clearSelected() {
  if (!selected) {
    setStatus("먼저 칸을 선택하세요.", "warn");
    return;
  }
  const [r, c] = selected;
  const message = clearValue(r + 1, c + 1);
  setStatus(message);
  updateSelectionInfo();
  renderBoardValues();
}

function moveSelection(dx, dy) {
  if (!selected) {
    selected = [0, 0];
  } else {
    const nr = Math.max(0, Math.min(SIZE - 1, selected[0] + dy));
    const nc = Math.max(0, Math.min(SIZE - 1, selected[1] + dx));
    selected = [nr, nc];
  }
  updateSelectionInfo();
  renderBoardValues();
}

function bindUiEvents() {
  const numPadButtons = document.querySelectorAll("#numPad button[data-value]");
  numPadButtons.forEach((btn) => {
    btn.addEventListener("click", () => inputNumber(Number(btn.dataset.value)));
  });

  btnClear.addEventListener("click", clearSelected);
  btnCheck.addEventListener("click", () => setStatus(checkBoard()));
  btnHint.addEventListener("click", () => {
    const message = applyHint();
    setStatus(message);
    updateSelectionInfo();
    renderBoardValues();
    const check = checkBoard();
    if (check.startsWith("정답입니다")) {
      setStatus(check, "ok");
    }
  });
  btnReset.addEventListener("click", () => {
    resetBoard();
    selected = null;
    updateSelectionInfo();
    renderBoardValues();
    setStatus("보드를 초기 상태로 되돌렸습니다.", "warn");
  });
  btnSolve.addEventListener("click", () => {
    revealSolution();
    updateSelectionInfo();
    renderBoardValues();
    setStatus("정답 보드를 표시했습니다.", "warn");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key >= "1" && event.key <= "6") {
      inputNumber(Number(event.key));
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      clearSelected();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(0, -1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(0, 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(-1, 0);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(1, 0);
    }
  });
}

function initializeGame() {
  validateCageLayout();
  setupCageColors();
  resetBoard();

  const solved = findSolution(2, board);
  if (!solved.bestSolution || solved.found === 0) {
    throw new Error("초기 퍼즐이 풀 수 없는 상태입니다.");
  }
  solution = solved.bestSolution;
  solutionCount = solved.found;

  buildBoardDom();
  drawLegend();
  updateSelectionInfo();
  renderBoardValues();
  bindUiEvents();

  if (solutionCount > 1) {
    setStatus(`주의: 현재 퍼즐은 해답이 ${solutionCount}개 이상 존재할 수 있습니다.`, "warn");
    return;
  }
  setStatus("퍼즐을 시작하세요.", "warn");
}

try {
  initializeGame();
} catch (error) {
  setStatus(`초기화 실패: ${error instanceof Error ? error.message : String(error)}`, "err");
}
