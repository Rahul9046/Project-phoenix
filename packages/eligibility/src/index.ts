/**
 * Who Eraya is for.
 *
 * One rule, in one place, because it is enforced in three: the website, the app
 * and the database. Three copies of "eighteen" drift, and the way you find out
 * they have drifted is somebody being told they are too young by one client and
 * accepted by another.
 *
 * Eraya is 18+ for everybody. There is no different age for men and women, and
 * no jurisdiction here gets a different number.
 */

/** The only age Eraya has a rule about. */
export const MINIMUM_AGE = 18;

/**
 * A floor on how old a birth date may claim to be.
 *
 * The database has a ceiling and no floor -- `profiles_date_of_birth_adult`
 * asks whether somebody is over 18 and says nothing about how far over. Without
 * this the picker accepted 1850 and the profile advertised an age nobody would
 * read as real.
 */
export const EARLIEST_BIRTH_DATE = "1930-01-01";

/**
 * A date as `yyyy-mm-dd`, from local calendar parts.
 *
 * Deliberately not `toISOString()`. That converts to UTC first, so east of
 * Greenwich a local midnight becomes the previous day -- in IST this moved the
 * boundary a day earlier and quietly turned away people whose eighteenth
 * birthday was that very day.
 */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The same date, `years` earlier, clamped to a day that exists.
 *
 * JavaScript rolls invalid dates forward: `new Date(2010, 1, 29)` is the first
 * of March, because 2010 had no twenty-ninth of February. Left alone that makes
 * the boundary a day too generous every leap year, admitting somebody born on
 * the first of March who is still seventeen.
 *
 * Postgres clamps instead -- `date '2028-02-29' - interval '18 years'` is the
 * twenty-eighth of February 2010 -- so clamping here is also what keeps the
 * clients and the constraint answering the same question.
 */
function yearsEarlier(date: Date, years: number): Date {
  const year = date.getFullYear() - years;
  const month = date.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDayOfMonth));
}

/**
 * The most recent date of birth that has already reached its eighteenth
 * birthday, as `yyyy-mm-dd`.
 *
 * Used for the picker's maximum and for the check on submit, so the control and
 * the validation cannot disagree about where the line is.
 */
export function latestEligibleBirthDate(today: Date = new Date()): string {
  return toIsoDate(yearsEarlier(today, MINIMUM_AGE));
}

/**
 * Whether a birth date belongs to somebody who has already turned 18.
 *
 * Note "already". Turning eighteen today counts; turning eighteen tomorrow does
 * not. This is a whole-date comparison and never `currentYear - birthYear`,
 * which calls a seventeen-year-old an adult for most of the year.
 *
 * `yyyy-mm-dd` strings compare correctly with `<=` because the format is
 * fixed-width and big-endian; no parsing is needed, and none is done.
 */
export function isOldEnough(
  dateOfBirth: string,
  today: Date = new Date(),
): boolean {
  return dateOfBirth <= latestEligibleBirthDate(today);
}

/** Whether a birth date is old enough and not implausibly old. */
export function isPlausibleBirthDate(
  dateOfBirth: string,
  today: Date = new Date(),
): boolean {
  return (
    dateOfBirth >= EARLIEST_BIRTH_DATE && isOldEnough(dateOfBirth, today)
  );
}
