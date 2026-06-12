export function initial() {
  return "Always present"
}

/* QUERY_PARAM FIRST START */
export function first() {
  return "Removed when ?query=first"
}
/* QUERY_PARAM FIRST END */

/* QUERY_PARAM SECOND START */
export function second() {
  return "Removed when ?query=second"
}
/* QUERY_PARAM SECOND END */

export function uncovered() {
  return "Always present"
}
