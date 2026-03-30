import { render, useKeyboard } from "@opentui/solid";
import { createSignal, onCleanup } from "solid-js";

const BOARD_WIDTH = 24;
const BOARD_HEIGHT = 14;
const TICK_MS = 120;
const INITIAL_DIRECTION = "right" as const;
const EMPTY_CELL = "  ";
const FOOD_CELL = "* ";
const HEAD_CELL = "@ ";
const BODY_CELL = "o ";
const INITIAL_SNAKE = [
  { x: 6, y: 7 },
  { x: 5, y: 7 },
  { x: 4, y: 7 },
];

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

function getNextHead(head: Position, direction: Direction): Position {
  if (direction === "up") {
    return { x: head.x, y: wrapCoordinate(head.y - 1, BOARD_HEIGHT) };
  }

  if (direction === "down") {
    return { x: head.x, y: wrapCoordinate(head.y + 1, BOARD_HEIGHT) };
  }

  if (direction === "left") {
    return { x: wrapCoordinate(head.x - 1, BOARD_WIDTH), y: head.y };
  }

  return { x: wrapCoordinate(head.x + 1, BOARD_WIDTH), y: head.y };
}

function isOnSnake(position: Position, snake: Position[]) {
  return snake.some((segment) => positionsEqual(segment, position));
}

function getRandomFreePosition(snake: Position[]) {
  const freeCells: Position[] = [];

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
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

function createInitialSnake() {
  return INITIAL_SNAKE.map((segment) => ({ ...segment }));
}

function createInitialFood(snake: Position[]) {
  return getRandomFreePosition(snake) ?? { x: 0, y: 0 };
}

function drawBoard(snake: Position[], food: Position) {
  let output = "";

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (x === food.x && y === food.y) {
        output += FOOD_CELL;
        continue;
      }

      const segmentIndex = snake.findIndex(
        (segment) => segment.x === x && segment.y === y,
      );

      if (segmentIndex === 0) {
        output += HEAD_CELL;
      } else if (segmentIndex > 0) {
        output += BODY_CELL;
      } else {
        output += EMPTY_CELL;
      }
    }

    if (y < BOARD_HEIGHT - 1) {
      output += "\n";
    }
  }

  return output;
}

const App = () => {
  const [snake, setSnake] = createSignal<Position[]>(createInitialSnake());
  const [direction, setDirection] = createSignal<Direction>(INITIAL_DIRECTION);
  const [queuedDirection, setQueuedDirection] = createSignal<Direction | null>(
    null,
  );
  const [food, setFood] = createSignal<Position>(createInitialFood(snake()));
  const [isPaused, setIsPaused] = createSignal(false);
  const [gameOver, setGameOver] = createSignal(false);
  const [hasWon, setHasWon] = createSignal(false);

  const resetGame = () => {
    const nextSnake = createInitialSnake();

    setSnake(nextSnake);
    setDirection(INITIAL_DIRECTION);
    setQueuedDirection(null);
    setFood(createInitialFood(nextSnake));
    setIsPaused(false);
    setGameOver(false);
    setHasWon(false);
  };

  useKeyboard((key) => {
    if (key.name === "escape") {
      process.exit(0);
    }

    if (key.name === "r") {
      resetGame();
      return;
    }

    if (key.name === "space" || key.name === "p") {
      if (!gameOver()) {
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

    if (!nextDirection || gameOver() || isPaused()) {
      return;
    }

    if (isOppositeDirection(direction(), nextDirection)) {
      return;
    }

    setQueuedDirection(nextDirection);
  });

  const interval = setInterval(() => {
    if (gameOver() || isPaused()) {
      return;
    }

    const currentSnake = snake();
    const appliedDirection = queuedDirection() ?? direction();
    const nextHead = getNextHead(currentSnake[0]!, appliedDirection);
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

    const nextFood = getRandomFreePosition(nextSnake);

    if (!nextFood) {
      setHasWon(true);
      setGameOver(true);
      return;
    }

    setFood(nextFood);
  }, TICK_MS);

  onCleanup(() => clearInterval(interval));

  const score = () => snake().length - INITIAL_SNAKE.length;
  const statusText = () => {
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
    if (hasWon()) return "#33cc66";
    if (gameOver()) return "#ff5555";
    if (isPaused()) return "#ffcc66";
    return "#888888";
  };

  return (
    <box border padding={1} flexDirection="column" gap={1}>
      <text>Solid Snake Terminal</text>
      <text>
        Score: {score()} | Length: {snake().length} | Speed: {TICK_MS}ms
      </text>
      <box border padding={1}>
        <text>{drawBoard(snake(), food())}</text>
      </box>
      <text fg={statusColor()}>{statusText()}</text>
      <text fg="#666666">
        Wrap-around is enabled on every side of the board.
      </text>
    </box>
  );
};

render(App, {
  exitOnCtrlC: true,
  targetFps: 30,
});
