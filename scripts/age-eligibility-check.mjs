/**
 * The 18+ rule, checked at its edges.
 *
 *   npm run age:check
 *
 * Eraya has no test runner, and the one rule in the product that decides whether
 * somebody is allowed to exist here is exactly the wrong rule to leave unchecked.
 * So this is a plain script: it imports the same module both clients import and
 * asks it about the days where the answer is easy to get wrong.
 *
 * Every case pins "today" explicitly. A check that used the real date would pass
 * for a year and then fail on a leap day with nobody watching, which is the
 * failure mode it exists to catch.
 *
 * The expected answers are also what Postgres gives for
 * `date_of_birth <= (today::date - interval '18 years')`, because the database
 * holds the same line and the two must not disagree. Postgres clamps the
 * twenty-ninth of February to the twenty-eighth; JavaScript rolls it forward to
 * the first of March unless stopped, which is what the leap cases below pin.
 */
import {
  MINIMUM_AGE,
  isOldEnough,
  latestEligibleBirthDate,
} from "../packages/eligibility/src/index.ts";

/** `yyyy-mm-dd` as a local Date, never UTC. */
const on = (iso) => new Date(`${iso}T00:00:00`);

const cases = [
  // [today, date of birth, allowed?, what it is]
  ["2026-09-13", "2008-09-13", true, "turns 18 today"],
  ["2026-09-13", "2008-09-14", false, "turns 18 tomorrow"],
  ["2026-09-13", "2008-09-12", true, "turned 18 yesterday"],
  ["2026-09-13", "2009-09-13", false, "17 exactly"],
  ["2026-09-13", "2009-12-31", false, "16"],
  ["2026-09-13", "2000-01-01", true, "26"],
  ["2026-09-13", "1950-06-30", true, "76"],

  // A birthday that does not occur every year. In a non-leap year the
  // eighteenth birthday falls on the first of March, matching Postgres.
  ["2026-02-27", "2008-02-29", false, "leap-day birth, two days before"],
  ["2026-02-28", "2008-02-29", false, "leap-day birth, on the 28th of a non-leap year"],
  ["2026-03-01", "2008-02-29", true, "leap-day birth, on the 1st of March"],
  ["2028-02-29", "2008-02-29", true, "leap-day birth, checked on a leap day, 20 years on"],

  // Checked on a leap day. JavaScript would roll 29 February back to 1 March
  // and admit somebody still seventeen; the module clamps to 28 February.
  ["2028-02-29", "2010-03-01", false, "turns 18 tomorrow, checked on a leap day"],
  ["2028-02-29", "2010-02-28", true, "turned 18 yesterday, checked on a leap day"],

  // Month-end, where a naive month copy also slips.
  ["2026-03-31", "2008-03-31", true, "turns 18 today, month end"],
  ["2026-01-01", "2008-01-02", false, "turns 18 tomorrow, across a year boundary"],
];

let passed = 0;
const failures = [];

for (const [today, dob, expected, what] of cases) {
  const actual = isOldEnough(dob, on(today));
  if (actual === expected) {
    passed += 1;
    console.log(
      `  PASS  on ${today}, born ${dob} -> ${actual ? "allowed" : "rejected"}  (${what})`,
    );
  } else {
    failures.push({ today, dob, expected, actual, what });
    console.log(
      `  FAIL  on ${today}, born ${dob} -> ${actual ? "allowed" : "rejected"}, expected ${expected ? "allowed" : "rejected"}  (${what})`,
    );
  }
}

// The boundary the pickers are given must be the same date the check uses.
const boundaryCases = [
  ["2026-09-13", "2008-09-13"],
  ["2028-02-29", "2010-02-28"],
  ["2026-03-01", "2008-03-01"],
];
for (const [today, expected] of boundaryCases) {
  const actual = latestEligibleBirthDate(on(today));
  if (actual === expected) {
    passed += 1;
    console.log(`  PASS  picker maximum on ${today} is ${actual}`);
  } else {
    failures.push({ today, expected, actual, what: "picker maximum" });
    console.log(`  FAIL  picker maximum on ${today} is ${actual}, expected ${expected}`);
  }
}

console.log(
  `\nminimum age ${MINIMUM_AGE} — ${passed} passed, ${failures.length} failed`,
);

if (failures.length > 0) process.exit(1);
