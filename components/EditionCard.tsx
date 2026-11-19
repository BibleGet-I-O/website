/** The lowercase path segment for an edition: /read/drb. Kept out of the client BookCover so server pages can call it. */
export const editionSlug = (sigla: string) => sigla.toLowerCase();
