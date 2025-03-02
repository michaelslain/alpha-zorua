import { Battle } from '@pkmn/sim'
import type { ID } from '@pkmn/sim'
import { Teams } from '@pkmn/sim'
import { TeamGenerators } from '@pkmn/randoms'

// Set up the team generator factory
Teams.setGeneratorFactory(TeamGenerators)

export function createRandomBattle(): Battle {
    const battle = new Battle({ formatid: 'gen9randombattle' as ID })

    battle.setPlayer('p1', { team: Teams.generate('gen9randombattle') })
    battle.setPlayer('p2', { team: Teams.generate('gen9randombattle') })

    return battle
}

export function makeRandomMove(battle: Battle, playerId: 'p1' | 'p2'): void {
    const player = battle[playerId]
    const active = player.active[0]
    if (!active) {
        battle.choose(playerId, 'pass')
        return
    }

    // Get all possible choices
    const choices: string[] = []

    // Add moves (and terastallize options)
    const moveData = active.getMoveRequestData()?.moves || []
    for (const move of moveData) {
        choices.push(`move ${move.id}`)
        if (active.canTerastallize) {
            choices.push(`move ${move.id} terastallize`)
        }
    }

    // Add switch options
    const pokemon = player.pokemon
    for (let i = 1; i < pokemon.length; i++) {
        if (!pokemon[i].fainted && pokemon[i] !== active) {
            choices.push(`switch ${i + 1}`)
        }
    }

    // Make random choice
    const randomChoice =
        choices[Math.floor(Math.random() * choices.length)] || 'pass'
    battle.choose(playerId, randomChoice)
}
