# AlphaZorua

Pokemon engine

## Installation

```bash
# Using bun
bun add alphazorua

# Using yarn
yarn add alphazorua

# Using npm
npm install alphazorua
```

## Usage

```typescript
import { bestMove } from 'magikarp'

const result = await bestMove(battle, {
    maxDepth: 4,
    verbose: true,
})
```

## Optimizations

The engine uses several optimizations to improve search speed and decision quality:

### Core Search Optimizations

1. **Alpha-Beta Pruning**

    - Prunes branches that can't affect the final decision
    - Significantly reduces the number of positions evaluated
    - Implemented in the minimax search function

2. **Move Ordering**
    - Orders moves by likely strength to improve pruning
    - Considers:
        - Base power
        - Type effectiveness
        - STAB bonus
        - Terastallize bonus
        - Priority moves
        - Status move value
        - Switch position quality

### Caching Optimizations

3. **Type Effectiveness Cache**

    - Caches type effectiveness calculations
    - Avoids recalculating common type matchups

4. **Battle State Cache**

    - Caches battle states using HP percentages
    - Reduces clone operations for similar positions

5. **Transposition Table**

    - Stores search results for previously seen positions
    - Reuses results when encountering similar positions
    - Includes depth and bound information

6. **Evaluation Cache**
    - Caches evaluation results for leaf nodes
    - Avoids recalculating static evaluations

### Learning Optimizations

7. **History Heuristic**
    - Learns from successful/unsuccessful moves
    - Improves move ordering based on search history
    - Adapts to effective moves during gameplay

### Parallel Search Optimizations

8. **Lazy SMP (Symmetric Multi-Processing)**
    - Runs multiple searches in parallel with offset search windows
    - Each thread explores different parts of the tree
    - Simple but effective parallelization strategy
    - Used by chess engines like Stockfish

## Performance Impact

Most impactful optimizations:

1. Move Ordering (major improvement)
2. Alpha-Beta Pruning (major improvement)
3. Evaluation Caching (noticeable improvement)
4. History Heuristic (helps move ordering)

Other optimizations had smaller impacts but help in specific situations.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.3. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## TODO List

-   [x] Alpha-Beta Pruning
    -   Accuracy: No loss
    -   Speed: ~10-20% faster
-   [x] Move Ordering (base implementation)
    -   Accuracy: No loss
    -   Speed: ~10-20% faster
-   [x] Type Effectiveness Cache
    -   Accuracy: No loss
    -   Speed: ~5-10% faster
-   [x] Battle State Cache
    -   Accuracy: No loss
    -   Speed: ~5-10% faster
-   [x] Transposition Table
    -   Accuracy: No loss
    -   Speed: ~5-10% faster
-   [x] Evaluation Cache
    -   Accuracy: No loss
    -   Speed: ~10-15% faster
-   [x] History Heuristic
    -   Accuracy: No loss
    -   Speed: ~5-10% faster
-   [x] Lazy SMP (parallel search)
    -   Accuracy: No loss
    -   Speed: No significant improvement (JS limitations)
-   [x] Progressive Deepening
    -   Accuracy: No loss
    -   Speed: ~40-50% faster
    -   Benefits:
        -   Always returns a move within time limit
        -   Better move ordering from previous depths
        -   Earlier depths guide deeper searches
-   [ ] Move Limiting at Deep Depths
    -   Accuracy: Small loss at deep positions
    -   Speed: ~40-60% faster
-   [ ] Quiescence Search
    -   Accuracy: Better in tactical positions
    -   Speed: ~10-20% slower
-   [ ] Late Move Reduction
    -   Accuracy: Small loss in some positions
    -   Speed: ~30-40% faster
-   [ ] Null Move Pruning
    -   Accuracy: Small loss in zugzwang positions
    -   Speed: ~20-30% faster
-   [ ] Static Exchange Evaluation
    -   Accuracy: No loss
    -   Speed: ~5-10% faster
-   [ ] Principal Variation Search
    -   Accuracy: No loss
    -   Speed: ~10-20% faster
-   [ ] Futility Pruning
    -   Accuracy: Small loss in deep positions
    -   Speed: ~20-30% faster
