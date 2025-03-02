import { Battle, Pokemon, Side } from '@pkmn/sim'
import type { BattleEvaluation } from './types'

export async function evaluatePosition(
    battle: Battle,
    playerId: 'p1' | 'p2'
): Promise<BattleEvaluation> {
    const player = battle[playerId]
    const opponent = battle[playerId === 'p1' ? 'p2' : 'p1']

    // Calculate raw scores
    const playerScore = calculateScore(player)
    const opponentScore = calculateScore(opponent)

    // Simple difference, scaled to -100 to 100
    const normalizedScore = Math.max(
        Math.min((playerScore - opponentScore) / 5, 100),
        -100
    )

    return {
        score: normalizedScore,
        details: {
            p1: getDetails(battle.p1),
            p2: getDetails(battle.p2),
        },
    }
}

function calculateScore(side: Side): number {
    return side.pokemon.reduce((sum: number, mon: Pokemon) => {
        const hpScore = (mon.hp / mon.maxhp) * 100
        const faintedScore = mon.fainted ? 0 : 50
        return sum + hpScore + faintedScore
    }, 0)
}

function getDetails(side: Side) {
    return {
        hp: side.pokemon.reduce(
            (sum: number, mon: Pokemon) => sum + (mon.hp / mon.maxhp) * 100,
            0
        ),
        remainingPokemon: side.pokemon.filter((p: Pokemon) => !p.fainted)
            .length,
        activeHpPercent: side.active[0]?.hp
            ? (side.active[0].hp / side.active[0].maxhp) * 100
            : 0,
    }
}
