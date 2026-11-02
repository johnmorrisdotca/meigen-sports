import assert from "node:assert/strict";
import test from "node:test";
import { japaneseHoliday, japaneseHolidaysOf, oldCalendarDate, rokuyoOf, ROKUYO } from "../src/japaneseCalendar.ts";

const names = (year: number): string[] => [...(japaneseHolidaysOf(year) ?? [])].map(([date, name]) => `${date.slice(5)} ${name.ja}`).sort();

test("equinox days follow the Observatory's formula, 2020 to 2030", () => {
  const vernal = [20, 20, 21, 21, 20, 20, 20, 21, 20, 20, 20];
  const autumnal = [22, 23, 23, 23, 22, 23, 23, 23, 22, 23, 23];
  vernal.forEach((d, i) => assert.equal(japaneseHoliday(2020 + i, 3, d)?.ja, "春分の日", `${2020 + i}-03-${d}`));
  autumnal.forEach((d, i) => assert.equal(japaneseHoliday(2020 + i, 9, d)?.ja, "秋分の日", `${2020 + i}-09-${d}`));
});

test("the holidays of 2019 to 2026 are the Cabinet Office's lists, with the moves and the substitutes", () => {
  assert.deepEqual(names(2019), ["01-01 元日", "01-14 成人の日", "02-11 建国記念の日", "03-21 春分の日", "04-29 昭和の日", "04-30 国民の休日", "05-01 天皇の即位の日", "05-02 国民の休日",
    "05-03 憲法記念日", "05-04 みどりの日", "05-05 こどもの日", "05-06 振替休日", "07-15 海の日", "08-11 山の日", "08-12 振替休日", "09-16 敬老の日", "09-23 秋分の日",
    "10-14 体育の日", "10-22 即位礼正殿の儀の行われる日", "11-03 文化の日", "11-04 振替休日", "11-23 勤労感謝の日"].sort());
  assert.deepEqual(names(2020), ["01-01 元日", "01-13 成人の日", "02-11 建国記念の日", "02-23 天皇誕生日", "02-24 振替休日", "03-20 春分の日", "04-29 昭和の日", "05-03 憲法記念日", "05-04 みどりの日",
    "05-05 こどもの日", "05-06 振替休日", "07-23 海の日", "07-24 スポーツの日", "08-10 山の日", "09-21 敬老の日", "09-22 秋分の日", "11-03 文化の日", "11-23 勤労感謝の日"].sort());
  assert.deepEqual(names(2021), ["01-01 元日", "01-11 成人の日", "02-11 建国記念の日", "02-23 天皇誕生日", "03-20 春分の日", "04-29 昭和の日", "05-03 憲法記念日", "05-04 みどりの日", "05-05 こどもの日",
    "07-22 海の日", "07-23 スポーツの日", "08-08 山の日", "08-09 振替休日", "09-20 敬老の日", "09-23 秋分の日", "11-03 文化の日", "11-23 勤労感謝の日"].sort());
  assert.deepEqual(names(2024), ["01-01 元日", "01-08 成人の日", "02-11 建国記念の日", "02-12 振替休日", "02-23 天皇誕生日", "03-20 春分の日", "04-29 昭和の日", "05-03 憲法記念日", "05-04 みどりの日",
    "05-05 こどもの日", "05-06 振替休日", "07-15 海の日", "08-11 山の日", "08-12 振替休日", "09-16 敬老の日", "09-22 秋分の日", "09-23 振替休日", "10-14 スポーツの日", "11-03 文化の日",
    "11-04 振替休日", "11-23 勤労感謝の日"].sort());
  assert.deepEqual(names(2025), ["01-01 元日", "01-13 成人の日", "02-11 建国記念の日", "02-23 天皇誕生日", "02-24 振替休日", "03-20 春分の日", "04-29 昭和の日", "05-03 憲法記念日", "05-04 みどりの日",
    "05-05 こどもの日", "05-06 振替休日", "07-21 海の日", "08-11 山の日", "09-15 敬老の日", "09-23 秋分の日", "10-13 スポーツの日", "11-03 文化の日", "11-23 勤労感謝の日", "11-24 振替休日"].sort());
  assert.deepEqual(names(2026), ["01-01 元日", "01-12 成人の日", "02-11 建国記念の日", "02-23 天皇誕生日", "03-20 春分の日", "04-29 昭和の日", "05-03 憲法記念日", "05-04 みどりの日", "05-05 こどもの日",
    "05-06 振替休日", "07-20 海の日", "08-11 山の日", "09-21 敬老の日", "09-22 国民の休日", "09-23 秋分の日", "10-12 スポーツの日", "11-03 文化の日", "11-23 勤労感謝の日"].sort());
});

test("a holiday is named in English as well, and a year the rules do not cover has none", () => {
  assert.equal(japaneseHoliday(2026, 1, 1)?.en, "New Year's Day");
  assert.equal(japaneseHoliday(2026, 9, 22)?.en, "Citizens' Holiday");
  assert.equal(japaneseHoliday(2026, 1, 2), null);
  assert.equal(japaneseHolidaysOf(1999), null);
  assert.equal(japaneseHolidaysOf(2100), null);
  assert.equal(japaneseHoliday(1999, 1, 1), null);
});

