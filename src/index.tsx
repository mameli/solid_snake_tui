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
const EMPTY_CELL = "  ";
const FOOD_CELL = "🍎";
const HEAD_CELL = "🐲";
const BODY_CELL = "* ";
const TAIL_LEFT_CELL = "< ";
const TAIL_RIGHT_CELL = "> ";
const TAIL_UP_CELL = "^ ";
const TAIL_DOWN_CELL = "v ";
const CELL_WIDTH = HEAD_CELL.length;
const MIN_BOARD_WIDTH = 8;
const MIN_BOARD_HEIGHT = 6;
const RESERVED_HORIZONTAL_CHARS = 6;
const RESERVED_VERTICAL_LINES = 13;

type Position = {
  x: number;
  y: number;
};

type Direction = "up" | "down" | "left" | "right";

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

function getNextHead(
  head: Position,
  direction: Direction,
  boardWidth: number,
  boardHeight: number,
): Position {
  if (direction === "up") {
    return { x: head.x, y: wrapCoordinate(head.y - 1, boardHeight) };
  }

  if (direction === "down") {
    return { x: head.x, y: wrapCoordinate(head.y + 1, boardHeight) };
  }

  if (direction === "left") {
    return { x: wrapCoordinate(head.x - 1, boardWidth), y: head.y };
  }

  return { x: wrapCoordinate(head.x + 1, boardWidth), y: head.y };
}

function isOnSnake(position: Position, snake: Position[]) {
  return snake.some((segment) => positionsEqual(segment, position));
}

function getTailCell(
  snake: Position[],
  boardWidth: number,
  boardHeight: number,
) {
  if (snake.length < 2) {
    return BODY_CELL;
  }

  const tail = snake[snake.length - 1]!;
  const previous = snake[snake.length - 2]!;

  if (
    wrapCoordinate(tail.x + 1, boardWidth) === previous.x &&
    tail.y === previous.y
  ) {
    return TAIL_LEFT_CELL;
  }

  if (
    wrapCoordinate(tail.x - 1, boardWidth) === previous.x &&
    tail.y === previous.y
  ) {
    return TAIL_RIGHT_CELL;
  }

  if (
    wrapCoordinate(tail.y + 1, boardHeight) === previous.y &&
    tail.x === previous.x
  ) {
    return TAIL_UP_CELL;
  }

  return TAIL_DOWN_CELL;
}

function getRandomFreePosition(
  snake: Position[],
  boardWidth: number,
  boardHeight: number,
) {
  const freeCells: Position[] = [];

  for (let y = 0; y < boardHeight; y += 1) {
    for (let x = 0; x < boardWidth; x += 1) {
      const candidate = { x, y };

      if (!isOnSnake(candidate, snake)) {
        freeCells.push(candidate);
      }
    }
  }

  if (freeCells.length === 0) {
    return null;
  }

  return freeCells[Math.floor(Math.random() * freeCells.length)];
}

function createInitialSnake(boardWidth: number, boardHeight: number) {
  const headX = Math.max(INITIAL_SNAKE_LENGTH - 1, Math.floor(boardWidth / 2));
  const y = Math.floor(boardHeight / 2);

  return Array.from({ length: INITIAL_SNAKE_LENGTH }, (_, index) => ({
    x: headX - index,
    y,
  }));
}

function createInitialFood(
  snake: Position[],
  boardWidth: number,
  boardHeight: number,
) {
  return getRandomFreePosition(snake, boardWidth, boardHeight) ?? { x: 0, y: 0 };
}

function drawBoard(
  snake: Position[],
  food: Position,
  boardWidth: number,
  boardHeight: number,
): JSX.Element[] {
  const output: JSX.Element[] = [];

  for (let y = 0; y < boardHeight; y += 1) {
    for (let x = 0; x < boardWidth; x += 1) {
      if (x === food.x && y === food.y) {
        output.push(<span style={{ fg: "#ff4d4f" }}>{FOOD_CELL}</span>);
        continue;
      }

      const segmentIndex = snake.findIndex(
        (segment) => segment.x === x && segment.y === y,
      );

      if (segmentIndex === 0) {
        output.push(<span style={{ fg: "#22c55e" }}>{HEAD_CELL}</span>);
      } else if (segmentIndex === snake.length - 1) {
        output.push(
          <span style={{ fg: "#22c55e" }}>
            {getTailCell(snake, boardWidth, boardHeight)}
          </span>,
        );
      } else if (segmentIndex > 0) {
        output.push(<span style={{ fg: "#22c55e" }}>{BODY_CELL}</span>);
      } else {
        output.push(<span>{EMPTY_CELL}</span>);
      }
    }

    if (y < boardHeight - 1) {
      output.push(<br />);
    }
  }

  return output;
}

