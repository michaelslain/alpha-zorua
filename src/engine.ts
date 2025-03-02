import { Battle, type ID } from '@pkmn/sim'
import { evaluatePosition } from './eval'
import type { TranspositionEntry, HistoryEntry } from './types'

interface ChoiceEvaluation {
    choice: string
    score: number
    type: 'move' | 'switch' | 'move+terastallize'
    details: string // move name, switch target, etc.
}

const MAX_DEPTH = 5

interface EngineOptions {
    verbose?: boolean
    maxDepth?: number
    signal?: AbortSignal
}

let typeEffectivenessCache: Record<string, number> = {}

// Add at top with other constants
const battleStateCache = new Map<string, Battle>()
const MAX_CACHE_SIZE = 1000

// Add near other constants
const transpositionTable = new Map<string, TranspositionEntry>()
const MAX_TABLE_SIZE = 100000 // Limit table size to prevent memory issues

// Add near other caches
const evalCache = new Map<string, number>()
const MAX_EVAL_CACHE = 10000

// Add near other constants
const historyTable = new Map<string, HistoryEntry>()
const MAX_HISTORY_SCORE = 1000000 // Prevent overflow

interface SearchThread {
    id: number
    alpha: number // Each thread gets different alpha-beta bounds
    beta: number
}

const NUM_THREADS = 4 // Or number of CPU cores

function getTypeEffectiveness(
    moveType: string,
    defenderTypes: string[],
    dex: any
): number {
    const key = `${moveType}:${defenderTypes.join(',')}`
    if (!(key in typeEffectivenessCache)) {
        typeEffectivenessCache[key] = dex.getEffectiveness(
            moveType,
            defenderTypes
        )
    }
    return typeEffectivenessCache[key]
}

export function getAvailableChoices(
    battle: Battle,
    playerId: 'p1' | 'p2'
): string[] {
    const choices: string[] = []
    const active = battle[playerId].active[0]
    if (!active) return ['pass']

    // Add available moves
    const moveData = active.getMoveRequestData()?.moves || []
    for (const move of moveData) {
        choices.push(`move ${move.id}`)
        // Add terastallize option if available
        if (active.canTerastallize) {
            choices.push(`move ${move.id} terastallize`)
        }
    }

    // Add switch options
    const pokemon = battle[playerId].pokemon
    for (let i = 1; i < pokemon.length; i++) {
        if (!pokemon[i].fainted && pokemon[i] !== active) {
            choices.push(`switch ${i + 1}`)
        }
    }

    return choices.length ? choices : ['pass']
}

function createSimBattle(battle: Battle): Battle {
    const formatId = battle.format.id.toLowerCase() as ID
    const simBattle = new Battle({ formatid: formatId })
    simBattle.setPlayer('p1', { team: battle.p1.team })
    simBattle.setPlayer('p2', { team: battle.p2.team })
    return simBattle
}

function getBattleState(battle: Battle): Battle {
    const key = getBattleStateKey(battle)
    const cached = battleStateCache.get(key)

    if (cached) {
        return createSimBattle(cached)
    }

    const newState = createSimBattle(battle)
    if (battleStateCache.size < MAX_CACHE_SIZE) {
        battleStateCache.set(key, newState)
    }
    return createSimBattle(newState)
}

function getBattleStateKey(battle: Battle): string {
    // Simpler key that only looks at essential state
    const p1State = battle.p1.pokemon
        .map(
            p =>
                `${p.species.name}:${Math.floor((p.hp / p.maxhp) * 100)}:${
                    p.status
                }`
        )
        .join('|')
    const p2State = battle.p2.pokemon
        .map(
            p =>
                `${p.species.name}:${Math.floor((p.hp / p.maxhp) * 100)}:${
                    p.status
                }`
        )
        .join('|')

    return `${p1State}||${p2State}`
}

function updateHistory(move: string, depth: number, success: boolean) {
    const entry = historyTable.get(move) || { score: 0, depth: 0 }

    // Increase score more for successful moves at deeper depths
    const change = success ? Math.pow(2, depth) : -Math.pow(2, depth)
    entry.score = Math.min(
        MAX_HISTORY_SCORE,
        Math.max(-MAX_HISTORY_SCORE, entry.score + change)
    )
    entry.depth = Math.max(entry.depth, depth)

    historyTable.set(move, entry)
}

