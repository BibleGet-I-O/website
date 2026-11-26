# Test fixtures

`editions.json`: each Bible edition the API serves (sigla) with the universal numbers of the books it has. No text.
The docs test `docs-reader-links.test.ts` checks every `<ReaderLink>` in `content/docs` against it, so a link to an
edition or book the site lacks fails the test run. Refresh it when an edition is added or its books change, from the
endpoint's database (DIVCOM, which is not a Bible, is left out):

```sql
SELECT sigla, (SELECT json_agg(b ORDER BY b) FROM (SELECT DISTINCT book b FROM "<SIGLA>") x) FROM versions_available;
```
