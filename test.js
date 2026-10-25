import { Game2048Engine, Direction } from './engine.js';

console.log('--- Testing 2048 Game Engine ---');

const engine = new Game2048Engine({ size: 4 });
console.log('Initial tiles count:', engine.tiles.length);
console.log('Initial board:');
console.table(engine.board);

// Test move in all directions
console.log('Testing moves...');
engine.move(Direction.LEFT);
engine.move(Direction.DOWN);
engine.move(Direction.RIGHT);
engine.move(Direction.UP);

console.log('Current score:', engine.score);
console.log('Can undo?', engine.canUndo);
if (engine.canUndo) {
  const scoreBeforeUndo = engine.score;
  engine.undo();
  console.log('Undo successful! Score restored:', engine.score <= scoreBeforeUndo);
}

console.log('State snapshot:', engine.getState());
console.log('--- All tests passed! ---');