function orderMoves(
    battle: Battle,
    choices: string[],
    playerId: 'p1' | 'p2'
): string[] {
    const active = battle[playerId].active[0]
    if (!active) return choices

    const moveScores = choices.map(choice => {
        let score = 0

        // Add history score bonus
        const history = historyTable.get(choice)
        if (history) {
            score += history.score
        }

        // Switches are generally good options
        if (choice.startsWith('switch')) {
            const targetIndex = parseInt(choice.split(' ')[1]) - 1
            const switchTarget = battle[playerId].pokemon[targetIndex]

            let score = (switchTarget.hp / switchTarget.maxhp) * 100

            // Bonus for switching to counter opponent's type
            const opponent = battle[playerId === 'p1' ? 'p2' : 'p1'].active[0]
            if (opponent) {
                for (const oppType of opponent.types) {
                    for (const myType of switchTarget.types) {
                        const effectiveness = getTypeEffectiveness(
                            oppType,
                            [myType],
                            battle.dex
                        )
                        if (effectiveness < 0) {
                            // If resistant
                            score += 20
                        }
                    }
                }
            }

            return score
        }

        // Score moves
        if (choice.startsWith('move')) {
            const moveName = choice.split(' ')[1] as ID
            const moveData = active.moveSlots.find(m => m.id === moveName)
            if (!moveData) return 0

            const move = battle.dex.moves.get(moveName)
            score = move.basePower || 0

            // Status moves get base score
            if (move.category === 'Status') {
                score = 60 // Base value for status moves

                // Boost priority for certain status moves
                if (move.boosts || move.heal || move.sideCondition) {
                    score += 20
                }
            }

            // Type effectiveness
            const opponent = battle[playerId === 'p1' ? 'p2' : 'p1'].active[0]
            if (opponent) {
                const effectiveness = getTypeEffectiveness(
                    move.type,
                    opponent.types,
                    battle.dex
                )
                score *= Math.pow(2, effectiveness)
            }

            // STAB bonus
            if (active.types.includes(move.type)) {
                score *= 1.5
            }

            // Terastallize bonus
            if (choice.includes('terastallize')) {
                score *= 1.3
            }

            // Priority moves get bonus
            if (move.priority > 0) {
                score *= 1.2
            }

            return score
        }

        return score
    })

    return choices
        .map((choice, i) => ({ choice, score: moveScores[i] }))
        .sort((a, b) => b.score - a.score)
        .map(x => x.choice)
}

// Add helper to clear all caches
function clearCaches() {
    // Clear object contents instead of reassigning
    Object.keys(typeEffectivenessCache).forEach(key => {
        delete typeEffectivenessCache[key]
    })
    battleStateCache.clear()
    transpositionTable.clear()
    evalCache.clear()
    historyTable.clear()
}

export async function bestMove(
    battle: Battle,
    options: EngineOptions = {}
): Promise<ChoiceEvaluation> {
    const { verbose = true, maxDepth = MAX_DEPTH, signal } = options
    let bestEval: ChoiceEvaluation | null = null
    const startTime = performance.now()

    for (let depth = 1; depth <= maxDepth; depth++) {
        if (signal?.aborted) break

        try {
            clearCaches() // Clear caches before each depth
            bestEval = await minimaxRoot(battle, depth, -Infinity, Infinity, 0)

            if (verbose) {
                const elapsed = performance.now() - startTime
                console.log(
                    `Depth ${depth} completed in ${elapsed.toFixed(2)}ms: ${
                        bestEval.choice
                    } (score: ${bestEval.score})`
                )
            }

            if (performance.now() - startTime > 20000) break
        } catch (e) {
            break
        }
    }

    return bestEval || (await minimaxRoot(battle, 1, -Infinity, Infinity, 0))
}

