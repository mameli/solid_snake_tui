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
const MIN_BOARD_WIDTH = 20;
const MIN_BOARD_HEIGHT = 6;
const RESERVED_HORIZONTAL_CHARS = 6;
const RESERVED_VERTICAL_LINES = 13;
const BOARD_BOTTOM_SAFE_LINES = 1;

const COLORS = {
  appBackground: "#282c34",
  panelBackground: "#282c34",
  boardBackground: "#282c34",
  text: "#dcdfe4",
  secondaryText: "#dcdfe495",
  snake: "#98c379",
  food: "#e06c75",
  warning: "#e5c07b",
  success: "#98c379",
  danger: "#e06c75",
  border: "#dcdfe4",
  boardBorder: "#dcdfe4",
} as const;

const KEY_TO_DIRECTION = {
  up: "up",
  w: "up",
  down: "down",
  s: "down",
  left: "left",
  a: "left",
  right: "right",
  d: "right",
} as const;

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;

const OPPOSITE_DIRECTIONS = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
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
  background?: string;
  content: string;
};

const TAIL_CELLS: Record<Direction, string> = {
  right: CELLS.tailLeft,
  left: CELLS.tailRight,
  down: CELLS.tailUp,
  up: CELLS.tailDown,
};

type GameStatus = "tooSmall" | "won" | "gameOver" | "paused" | "running";

type GameSnapshot = {
  snake: Position[];
  direction: Direction;
  queuedDirection: Direction | null;
  food: Position;
  isPaused: boolean;
  gameOver: boolean;
  hasWon: boolean;
  speedBoost: boolean;
};

const EMPTY_POSITION: Position = { x: 0, y: 0 };

const STATUS_COPY: Record<GameStatus, string> = {
  tooSmall: `Terminal too small. Need at least ${
    MIN_BOARD_WIDTH * CELL_WIDTH + RESERVED_HORIZONTAL_CHARS
  }x${
    MIN_BOARD_HEIGHT + RESERVED_VERTICAL_LINES + BOARD_BOTTOM_SAFE_LINES
  }. Resize and the game will reset automatically.`,
  won: "You filled the board. Press R to play again.",
  gameOver: "Game Over. Press R to restart.",
  paused: "Paused. Press Space or P to resume.",
  running:
    "Arrows/WASD move. Press the same direction again for 2x speed. R restart. Esc exit.",
};

const STATUS_COLORS: Record<GameStatus, string> = {
  tooSmall: COLORS.warning,
  won: COLORS.success,
  gameOver: COLORS.danger,
  paused: COLORS.warning,
  running: COLORS.secondaryText,
};

function positionKey(position: Position) {
  return `${position.x},${position.y}`;
}

function positionsEqual(a: Position, b: Position) {
  return a.x === b.x && a.y === b.y;
}

function isOppositeDirection(current: Direction, next: Direction) {
  return OPPOSITE_DIRECTIONS[current] === next;
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
  return KEY_TO_DIRECTION[keyName as keyof typeof KEY_TO_DIRECTION] ?? null;
}

function getNextHead(
  head: Position,
  direction: Direction,
  boardSize: BoardSize,
): Position {
  const vector = DIRECTION_VECTORS[direction];

  return {
    x: wrapCoordinate(head.x + vector.x, boardSize.width),
    y: wrapCoordinate(head.y + vector.y, boardSize.height),
  };
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
  return getRandomFreePosition(snake, boardSize) ?? EMPTY_POSITION;
}