const App = () => {
  const renderer = useRenderer();
  const terminalDimensions = useTerminalDimensions();
  const boardWidth = () =>
    Math.max(
      1,
      Math.floor(
        Math.max(0, terminalDimensions().width - RESERVED_HORIZONTAL_CHARS) /
          CELL_WIDTH,
      ),
    );
  const boardHeight = () =>
    Math.max(1, terminalDimensions().height - RESERVED_VERTICAL_LINES);
  const terminalTooSmall = () =>
    boardWidth() < MIN_BOARD_WIDTH || boardHeight() < MIN_BOARD_HEIGHT;

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

  const resetGame = () => {
    if (terminalTooSmall()) {
      setSnake([]);
      setDirection(INITIAL_DIRECTION);
      setQueuedDirection(null);
      setFood({ x: 0, y: 0 });
      setIsPaused(false);
      setGameOver(false);
      setHasWon(false);
      setSpeedBoost(false);
      return;
    }

    const nextSnake = createInitialSnake(boardWidth(), boardHeight());

    setSnake(nextSnake);
    setDirection(INITIAL_DIRECTION);
    setQueuedDirection(null);
    setFood(createInitialFood(nextSnake, boardWidth(), boardHeight()));
    setIsPaused(false);
    setGameOver(false);
    setHasWon(false);
    setSpeedBoost(false);
  };

  createEffect(() => {
    boardWidth();
    boardHeight();
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

    const nextDirection =
      key.name === "up" || key.name === "w"
        ? "up"
        : key.name === "down" || key.name === "s"
          ? "down"
          : key.name === "left" || key.name === "a"
            ? "left"
            : key.name === "right" || key.name === "d"
              ? "right"
              : null;

    if (
      !nextDirection ||
      gameOver() ||
      isPaused() ||
      terminalTooSmall() ||
      snake().length === 0
    ) {
      return;
    }

    if (nextDirection === (queuedDirection() ?? direction())) {
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
    const interval = setInterval(() => {
      if (gameOver() || isPaused() || terminalTooSmall() || snake().length === 0) {
        return;
      }

      const currentSnake = snake();
      const appliedDirection = queuedDirection() ?? direction();
      const nextHead = getNextHead(
        currentSnake[0]!,
        appliedDirection,
        boardWidth(),
        boardHeight(),
      );
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

      const nextFood = getRandomFreePosition(
        nextSnake,
        boardWidth(),
        boardHeight(),
      );

      if (!nextFood) {
        setHasWon(true);
        setGameOver(true);
        return;
      }

      setFood(nextFood);
    }, effectiveTickMs());

    onCleanup(() => clearInterval(interval));
  });

  const score = () => Math.max(0, snake().length - INITIAL_SNAKE_LENGTH);
  const statusText = () => {
    if (terminalTooSmall()) {
      return `Terminal too small. Need at least ${
        MIN_BOARD_WIDTH * CELL_WIDTH + RESERVED_HORIZONTAL_CHARS
      }x${
        MIN_BOARD_HEIGHT + RESERVED_VERTICAL_LINES
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

    return "Arrows/WASD move. Space/P pause. R restart. Esc exit.";
  };

  const statusColor = () => {
    if (terminalTooSmall()) return "#ffcc66";
    if (hasWon()) return "#33cc66";
    if (gameOver()) return "#ff5555";
    if (isPaused()) return "#ffcc66";
    return "#888888";
  };

  return (
    <box border padding={1} flexDirection="column" gap={1}>
      <text>Solid Snake TUI</text>
      <text>
        Score: {score()} | Board: {boardWidth()}x{boardHeight()} | Speed:{" "}
        {speedLabel()}
      </text>
      <box border padding={0}>
        <text>
          {terminalTooSmall()
            ? "Resize the terminal to start the game."
            : drawBoard(snake(), food(), boardWidth(), boardHeight())}
        </text>
      </box>
      <text fg={statusColor()}>{statusText()}</text>
      <text fg="#666666">
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