test("the Happy Monday and the Sunday rules before 2007: 2000 to 2006", () => {
  assert.equal(japaneseHoliday(2000, 1, 10)?.ja, "成人の日");
  assert.equal(japaneseHoliday(2002, 7, 20)?.ja, "海の日");
  assert.equal(japaneseHoliday(2003, 7, 21)?.ja, "海の日");
  assert.equal(japaneseHoliday(2006, 5, 4)?.ja, "国民の休日");
  assert.equal(japaneseHoliday(2006, 4, 29)?.ja, "みどりの日");
  assert.equal(japaneseHoliday(2007, 5, 4)?.ja, "みどりの日");
  assert.equal(japaneseHoliday(2007, 4, 29)?.ja, "昭和の日");
});

test("the old calendar's new year and leap months match the published tables", () => {
  const newYear: [number, number, number][] = [[2020, 1, 25], [2021, 2, 12], [2022, 2, 1], [2023, 1, 22], [2024, 2, 10], [2025, 1, 29], [2026, 2, 17], [2029, 2, 13], [2030, 2, 3], [2000, 2, 5]];
  for (const [y, m, d] of newYear) {
    assert.deepEqual(oldCalendarDate(y, m, d), { month: 1, day: 1, leap: false }, `${y}-${m}-${d}`);
    const before = new Date(Date.UTC(y, m - 1, d - 1));
    const eve = oldCalendarDate(before.getUTCFullYear(), before.getUTCMonth() + 1, before.getUTCDate());
    assert.equal(eve?.month, 12, `${y}-${m}-${d - 1}`);
  }
  // The leap months: 2020 (4th), 2023 (2nd), 2025 (6th).
  assert.deepEqual(oldCalendarDate(2020, 5, 23), { month: 4, day: 1, leap: true });
  assert.deepEqual(oldCalendarDate(2023, 3, 22), { month: 2, day: 1, leap: true });
  assert.deepEqual(oldCalendarDate(2025, 7, 25), { month: 6, day: 1, leap: true });
  assert.deepEqual(oldCalendarDate(2025, 7, 24), { month: 6, day: 30, leap: false });
  // The seventh day of the seventh month (Tanabata of the old calendar).
  assert.deepEqual(oldCalendarDate(2023, 8, 22), { month: 7, day: 7, leap: false });
  assert.deepEqual(oldCalendarDate(2024, 8, 10), { month: 7, day: 7, leap: false });
  assert.deepEqual(oldCalendarDate(2025, 8, 29), { month: 7, day: 7, leap: false });
  assert.deepEqual(oldCalendarDate(2026, 8, 19), { month: 7, day: 7, leap: false });
  assert.deepEqual(oldCalendarDate(2000, 1, 1), { month: 11, day: 25, leap: false });
});

test("a new moon within half an hour of midnight in Japan leaves the date empty, not guessed", () => {
  // The new moon of 2028-01-26 is at 15:12 UTC, 00:12 on the 27th in Japan (it was the 26th in China).
  assert.equal(oldCalendarDate(2028, 1, 26), null);
  assert.equal(oldCalendarDate(2028, 1, 27), null);
  assert.equal(oldCalendarDate(2028, 1, 25)?.month, 12);
  assert.equal(oldCalendarDate(1899, 12, 31), null);
  assert.equal(oldCalendarDate(2101, 1, 1), null);
  assert.equal(oldCalendarDate(2026, 2, 30), null);
});

test("over two centuries the new year falls between 21 January and 20 February and about seven years in nineteen have a leap month", () => {
  let leapYears = 0;
  let years = 0;
  for (let year = 1901; year <= 2099; year += 1) {
    let leap = false;
    let found: [number, number] | null = null;
    for (let day = 1; day <= 59; day += 1) {
      const date = new Date(Date.UTC(year, 0, day));
      const old = oldCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      if (old && old.month === 1 && old.day === 1 && !old.leap) { found = [date.getUTCMonth() + 1, date.getUTCDate()]; break; }
    }
    if (found) {
      const index = found[0] * 100 + found[1];
      assert.ok(index >= 121 && index <= 221, `${year}: ${found}`);
    }
    for (let day = 1; day <= 366 && !leap; day += 5) {
      const date = new Date(Date.UTC(year, 0, day));
      const old = oldCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      if (old?.leap) leap = true;
    }
    years += 1;
    if (leap) leapYears += 1;
  }
  const rate = leapYears / years;
  assert.ok(rate > 0.31 && rate < 0.43, `${leapYears} of ${years} years show a leap month`);
});

test("rokuyō is (old month + old day) mod 6, the first of each month in order", () => {
  assert.deepEqual(ROKUYO.map((r) => r.ja), ["大安", "赤口", "先勝", "友引", "先負", "仏滅"]);
  assert.equal(rokuyoOf(2023, 1, 22)?.ja, "先勝");
  assert.equal(rokuyoOf(2023, 1, 21)?.ja, "大安");
  assert.equal(rokuyoOf(2025, 7, 25)?.ja, "赤口");
  assert.equal(rokuyoOf(2028, 1, 26), null);
  assert.equal(rokuyoOf(2023, 1, 23)?.reading, "Tomobiki");
});
