import { createRandomBattle, makeRandomMove } from '../src/battle'
import { evaluatePosition } from '../src/eval'
import { bestMove, getAvailableChoices } from '../src/engine'
import { Battle } from '@pkmn/sim'

describe('Engine Tests', () => {
    test('Progressive Deepening', async () => {
        const NUM_POSITIONS = 2 // Reduced for faster tests
        const MAX_DEPTH = 4

        for (let i = 0; i < NUM_POSITIONS; i++) {
            const battle = createRandomBattle()
            const result = await bestMove(battle, {
                maxDepth: MAX_DEPTH,
                verbose: true,
            })
            expect(result).toBeDefined()
            expect(result.choice).toBeDefined()
            expect(result.score).toBeDefined()
        }
    })

    test('Move Selection', async () => {
        const NUM_POSITIONS = 2
        const positions: Battle[] = []

        // Create test positions
        for (let i = 0; i < NUM_POSITIONS; i++) {
            const battle = createRandomBattle()
            positions.push(battle)
        }

        // Test each position
        for (const battle of positions) {
            const moves = getAvailableChoices(battle, 'p1')
            expect(moves.length).toBeGreaterThan(0)

            // Test different depths
            for (let depth = 1; depth <= 3; depth++) {
                const result = await bestMove(battle, {
                    maxDepth: depth,
                    verbose: false,
                })
                expect(result.choice).toBeDefined()
                expect(moves).toContain(result.choice)
            }
        }
    })
})