function getTailCell(snake: Position[], boardSize: BoardSize) {
  if (snake.length < 2) {
    return CELLS.body;
  }

  const tail = snake[snake.length - 1]!;
  const previous = snake[snake.length - 2]!;
  const tailDirection = getAdjacentDirection(tail, previous, boardSize);

  return TAIL_CELLS[tailDirection];
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

function renderCell({ content, color, background }: CellRender) {
  const style = {
    ...(color ? { fg: color } : {}),
    ...(background ? { bg: background } : {}),
  };

  return <span style={style}>{content}</span>;
}

function createEmptySnapshot(): GameSnapshot {
  return {
    snake: [],
    direction: INITIAL_DIRECTION,
    queuedDirection: null,
    food: EMPTY_POSITION,
    isPaused: false,
    gameOver: false,
    hasWon: false,
    speedBoost: false,
  };
}

function createInitialSnapshot(boardSize: BoardSize): GameSnapshot {
  const snake = createInitialSnake(boardSize);

  return {
    ...createEmptySnapshot(),
    snake,
    food: createInitialFood(snake, boardSize),
  };
}

function getGameStatus({
  terminalTooSmall,
  hasWon,
  gameOver,
  isPaused,
}: {
  terminalTooSmall: boolean;
  hasWon: boolean;
  gameOver: boolean;
  isPaused: boolean;
}): GameStatus {
  if (terminalTooSmall) return "tooSmall";
  if (hasWon) return "won";
  if (gameOver) return "gameOver";
  if (isPaused) return "paused";
  return "running";
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
        output.push(
          renderCell({
            content: CELLS.food,
            color: COLORS.food,
            background: COLORS.boardBackground,
          }),
        );
        continue;
      }

      const snakeCell = snakeCells.get(key);

      if (snakeCell) {
        output.push(
          renderCell({
            content: snakeCell,
            color: COLORS.snake,
            background: COLORS.boardBackground,
          }),
        );
      } else {
        output.push(
          renderCell({
            content: CELLS.empty,
            background: COLORS.boardBackground,
          }),
        );
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
  const [food, setFood] = createSignal<Position>(EMPTY_POSITION);
  const [isPaused, setIsPaused] = createSignal(false);
  const [gameOver, setGameOver] = createSignal(false);
  const [hasWon, setHasWon] = createSignal(false);
  const [speedBoost, setSpeedBoost] = createSignal(false);

  const effectiveTickMs = () =>
    speedBoost() ? Math.max(1, Math.floor(TICK_MS / BOOST_MULTIPLIER)) : TICK_MS;
  const speedLabel = () => (speedBoost() ? "2x" : "1x");
  const score = () => Math.max(0, snake().length - INITIAL_SNAKE_LENGTH);

  const applySnapshot = (snapshot: GameSnapshot) => {
    setSnake(snapshot.snake);
    setDirection(snapshot.direction);
    setQueuedDirection(snapshot.queuedDirection);
    setFood(snapshot.food);
    setIsPaused(snapshot.isPaused);
    setGameOver(snapshot.gameOver);
    setHasWon(snapshot.hasWon);
    setSpeedBoost(snapshot.speedBoost);
  };

  const clearGame = () => applySnapshot(createEmptySnapshot());

  const resetGame = () => {
    const size = boardSize();

    if (isBoardTooSmall(size)) {
      clearGame();
      return;
    }

    applySnapshot(createInitialSnapshot(size));
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

  const status = () =>
    getGameStatus({
      terminalTooSmall: terminalTooSmall(),
      hasWon: hasWon(),
      gameOver: gameOver(),
      isPaused: isPaused(),
    });

  return (
    <box
      border
      borderColor={COLORS.border}
      backgroundColor={COLORS.panelBackground}
      padding={1}
      flexDirection="column"
      gap={1}
    >
      <text fg={COLORS.text}>Solid Snake TUI</text>
      <text fg={COLORS.secondaryText}>
        Score: {score()} | Board: {boardSize().width}x{boardSize().height} |
        Speed: {speedLabel()}
      </text>
      <box
        border
        borderColor={COLORS.boardBorder}
        backgroundColor={COLORS.boardBackground}
        padding={0}
      >
        <text fg={COLORS.text} bg={COLORS.boardBackground}>
          {terminalTooSmall()
            ? "Resize the terminal to start the game."
            : drawBoard(snake(), food(), boardSize())}
        </text>
      </box>
      <text fg={STATUS_COLORS[status()]}>{STATUS_COPY[status()]}</text>
      <text fg={COLORS.secondaryText}>
        Wrap-around is enabled on every side of the board.
      </text>
    </box>
  );
};

const renderer = await createCliRenderer({
  backgroundColor: COLORS.appBackground,
  exitOnCtrlC: true,
  targetFps: 30,
});

await render(App, renderer);
