import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

export function openDatabase(path) {
  const sql = new DatabaseSync(path);
  sql.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL");
  sql.exec("CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)");
  const directory = new URL("../migrations/",import.meta.url);
  for (const name of readdirSync(directory).filter(n=>n.endsWith(".sql")).sort()) {
    sql.exec("BEGIN IMMEDIATE");
    try {
      if(!sql.prepare("SELECT name FROM migrations WHERE name=?").get(name)) {
        sql.exec(readFileSync(new URL(name,directory),"utf8"));
        sql.prepare("INSERT INTO migrations(name) VALUES(?)").run(name);
      }
      sql.exec("COMMIT");
    } catch(err){sql.exec("ROLLBACK");throw err;}
  }
  function query(statement, values=[]) {
    return {
      bind: (...args)=>query(statement,args),
      first: ()=>statement.get(...values),
      all: ()=>({results:statement.all(...values)}),
      run: ()=>statement.run(...values),
    };
  }
  return {
    prepare: source=>query(sql.prepare(source)),
    batch(statements) {
      sql.exec("BEGIN IMMEDIATE");
      try {const result=statements.map(st=>st.run());sql.exec("COMMIT");return result;}
      catch(err){sql.exec("ROLLBACK");throw err;}
    },
    close: ()=>sql.close(),
  };
}
