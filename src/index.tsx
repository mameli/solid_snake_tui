import { createCliRenderer } from "@opentui/core";
import {
  render,
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/solid";
import type { JSX } from "@opentui/solid";
import { createEffect, createSignal, onCleanup } from "solid-js";

const TICK_MS = 120;
const BOOST_MULTIPLIER = 2;
const INITIAL_DIRECTION = "right" as const;
const INITIAL_SNAKE_LENGTH = 3;
const CELL_WIDTH = 2;
const MIN_BOARD_WIDTH = 8;
const MIN_BOARD_HEIGHT = 6;
const RESERVED_HORIZONTAL_CHARS = 6;
const RESERVED_VERTICAL_LINES = 13;
const BOARD_BOTTOM_SAFE_LINES = 1;

const COLORS = {
  snake: "#22c55e",
  food: "#ff4d4f",
  warning: "#ffcc66",
  success: "#33cc66",
  danger: "#ff5555",
  muted: "#888888",
  subtle: "#666666",
} as const;

const CELLS = {
  empty: "  ",
  food: "🍎",
  head: "🐲",
  body: "* ",
  tailLeft: "< ",
  tailRight: "> ",
  tailUp: "^ ",
  tailDown: "v ",
} as const;

type Position = {
  x: number;
  y: number;
};

type Direction = "up" | "down" | "left" | "right";

type BoardSize = {
  width: number;
  height: number;
};

type CellRender = {
  color?: string;
  content: string;
};

function positionKey(position: Position) {
  return `${position.x},${position.y}`;
}

function positionsEqual(a: Position, b: Position) {
  return a.x === b.x && a.y === b.y;
}

function isOppositeDirection(current: Direction, next: Direction) {
  return (
    (current === "up" && next === "down") ||
    (current === "down" && next === "up") ||
    (current === "left" && next === "right") ||
    (current === "right" && next === "left")
  );
}

function wrapCoordinate(value: number, size: number) {
  return ((value % size) + size) % size;
}

function getBoardSize(terminalWidth: number, terminalHeight: number): BoardSize {
  return {
    width: Math.max(
      1,
      Math.floor(Math.max(0, terminalWidth - RESERVED_HORIZONTAL_CHARS) / CELL_WIDTH),
    ),
    height: Math.max(
      1,
      terminalHeight - RESERVED_VERTICAL_LINES - BOARD_BOTTOM_SAFE_LINES,
    ),
  };
}

function isBoardTooSmall(boardSize: BoardSize) {
  return (
    boardSize.width < MIN_BOARD_WIDTH || boardSize.height < MIN_BOARD_HEIGHT
  );
}

function getDirectionFromKey(keyName: string): Direction | null {
  if (keyName === "up" || keyName === "w") return "up";
  if (keyName === "down" || keyName === "s") return "down";
  if (keyName === "left" || keyName === "a") return "left";
  if (keyName === "right" || keyName === "d") return "right";
  return null;
}

function getNextHead(
  head: Position,
  direction: Direction,
  boardSize: BoardSize,
): Position {
  if (direction === "up") {
    return { x: head.x, y: wrapCoordinate(head.y - 1, boardSize.height) };
  }

  if (direction === "down") {
    return { x: head.x, y: wrapCoordinate(head.y + 1, boardSize.height) };
  }

  if (direction === "left") {
    return { x: wrapCoordinate(head.x - 1, boardSize.width), y: head.y };
  }

  return { x: wrapCoordinate(head.x + 1, boardSize.width), y: head.y };
}

function getAdjacentDirection(
  from: Position,
  to: Position,
  boardSize: BoardSize,
): Direction {
  if (wrapCoordinate(from.x + 1, boardSize.width) === to.x && from.y === to.y) {
    return "right";
  }

  if (wrapCoordinate(from.x - 1, boardSize.width) === to.x && from.y === to.y) {
    return "left";
  }

  if (from.x === to.x && wrapCoordinate(from.y - 1, boardSize.height) === to.y) {
    return "up";
  }

  return "down";
}

function isOnSnake(position: Position, snake: Position[]) {
  return snake.some((segment) => positionsEqual(segment, position));
}

function getRandomFreePosition(snake: Position[], boardSize: BoardSize) {
  const occupied = new Set(snake.map(positionKey));
  const freeCells: Position[] = [];

  for (let y = 0; y < boardSize.height; y += 1) {
    for (let x = 0; x < boardSize.width; x += 1) {
      const candidate = { x, y };

      if (!occupied.has(positionKey(candidate))) {
        freeCells.push(candidate);
      }
    }
  }

  if (freeCells.length === 0) {
    return null;
  }

  return freeCells[Math.floor(Math.random() * freeCells.length)];
}

function createInitialSnake(boardSize: BoardSize) {
  const headX = Math.max(INITIAL_SNAKE_LENGTH - 1, Math.floor(boardSize.width / 2));
  const y = Math.floor(boardSize.height / 2);

  return Array.from({ length: INITIAL_SNAKE_LENGTH }, (_, index) => ({
    x: headX - index,
    y,
  }));
}

function createInitialFood(snake: Position[], boardSize: BoardSize) {
  return getRandomFreePosition(snake, boardSize) ?? { x: 0, y: 0 };
}

function getTailCell(snake: Position[], boardSize: BoardSize) {
  if (snake.length < 2) {
    return CELLS.body;
  }

  const tail = snake[snake.length - 1]!;
  const previous = snake[snake.length - 2]!;
  const tailDirection = getAdjacentDirection(tail, previous, boardSize);

  if (tailDirection === "right") return CELLS.tailLeft;
  if (tailDirection === "left") return CELLS.tailRight;
  if (tailDirection === "down") return CELLS.tailUp;
  return CELLS.tailDown;
}

function buildSnakeCellMap(snake: Position[], boardSize: BoardSize) {
  const snakeCells = new Map<string, string>();

  snake.forEach((segment, index) => {
    let content: string = CELLS.body;

    if (index === 0) {
      content = CELLS.head;
    } else if (index === snake.length - 1) {
      content = getTailCell(snake, boardSize);
    }

    snakeCells.set(positionKey(segment), content);
  });

  return snakeCells;
}

function renderCell({ content, color }: CellRender) {
  return color ? <span style={{ fg: color }}>{content}</span> : <span>{content}</span>;
}

function drawBoard(
  snake: Position[],
  food: Position,
  boardSize: BoardSize,
): JSX.Element[] {
  const output: JSX.Element[] = [];
  const snakeCells = buildSnakeCellMap(snake, boardSize);
  const foodKey = positionKey(food);

  for (let y = 0; y < boardSize.height; y += 1) {
    for (let x = 0; x < boardSize.width; x += 1) {
      const key = positionKey({ x, y });

      if (key === foodKey) {
        output.push(renderCell({ content: CELLS.food, color: COLORS.food }));
        continue;
      }

      const snakeCell = snakeCells.get(key);

      if (snakeCell) {
        output.push(renderCell({ content: snakeCell, color: COLORS.snake }));
      } else {
        output.push(renderCell({ content: CELLS.empty }));
      }
    }

    if (y < boardSize.height - 1) {
      output.push(<br />);
    }
  }

  return output;
}

const App = () => {
  const renderer = useRenderer();
  const terminalDimensions = useTerminalDimensions();
  const boardSize = () =>
    getBoardSize(terminalDimensions().width, terminalDimensions().height);
  const terminalTooSmall = () => isBoardTooSmall(boardSize());

  const [snake, setSnake] = createSignal<Position[]>([]);
  const [direction, setDirection] = createSignal<Direction>(INITIAL_DIRECTION);
  const [queuedDirection, setQueuedDirection] = createSignal<Direction | null>(
    null,
  );
  const [food, setFood] = createSignal<Position>({ x: 0, y: 0 });
  const [isPaused, setIsPaused] = createSignal(false);
  const [gameOver, setGameOver] = createSignal(false);
  const [hasWon, setHasWon] = createSignal(false);
  const [speedBoost, setSpeedBoost] = createSignal(false);

  const effectiveTickMs = () =>
    speedBoost() ? Math.max(1, Math.floor(TICK_MS / BOOST_MULTIPLIER)) : TICK_MS;
  const speedLabel = () => (speedBoost() ? "2x" : "1x");
  const score = () => Math.max(0, snake().length - INITIAL_SNAKE_LENGTH);

  const clearGame = () => {
    setSnake([]);
    setDirection(INITIAL_DIRECTION);
    setQueuedDirection(null);
    setFood({ x: 0, y: 0 });
    setIsPaused(false);
    setGameOver(false);
    setHasWon(false);
    setSpeedBoost(false);
  };

  const resetGame = () => {
    const size = boardSize();

    if (isBoardTooSmall(size)) {
      clearGame();
      return;
    }

    const nextSnake = createInitialSnake(size);

    setSnake(nextSnake);
    setDirection(INITIAL_DIRECTION);
    setQueuedDirection(null);
    setFood(createInitialFood(nextSnake, size));
    setIsPaused(false);
    setGameOver(false);
    setHasWon(false);
    setSpeedBoost(false);
  };

  const tick = () => {
    if (gameOver() || isPaused() || terminalTooSmall() || snake().length === 0) {
      return;
    }

    const size = boardSize();
    const currentSnake = snake();
    const appliedDirection = queuedDirection() ?? direction();
    const nextHead = getNextHead(currentSnake[0]!, appliedDirection, size);
    const willEat = positionsEqual(nextHead, food());
    const collisionBody = willEat ? currentSnake : currentSnake.slice(0, -1);

    if (isOnSnake(nextHead, collisionBody)) {
      setGameOver(true);
      return;
    }

    const nextSnake = [nextHead, ...currentSnake];

    if (!willEat) {
      nextSnake.pop();
    }

    setSnake(nextSnake);
    setDirection(appliedDirection);
    setQueuedDirection(null);

    if (!willEat) {
      return;
    }

    const nextFood = getRandomFreePosition(nextSnake, size);

    if (!nextFood) {
      setHasWon(true);
      setGameOver(true);
      return;
    }

    setFood(nextFood);
  };

  createEffect(() => {
    boardSize();
    resetGame();
  });

  useKeyboard((key) => {
    if (key.name === "escape") {
      renderer.destroy();
      return;
    }

    if (key.name === "r") {
      resetGame();
      return;
    }

    if (key.name === "space" || key.name === "p") {
      if (!gameOver() && !terminalTooSmall()) {
        setIsPaused((current) => !current);
      }
      return;
    }

    const nextDirection = getDirectionFromKey(key.name);

    if (
      !nextDirection ||
      gameOver() ||
      isPaused() ||
      terminalTooSmall() ||
      snake().length === 0
    ) {
      return;
    }

    const activeDirection = queuedDirection() ?? direction();

    if (nextDirection === activeDirection) {
      setSpeedBoost(true);
      return;
    }

    if (isOppositeDirection(direction(), nextDirection)) {
      return;
    }

    setQueuedDirection(nextDirection);
    setSpeedBoost(false);
  });

  createEffect(() => {
    const interval = setInterval(tick, effectiveTickMs());
    onCleanup(() => clearInterval(interval));
  });

  const statusText = () => {
    if (terminalTooSmall()) {
      return `Terminal too small. Need at least ${
        MIN_BOARD_WIDTH * CELL_WIDTH + RESERVED_HORIZONTAL_CHARS
      }x${
        MIN_BOARD_HEIGHT + RESERVED_VERTICAL_LINES + BOARD_BOTTOM_SAFE_LINES
      }. Resize and the game will reset automatically.`;
    }

    if (hasWon()) {
      return "You filled the board. Press R to play again.";
    }

    if (gameOver()) {
      return "Game Over. Press R to restart.";
    }

    if (isPaused()) {
      return "Paused. Press Space or P to resume.";
    }

    return "Arrows/WASD move. Press the same direction again for 2x speed. R restart. Esc exit.";
  };

  const statusColor = () => {
    if (terminalTooSmall()) return COLORS.warning;
    if (hasWon()) return COLORS.success;
    if (gameOver()) return COLORS.danger;
    if (isPaused()) return COLORS.warning;
    return COLORS.muted;
  };

  return (
    <box border padding={1} flexDirection="column" gap={1}>
      <text>Solid Snake TUI</text>
      <text>
        Score: {score()} | Board: {boardSize().width}x{boardSize().height} |
        Speed: {speedLabel()}
      </text>
      <box border padding={0}>
        <text>
          {terminalTooSmall()
            ? "Resize the terminal to start the game."
            : drawBoard(snake(), food(), boardSize())}
        </text>
      </box>
      <text fg={statusColor()}>{statusText()}</text>
      <text fg={COLORS.subtle}>
        Wrap-around is enabled on every side of the board.
      </text>
    </box>
  );
};

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
});

await render(App, renderer);
