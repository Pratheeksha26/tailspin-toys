import type { Game } from '../types/game';

/** Return games whose titles contain the query, ignoring case and surrounding whitespace. */
export function filterGamesByTitle<T extends Pick<Game, 'title'>>(games: T[], query: string): T[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (normalizedQuery.length === 0) {
        return games;
    }

    return games.filter((game) => game.title.toLocaleLowerCase().includes(normalizedQuery));
}

export type GameSort = 'title-asc' | 'title-desc' | 'rating-desc';

/** Sort games by title or rating, placing unrated games after rated games. */
export function sortGames<T extends Pick<Game, 'title' | 'starRating'>>(games: T[], sort: GameSort): T[] {
    return [...games].sort((left, right) => {
        if (sort === 'rating-desc') {
            if (left.starRating === null && right.starRating === null) return left.title.localeCompare(right.title);
            if (left.starRating === null) return 1;
            if (right.starRating === null) return -1;
            return right.starRating - left.starRating || left.title.localeCompare(right.title);
        }

        const titleOrder = left.title.localeCompare(right.title);
        return sort === 'title-desc' ? -titleOrder : titleOrder;
    });
}