async function minimax(
    battle: Battle,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    signal?: AbortSignal
): Promise<number> {
    if (signal?.aborted) {
        throw new Error('Computation aborted')
    }

    const posKey = getPositionKey(battle)
    const ttEntry = transpositionTable.get(posKey)

    if (ttEntry && ttEntry.depth >= depth) {
        if (ttEntry.type === 'exact') {
            return ttEntry.score
        }
        if (ttEntry.type === 'lowerbound' && ttEntry.score > alpha) {
            alpha = ttEntry.score
        }
        if (ttEntry.type === 'upperbound' && ttEntry.score < beta) {
            beta = ttEntry.score
        }
        if (alpha >= beta) {
            return ttEntry.score
        }
    }

    if (depth === 0 || battle.ended) {
        const evaluation = await evaluatePosition(battle, 'p1')
        // Don't negate - scores are already from p1's perspective
        return evaluation.score
    }

    if (isMaximizing) {
        let maxScore = -Infinity
        const choices = getAvailableChoices(battle, 'p1')
        const orderedChoices = orderMoves(battle, choices, 'p1')

        for (const choice of orderedChoices) {
            const simBattle = getBattleState(battle)
            simBattle.choose('p1', choice)
            const opponentChoices = getAvailableChoices(simBattle, 'p2')
            simBattle.choose('p2', opponentChoices[0])
            simBattle.makeChoices()

            const score = await minimax(
                simBattle,
                depth - 1,
                alpha,
                beta,
                false,
                signal
            )

            // Update history based on if move improved alpha
            const improved = score > alpha
            updateHistory(choice, depth, improved)

            maxScore = Math.max(maxScore, score)
            alpha = Math.max(alpha, score)

            if (beta <= alpha) {
                break
            }
        }

        // Store the result in the transposition table
        if (transpositionTable.size < MAX_TABLE_SIZE) {
            const type =
                maxScore <= alpha
                    ? 'upperbound'
                    : maxScore >= beta
                    ? 'lowerbound'
                    : 'exact'
            transpositionTable.set(posKey, { score: maxScore, depth, type })
        }

        return maxScore
    } else {
        let minScore = Infinity
        const choices = getAvailableChoices(battle, 'p2')
        const orderedChoices = orderMoves(battle, choices, 'p2')

        for (const choice of orderedChoices) {
            const simBattle = getBattleState(battle)
            simBattle.choose('p2', choice)
            const playerChoices = getAvailableChoices(simBattle, 'p1')
            simBattle.choose('p1', playerChoices[0]) // Just take first response for now
            simBattle.makeChoices()

            const score = await minimax(
                simBattle,
                depth - 1,
                alpha,
                beta,
                true,
                signal
            )

            // Update history based on if move improved alpha
            const improved = score < beta
            updateHistory(choice, depth, improved)

            minScore = Math.min(minScore, -score) // Negate here for p2's perspective
            beta = Math.min(beta, -score) // And here

            if (beta <= alpha) {
                break // Alpha cutoff
            }
        }

        // Store the result in the transposition table
        if (transpositionTable.size < MAX_TABLE_SIZE) {
            const type =
                minScore <= alpha
                    ? 'upperbound'
                    : minScore >= beta
                    ? 'lowerbound'
                    : 'exact'
            transpositionTable.set(posKey, { score: -minScore, depth, type })
        }

        return -minScore // And here
    }
}

function getPositionKey(battle: Battle): string {
    // Simpler key that matches battle state key
    const p1State = battle.p1.pokemon
        .map(
            p =>
                `${p.species.name}:${Math.floor((p.hp / p.maxhp) * 100)}:${
                    p.status
                }`
        )
        .join('|')
    const p2State = battle.p2.pokemon
        .map(
            p =>
                `${p.species.name}:${Math.floor((p.hp / p.maxhp) * 100)}:${
                    p.status
                }`
        )
        .join('|')

    return `${p1State}||${p2State}`
}

// Add helper function
function getCachedEval(battle: Battle): number | undefined {
    const key = getPositionKey(battle)
    return evalCache.get(key)
}

async function minimaxRoot(
    battle: Battle,
    depth: number = MAX_DEPTH,
    alpha: number = -Infinity,
    beta: number = Infinity,
    threadId: number
): Promise<ChoiceEvaluation> {
    const choices = getAvailableChoices(battle, 'p1')
    if (choices.length === 1) {
        return {
            choice: choices[0],
            score: 0,
            type: choices[0].startsWith('move') ? 'move' : 'switch',
            details: choices[0],
        }
    }

    let bestChoice: ChoiceEvaluation | null = null
    const orderedChoices = orderMoves(battle, choices, 'p1')

    for (const choice of orderedChoices) {
        const simBattle = getBattleState(battle)
        simBattle.choose('p1', choice)
        const opponentChoices = getAvailableChoices(simBattle, 'p2')
        simBattle.choose('p2', opponentChoices[0])
        simBattle.makeChoices()

        const score = await minimax(simBattle, depth - 1, alpha, beta, false)

        if (!bestChoice || score > bestChoice.score) {
            bestChoice = {
                choice,
                score,
                type: choice.includes('terastallize')
                    ? 'move+terastallize'
                    : choice.startsWith('move')
                    ? 'move'
                    : 'switch',
                details: choice,
            }
            alpha = Math.max(alpha, score)
        }

        if (beta <= alpha) break
    }

    return bestChoice!
}
