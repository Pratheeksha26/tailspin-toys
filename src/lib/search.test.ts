import { describe, expect, it } from 'vitest';
import type { Game } from '../types/game';
import { filterGamesByTitle } from './search';

const games: Game[] = [
    {
        id: 1,
        title: 'DevOps Dominion',
        description: 'Strategy game',
        publisher: null,
        category: null,
        starRating: 4,
    },
    {
        id: 2,
        title: 'Pipeline Conquest',
        description: 'Strategy game',
        publisher: null,
        category: null,
        starRating: 4,
    },
];

describe('filterGamesByTitle', () => {
    it('matches titles case-insensitively', () => {
        expect(filterGamesByTitle(games, 'devops').map((game) => game.title)).toEqual(['DevOps Dominion']);
    });

    it('ignores surrounding whitespace', () => {
        expect(filterGamesByTitle(games, '  pipeline  ')).toEqual([games[1]]);
    });

    it('returns no games when the query has no matches', () => {
        expect(filterGamesByTitle(games, 'missing')).toEqual([]);
    });

    it('returns all games for an empty query', () => {
        expect(filterGamesByTitle(games, '   ')).toEqual(games);
    });
});
