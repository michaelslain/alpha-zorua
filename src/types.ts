export interface ChoiceEvaluation {
    choice: string
    score: number
    type: 'move' | 'switch' | 'move+terastallize'
    details: string
}

export interface EngineOptions {
    verbose?: boolean
    maxDepth?: number
    signal?: AbortSignal
}

export interface BattleEvaluation {
    score: number
    details: {
        p1: {
            hp: number
            remainingPokemon: number
            activeHpPercent: number
        }
        p2: {
            hp: number
            remainingPokemon: number
            activeHpPercent: number
        }
    }
}

export interface TranspositionEntry {
    score: number
    depth: number
    type: 'exact' | 'upperbound' | 'lowerbound'
}

export interface HistoryEntry {
    score: number
    depth: number
}
