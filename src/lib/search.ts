import type { Game } from '../types/game';

/** Return games whose titles contain the query, ignoring case and surrounding whitespace. */
export function filterGamesByTitle<T extends Pick<Game, 'title'>>(games: T[], query: string): T[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (normalizedQuery.length === 0) {
        return games;
    }

    return games.filter((game) => game.title.toLocaleLowerCase().includes(normalizedQuery));
}
