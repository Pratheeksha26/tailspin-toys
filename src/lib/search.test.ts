import { describe, expect, it } from 'vitest';
import type { Game } from '../types/game';
import { filterGamesByTitle, sortGames } from './search';

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

    describe('sortGames', () => {
        it('sorts titles in ascending and descending order', () => {
            expect(sortGames(games, 'title-asc').map((game) => game.title)).toEqual(['DevOps Dominion', 'Pipeline Conquest']);
            expect(sortGames(games, 'title-desc').map((game) => game.title)).toEqual(['Pipeline Conquest', 'DevOps Dominion']);
        });

        it('sorts ratings highest first and places unrated games last', () => {
            const ratedGames = [...games, { ...games[0], id: 3, title: 'Unrated', starRating: null }];
            expect(sortGames(ratedGames, 'rating-desc').map((game) => game.title)).toEqual([
                'DevOps Dominion',
                'Pipeline Conquest',
                'Unrated',
            ]);
        });
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
