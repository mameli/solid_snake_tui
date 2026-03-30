# Getting Started: Build Snake in the Terminal with OpenTUI and Solid

This guide teaches OpenTUI and Solid by building a Snake game one step at a time.

It is written for beginners. You do not need to already know:

- OpenTUI
- Solid.js
- terminal UI development

The goal is not to jump directly to the final game. The goal is to learn one concept at a time and always have something small that you can run and test.

## What this project already has

This repository is already configured correctly for OpenTUI + Solid:

- `package.json` includes `@opentui/core`, `@opentui/solid`, and `solid-js`
- `tsconfig.json` includes:
  - `"jsx": "preserve"`
  - `"jsxImportSource": "@opentui/solid"`
- `bunfig.toml` includes:
  - `preload = ["@opentui/solid/preload"]`

So you can focus on learning the library, not on tooling setup.

## Run the project

Install dependencies:

```bash
bun install
```

Run the app:

```bash
bun dev
```

During this guide, you will usually replace the contents of `src/index.tsx` with the code from the current step.

## The two roles in this project

It helps to separate the responsibilities clearly.

### OpenTUI

OpenTUI is responsible for terminal UI.

It gives you:

- a renderer for the terminal
- JSX terminal components such as `<box>` and `<text>`
- keyboard input hooks
- layout primitives
- terminal-specific behavior such as resize awareness

### Solid.js

Solid is responsible for reactivity.

It gives you:

- components
- state
- reactive updates
- cleanup and lifecycle utilities

Simple mental model:

- OpenTUI decides how the terminal UI is displayed
- Solid decides how data changes over time and updates the UI

## The core concepts you need

These are the ideas you will use repeatedly while building Snake.

### `render(...)`

`render(...)` mounts your Solid component tree into the terminal.

In a browser, you render into the DOM.
Here, you render into the terminal.

### JSX with `<box>` and `<text>`

With `@opentui/solid`, JSX tags create OpenTUI renderables.

The most useful ones for this project are:

- `<box>` for layout containers
- `<text>` for terminal text content

### Signals

Solid state is usually stored in signals.

```ts
const [count, setCount] = createSignal(0);
```

- `count()` reads the current value
- `setCount(...)` updates it

Important beginner rule:

the getter is a function, so you must call it.

### `useKeyboard(...)`

This hook listens for key presses in the terminal.

For Snake, it is how you handle:

- arrow keys
- WASD
- pause
- restart
- escape to exit

### `useTerminalDimensions()`

This hook gives you the current terminal size.

It is useful when you want the board to adapt to the terminal instead of using a fixed width and height.

### `onCleanup(...)`

If you create a timer with `setInterval(...)`, clean it up with `onCleanup(...)`.

Without cleanup, you can end up with duplicate timers during development.

## Why the board cells use two characters

Terminal character cells are usually taller than they are wide.

So if you draw the board with one character per cell:

- moving up/down may look visually faster
- the board may feel stretched vertically

That is why the final project uses cells like:

```ts
const EMPTY_CELL = "  ";
const HEAD_CELL = "🐲";
const BODY_CELL = "* ";
const FOOD_CELL = "🍎";
```

Each logical cell uses two terminal characters in width. This makes the movement feel more balanced.

## How to use this tutorial

For each step:

1. Replace `src/index.tsx`
2. Run `bun dev`
3. Confirm the result works
4. Read the explanation
5. Only then continue

If a step feels unclear, stop there and experiment before moving on.

## Step 1: Hello World

### Goal

Render a simple OpenTUI + Solid app.

### Concepts

- `render(...)`
- JSX
- `<box>`
- `<text>`

### Code

```tsx
import { render } from "@opentui/solid";

const App = () => {
  return (
    <box border padding={1} flexDirection="column">
      <text>Hello, World!</text>
      <text fg="#888888">Press Ctrl+C to exit.</text>
    </box>
  );
};

render(App, {
  exitOnCtrlC: true,
  targetFps: 30,
});
```

### What to notice

- `App` is just a Solid component
- `<box>` is your layout container
- `<text>` prints text into the terminal

## Step 2: Build a simple game panel

### Goal

Understand that the terminal UI is a tree of containers.

### Code

```tsx
import { render } from "@opentui/solid";

const App = () => {
  return (
    <box border padding={1} flexDirection="column" gap={1}>
      <text>Snake Prototype</text>
      <box border padding={1} minHeight={12}>
        <text>The game board will go here.</text>
      </box>
      <text fg="#888888">Outer box = app, inner box = board.</text>
    </box>
  );
};

render(App, {
  exitOnCtrlC: true,
  targetFps: 30,
});
```

### What to learn

You are not drawing directly on a canvas first.
You are composing terminal UI elements.

