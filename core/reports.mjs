export function summaryQuery(db, start, end, accountId = null) {
  return db.prepare(`SELECT a.id, a.name, a.login, COUNT(v.id) AS count, MAX(v.moment) AS latest
    FROM accounts a LEFT JOIN visits v ON v.account = a.id AND v.moment >= ? AND v.moment < ?
    WHERE (? IS NULL OR a.id = ?) GROUP BY a.id ORDER BY count DESC, a.id`).bind(start, end, accountId, accountId);
}

export function historyQuery(db, start, end, accountId) {
  return db.prepare(`SELECT moment FROM visits WHERE account = ? AND moment >= ? AND moment < ?
    ORDER BY moment DESC, id DESC`).bind(accountId, start, end);
}

export function timeRange(start, end) {
  if (![start, end].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000) || start >= end) {
    throw new Error("Проверьте даты начала и окончания периода.");
  }
  return [start, end];
}