For Snake, this is useful because you naturally get:

- a title area
- a score line
- a board panel
- a status line

## Step 3: Draw one point on a board

### Goal

Render a small board from data.

### Concepts

- state represented as coordinates
- converting game state into terminal text

### Code

```tsx
import { render } from "@opentui/solid";

const BOARD_WIDTH = 20;
const BOARD_HEIGHT = 10;

const food = { x: 7, y: 4 };

function drawBoard() {
  let output = "";

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      output += x === food.x && y === food.y ? "* " : ". ";
    }

    if (y < BOARD_HEIGHT - 1) {
      output += "\n";
    }
  }

  return output;
}

const App = () => {
  return (
    <box border padding={1} flexDirection="column" gap={1}>
      <text>One point on the board</text>
      <box border padding={0}>
        <text>{drawBoard()}</text>
      </box>
    </box>
  );
};

render(App, {
  exitOnCtrlC: true,
  targetFps: 30,
});
```

### What to learn

This is the first important game-programming idea:

the UI is derived from data.

You are not manually placing a character at a terminal position. You are describing the whole board from state.

## Step 4: Make the point reactive with `createSignal`

### Goal

Move from static data to reactive data.

### Code

```tsx
import { render } from "@opentui/solid";
import { createSignal } from "solid-js";

type Position = {
  x: number;
  y: number;
};

const BOARD_WIDTH = 20;
const BOARD_HEIGHT = 10;

function drawBoard(food: Position) {
  let output = "";

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      output += x === food.x && y === food.y ? "* " : ". ";
    }

    if (y < BOARD_HEIGHT - 1) {
      output += "\n";
    }
  }

  return output;
}

const App = () => {
  const [food] = createSignal<Position>({ x: 7, y: 4 });

  return (
    <box border padding={1} flexDirection="column" gap={1}>
      <text>Reactive food position</text>
      <box border padding={0}>
        <text>{drawBoard(food())}</text>
      </box>
      <text fg="#888888">Food: ({food().x}, {food().y})</text>
    </box>
  );
};

render(App, {
  exitOnCtrlC: true,
  targetFps: 30,
});
```

### What to learn

Even before the game moves, the architecture is now correct:

- state lives in signals
- rendering depends on that state

## Step 5: Move one point with the keyboard

### Goal

Handle input with `useKeyboard(...)`.

### Code

```tsx
import { render, useKeyboard } from "@opentui/solid";
import { createSignal } from "solid-js";

type Position = {
  x: number;
  y: number;
};

const BOARD_WIDTH = 20;
const BOARD_HEIGHT = 10;

function drawBoard(player: Position) {
  let output = "";

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      output += x === player.x && y === player.y ? "@ " : ". ";
    }

    if (y < BOARD_HEIGHT - 1) {
      output += "\n";
    }
  }

  return output;
}

const App = () => {
  const [player, setPlayer] = createSignal<Position>({ x: 5, y: 5 });

  useKeyboard((key) => {
    if (key.name === "escape") {
      process.exit(0);
    }

    setPlayer((current) => {
      if (key.name === "up") return { ...current, y: Math.max(0, current.y - 1) };
      if (key.name === "down") return { ...current, y: Math.min(BOARD_HEIGHT - 1, current.y + 1) };
      if (key.name === "left") return { ...current, x: Math.max(0, current.x - 1) };
      if (key.name === "right") return { ...current, x: Math.min(BOARD_WIDTH - 1, current.x + 1) };
      return current;
    });
  });

  return (
    <box border padding={1} flexDirection="column" gap={1}>
      <text>Move the point with arrow keys</text>
      <box border padding={0}>
        <text>{drawBoard(player())}</text>
      </box>
      <text fg="#888888">Arrows to move, ESC to exit.</text>
    </box>
  );
};

render(App, {
  exitOnCtrlC: true,
  targetFps: 30,
});
```

### What to learn

You now have the first game loop ingredients:

- state
- input
- rendering
- simple rules

## Step 6: Add a timed game loop

### Goal

Move automatically over time.

### Concepts

- `setInterval(...)`
- direction as state
- `onCleanup(...)`

### Code

```tsx
import { render, useKeyboard } from "@opentui/solid";
import { createSignal, onCleanup } from "solid-js";

type Position = {
  x: number;
  y: number;
};

type Direction = "up" | "down" | "left" | "right";

const BOARD_WIDTH = 20;
const BOARD_HEIGHT = 10;
const TICK_MS = 180;

function drawBoard(player: Position) {
  let output = "";

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      output += x === player.x && y === player.y ? "@ " : ". ";
    }

    if (y < BOARD_HEIGHT - 1) {
      output += "\n";
    }
  }

  return output;
}

function getNextPosition(player: Position, direction: Direction): Position {
  if (direction === "up") return { x: player.x, y: player.y - 1 };
  if (direction === "down") return { x: player.x, y: player.y + 1 };
  if (direction === "left") return { x: player.x - 1, y: player.y };
  return { x: player.x + 1, y: player.y };
}

const App = () => {
  const [player, setPlayer] = createSignal<Position>({ x: 5, y: 5 });
  const [direction, setDirection] = createSignal<Direction>("right");

  useKeyboard((key) => {
    if (key.name === "escape") process.exit(0);
    if (key.name === "up") setDirection("up");
    if (key.name === "down") setDirection("down");
    if (key.name === "left") setDirection("left");
    if (key.name === "right") setDirection("right");
  });

  const interval = setInterval(() => {
    setPlayer((current) => getNextPosition(current, direction()));
  }, TICK_MS);

  onCleanup(() => clearInterval(interval));

  return (
    <box border padding={1} flexDirection="column" gap={1}>
      <text>Automatic movement</text>
      <box border padding={0}>
        <text>{drawBoard(player())}</text>
      </box>
    </box>
  );
};

render(App, {
  exitOnCtrlC: true,
  targetFps: 30,
});
```

### What to learn

Snake is not only about keyboard input.

The real structure is:

- input changes direction
- the timer advances the simulation
- the UI reacts to new state

## Step 7: Add wrap-around movement

### Goal

When the snake goes too far left, it should appear on the right. When it goes too far up, it should appear at the bottom.

### Important idea

This project uses wrap-around, not wall death.

### Code

```ts
function wrapCoordinate(value: number, size: number) {
  return ((value % size) + size) % size;
}
```

Then use it in movement:

```ts
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
```

### Why this matters

The modulo logic is especially important for negative values.

If you only do something like:

```ts
value % size
```

then `-1 % size` stays negative in JavaScript.

That is why the final helper uses:

```ts
((value % size) + size) % size
```

## Step 8: Turn the point into a snake

### Goal

Represent the snake as an array of positions.

### Example

```ts
[
  { x: 6, y: 7 },
  { x: 5, y: 7 },
  { x: 4, y: 7 },
]
```

The first element is the head.
The others are the body.

### Core movement rule

Every tick:

1. compute the next head
2. add it to the front
3. remove the tail if the snake did not eat

### Board rendering idea

Use different characters:

- `@ ` for the head
- `o ` for the body
- `* ` for food
- `  ` for empty cells

## Step 9: Add food

### Goal

Place food on an empty cell.

### Helper

```ts
function positionsEqual(a: Position, b: Position) {
  return a.x === b.x && a.y === b.y;
}
```

Food spawning:

```ts
function getRandomFreePosition(
  snake: Position[],
  boardWidth: number,
  boardHeight: number,
) {
  const freeCells: Position[] = [];

  for (let y = 0; y < boardHeight; y += 1) {
    for (let x = 0; x < boardWidth; x += 1) {
      const candidate = { x, y };

      const overlapsSnake = snake.some(
        (segment) => segment.x === candidate.x && segment.y === candidate.y,
      );

      if (!overlapsSnake) {
        freeCells.push(candidate);
      }
    }
  }

  if (freeCells.length === 0) {
    return null;
  }

  return freeCells[Math.floor(Math.random() * freeCells.length)];
}
```

### Why this matters

This is the step where the game gets a reward loop:

- move
- eat
- grow
- continue

## Step 10: Grow the snake when it eats

### Goal

Keep the tail when the head reaches the food.

### Logic

Normally:

- add a new head
- remove the last segment

When eating:

- add a new head
- do not remove the tail

That one difference is what makes the snake grow.

## Step 11: Prevent reverse movement

### Goal

Do not allow right-to-left or up-to-down immediately.

### Helper

```ts
function isOppositeDirection(current: Direction, next: Direction) {
  return (
    (current === "up" && next === "down") ||
    (current === "down" && next === "up") ||
    (current === "left" && next === "right") ||
    (current === "right" && next === "left")
  );
}
```

### Why this matters

It avoids accidental instant self-collisions and weird movement.

## Step 12: Add self-collision

### Goal

End the game when the head hits the body.

### Idea

Before committing the next snake state:

1. compute the next head
2. decide whether the snake will eat
3. check collision against the correct body

Important detail:

- if the snake does not eat, the tail is about to move away
- if the snake eats, the tail stays

That is why collision is often checked against:

```ts
const collisionBody = willEat ? currentSnake : currentSnake.slice(0, -1);
```

## Step 13: Add pause, restart, and score

### Goal

Make the game practical to use.

### Useful controls

- arrows or WASD to move
- `Space` or `P` to pause
- `R` to restart
- `Escape` to exit

### Score

The simplest score is:

```ts
snake().length - INITIAL_SNAKE_LENGTH
```

## Step 14: Make the board dynamic to terminal size

### Goal

Adapt the board to the terminal instead of using fixed constants like:

```ts
const BOARD_WIDTH = 24;
const BOARD_HEIGHT = 14;
```

### Hook

```tsx
const terminalDimensions = useTerminalDimensions();
```

This gives you the current terminal size.

### Idea

The board cannot use the full terminal area because the app also needs space for:

- borders
- padding
- the title
- the score line
- the status line

So you subtract some reserved space:

```ts
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
```

### Why this matters

Because each game cell is two terminal characters wide, the width calculation must divide by `CELL_WIDTH`.

## Step 15: Reset the whole game when the terminal resizes

### Goal

When the terminal changes size, do not try to continue the current game.
Just reset everything.

This is the behavior used in this project.

### Why this approach is good

It is simpler and more reliable than trying to preserve state across resize events.

If the terminal becomes smaller:

- the snake may no longer fit
- food may end up out of bounds
- the board may become too small for a valid game

So a full reset is a good design choice.

### Code pattern

```tsx
createEffect(() => {
  boardWidth();
  boardHeight();
  resetGame();
});
```

This means:

- when width changes, reset
- when height changes, reset

### Minimum size handling

If the terminal becomes too small, the game should stop and display a message instead of trying to run.

Example idea:

```ts
const terminalTooSmall = () =>
  boardWidth() < MIN_BOARD_WIDTH || boardHeight() < MIN_BOARD_HEIGHT;
```

Then inside `resetGame()`:

- if too small, clear the game state
- otherwise create a fresh snake and fresh food

## Final architecture

By the end, the game should have these parts.

### State

- `snake`
- `direction`
- `queuedDirection`
- `food`
- `isPaused`
- `gameOver`
- `hasWon`

### Input

- keyboard changes intended direction
- keyboard can pause, restart, or exit

### Simulation

- timer advances the game
- movement uses wrap-around
- collision is checked
- food is spawned

### Rendering

- a board string is generated from the current state
- the terminal UI displays score, board, and status

## Common beginner mistakes

### Forgetting that signals are functions

Wrong:

```ts
food.x
```

Correct:

```ts
food().x
```

### Mutating arrays directly

Wrong:

```ts
snake().push({ x: 1, y: 1 });
```

Correct:

```ts
setSnake((current) => [{ x: 1, y: 1 }, ...current]);
```

### Mixing rendering and game rules too early

Try to keep these separate:

- input handling
- simulation rules
- board rendering

### Trying to preserve a running game during resize

For a beginner project, that adds unnecessary complexity.

Resetting on resize is a simpler and better choice.

## Suggested milestone order

Use this order:

1. Hello World
2. panel layout
3. one point on the board
4. reactive point
5. keyboard movement
6. timer-based movement
7. wrap-around movement
8. snake body as an array
9. food spawning
10. growth on eat
11. prevent reverse direction
12. self-collision
13. pause, restart, score
14. dynamic board size
15. full reset on terminal resize

## Notes about the current implementation

The current project has a few practical details that are worth knowing.

### The body uses a simple single-character cell

The current body rendering is intentionally simple:

```ts
const BODY_CELL = "* ";
```

The head and food use emoji, while the tail is directional:

- `< ` for left
- `> ` for right
- `^ ` for up
- `v ` for down

### Speed is shown as `1x` or `2x`

The current UI does not show speed in milliseconds.
It shows:

- `1x` for normal speed
- `2x` when you press the same direction again

### The game resets on terminal resize

This is intentional.

When the terminal size changes:

- the board is recalculated
- the game state is reset

This is much simpler than trying to preserve the current game.

### The board keeps a bottom safety line

In a terminal UI, the visual content area and the border area can be easy to misjudge by one row.

The current implementation keeps one extra safe line at the bottom so the snake cannot appear visually inside the bottom border of the box.

## Official docs

- [OpenTUI Getting Started](https://opentui.com/docs/getting-started/)
- [OpenTUI Solid bindings](https://opentui.com/docs/bindings/solid/)
- [OpenTUI Keyboard](https://opentui.com/docs/core-concepts/keyboard/)
- [OpenTUI Layout](https://opentui.com/docs/core-concepts/layout/)

## About the current project

The current implementation in `src/index.tsx` already includes the advanced version of the game:

- snake body
- food
- growth
- self-collision
- wrap-around on all sides
- pause and restart
- board size derived from the terminal
- full reset whenever the terminal size changes

If you want to learn the library properly, do not treat the final file as the first thing to study.

Start from the small steps, run each one, and only then compare your version to the final implementation.
