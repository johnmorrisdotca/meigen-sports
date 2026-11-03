#!/usr/bin/env python3
"""The milestone lists' parsers, on short samples written in the articles' own wikitext shape, with no network: python3 -I pipeline/test_milestones.py"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_milestones as m  # noqa: E402

FIVE = """Intro text with a link to <ref name="x">{{cite web|url=https://www.espn.com/nhl/x|title=a|publisher=ESPN}}</ref> a reference.
{| class="wikitable sortable" style="text-align: left;"
|-
!Name!!Team!!Date!!Goals
|- style="background:#cfccef;"
|{{flagicon|CAN|1868}} {{sortname|Joe|Malone}}
|[[Montreal Canadiens]]||align="right"|{{dts|1917|12|19}}|| style="text-align:center;"|5
|- style="background:#efffbf;"
|{{flagicon|CAN|1921}} {{Sortname|Maurice|Richard}}<ref name="p"/>
|[[Montreal Canadiens]]||align="right"|{{dts|1944|03|23}}|| style="text-align:center;"|5
|-
|{{flagicon|CAN}} {{sortname|Ian|Turnbull|dab=ice hockey}} (D)
|[[Toronto Maple Leafs]]||align="right"|{{dts|1977|02|02}}|| style="text-align:center;"|5<ref>{{Cite news|url=https://example.org|title=t}}</ref>
|-
|{{flagicon|CAN}} {{sortname|Mark|Mulvey}}
|[[Chicago Blackhawks|Chicago Black Hawks]]||align="right"|{{dts|1982|02|03}}|| style="text-align:center;"|4
|-
|{{flagicon|CAN}} {{sortname|Joe|Malone}}
|[[Quebec Bulldogs]]||align="right"|{{dts|1920|01|31}}|| style="text-align:center;"|7
|}
"""

CAREER = """{|class="wikitable sortable"
! Rank
! colspan="2" |Player
! Goals
|-
|1
| data-sort-value="" | {{flagicon|Russia}}
| style="background:#cfecec" | {{sortname|Alexander|Ovechkin}}
| 929<!--- Update at the end of the season --->
| 1,573
| {{dts|2016|1|10}}
| [[Washington Capitals]]
| 801
| {{sortname|Andrew|Hammond|Andrew Hammond (ice hockey)}} ([[Ottawa Senators|Senators]])
| Active
| <ref>{{cite web |url=https://www.nhl.com/x |title=x}}</ref>
|-
| 2
| data-sort-value="" | {{flagicon|Canada}}
| {{sortname|Wayne|Gretzky}}
| 894
| 1,487
| {{dts|1986|11|22}}
| [[Edmonton Oilers]]
| 575
| (empty [[Vancouver Canucks|Canucks]] net)
| 1999
|-
| 4
| {{flagicon|CZE}}
| {{sortname|Jaromir|Jagr|Jaromír Jágr}}
| 766
| 1,711
| {{dts|2012|3|1}}
| [[Pittsburgh Penguins]]
| 1,107
| {{sortname|Mark|Fitzpatrick}} ([[New York Islanders|Islanders]])
| 2026
|}

{| class="wikitable sortable plainrowheaders"
|+Players with 500th NHL goal in the 2025–26 NHL season
|-
! Order
| style="text-align:center;" |49
| {{flagicon|CAN}}
| {{sortname|John|Tavares}}
| [[Toronto Maple Leafs]]
| style="text-align:center;" | 1,149<ref>{{cite web |url=https://www.nhl.com/news/x |title=x}}</ref>
| {{dts|2025|October|29|format=mdy}}
| | {{sortname|Elvis|Merzlikins}} ([[Columbus Blue Jackets|Blue Jackets]])
|}
"""

POINTS = """{| class="wikitable sortable"
|-
!Rank
!Points
!Player
!Date
!Team
!Opponent
!Score
|-
|1
|[[Wilt Chamberlain's 100-point game|100]]
|style="background-color:#FFFF99"|{{sortname|Wilt|Chamberlain}}*
|{{dts|1962|03|02}}
|[[1961–62 Philadelphia Warriors season|Philadelphia Warriors]]
|[[1961–62 New York Knicks season|New York Knicks]]
|169–147
|{{hidden||A note with a bar}}
|-
|4
|78
|style="background-color:#FFFF99"|{{sortname|Wilt|Chamberlain}}* (2)
|{{dts|1961|12|08}}
|[[1961–62 Philadelphia Warriors season|Philadelphia Warriors]]
|[[1961–62 Los Angeles Lakers season|Los Angeles Lakers]]
|style="background-color:#ffbbbb"|147–151
|-
|{{sortname|David|Thompson|David Thompson (basketball)}}*
|{{dts|1978|04|09}}
|[[1977–78 Denver Nuggets season|Denver Nuggets]]
|[[1977–78 Detroit Pistons season|Detroit Pistons]]
|137–139
|-
|5
|69
|{{sortname|Michael|Jordan}}*
|{{dts|1990|03|28}}
|[[1989–90 Chicago Bulls season|Chicago Bulls]]
|[[1989–90 Cleveland Cavaliers season|Cleveland Cavaliers]]
|117–113
|}
"""


class Pieces(unittest.TestCase):
    def test_refs_and_comments_go_before_anything_is_read(self):
        text = m.strip_noise('a<!-- c -->b<ref name="x">http://espn.com</ref>c<ref name="y"/>d')
        self.assertEqual(text, "abcd")

    def test_dates(self):
        self.assertEqual(m.date_of("{{dts|1917|12|19}}"), "1917-12-19")
        self.assertEqual(m.date_of("{{dts|2016|1|10}}"), "2016-01-10")
        self.assertEqual(m.date_of("{{dts|2025|October|29|format=mdy}}"), "2025-10-29")
        self.assertIsNone(m.date_of("{{dts|2025|Smarch|29}}"))
        self.assertIsNone(m.date_of("no date"))

    def test_names(self):
        self.assertEqual(m.name_of("{{sortname|Joe|Malone}}"), "Joe Malone")
        self.assertEqual(m.name_of("{{Sortname|Sergei|Fedorov}}"), "Sergei Fedorov")
        self.assertEqual(m.name_of("{{sortname|Ian|Turnbull|dab=ice hockey}} (D)"), "Ian Turnbull")
        self.assertEqual(m.name_of("{{sortname|Jaromir|Jagr|Jaromír Jágr}}"), "Jaromír Jágr")
        self.assertEqual(m.name_of("{{sortname|David|Thompson|David Thompson (basketball)}}*"), "David Thompson")

    def test_links_and_numbers(self):
        self.assertEqual(m.link_text("[[Chicago Blackhawks|Chicago Black Hawks]]"), "Chicago Black Hawks")
        self.assertEqual(m.link_text("[[Montreal Canadiens]]"), "Montreal Canadiens")
        self.assertEqual(m.number_of("[[Wilt Chamberlain's 100-point game|100]]"), 100)
        self.assertEqual(m.number_of("1,149"), 1149)


class Lists(unittest.TestCase):
    def test_five_goals(self):
        rows = m.five_goal_games(FIVE)
        self.assertEqual([(r["player"], r["date"], r["amount"], r["playoffs"]) for r in rows], [
            ("Joe Malone", "1917-12-19", 5, False), ("Maurice Richard", "1944-03-23", 5, True), ("Ian Turnbull", "1977-02-02", 5, False), ("Joe Malone", "1920-01-31", 7, False)])
        self.assertEqual({r["amount"] for r in rows}, {5, 7}, "a four-goal row is never published")

    def test_nth_counts_the_whole_list(self):
        rows = m.with_counts(m.five_goal_games(FIVE))
        self.assertEqual([(r["player"], r["nth"]) for r in rows], [("Joe Malone", 1), ("Joe Malone", 2), ("Maurice Richard", 1), ("Ian Turnbull", 1)])

    def test_500th_goals(self):
        rows = m.five_hundredth_goals(CAREER)
        self.assertEqual([(r["player"], r["date"], r["club"], r["gameNumber"], r["opponent"], r["emptyNet"]) for r in rows], [
            ("Alexander Ovechkin", "2016-01-10", "Washington Capitals", 801, "Senators", False),
            ("Wayne Gretzky", "1986-11-22", "Edmonton Oilers", 575, "Canucks", True),
            ("Jaromír Jágr", "2012-03-01", "Pittsburgh Penguins", 1107, "Islanders", False),
            ("John Tavares", "2025-10-29", "Toronto Maple Leafs", 1149, "Blue Jackets", False)])

    def test_points_a_tied_row_has_no_rank_and_takes_the_points_above(self):
        rows = m.high_scoring_games(POINTS)
        self.assertEqual([(r["player"], r["amount"], r["club"], r["opponent"], r["clubScore"], r["opponentScore"]) for r in rows], [
            ("Wilt Chamberlain", 100, "Philadelphia Warriors", "New York Knicks", 169, 147),
            ("Wilt Chamberlain", 78, "Philadelphia Warriors", "Los Angeles Lakers", 147, 151),
            ("David Thompson", 78, "Denver Nuggets", "Detroit Pistons", 137, 139)])

    def test_the_extract_names_its_revision(self):
        pages = {"five-goals": {"title": "T1", "revision": 11, "timestamp": "t", "text": FIVE}, "career-goals": {"title": "T2", "revision": 22, "timestamp": "t", "text": CAREER},
                 "points": {"title": "T3", "revision": 33, "timestamp": "t", "text": POINTS}}
        out = m.build(pages)
        self.assertEqual(out["licence"], "CC BY-SA 4.0")
        self.assertEqual({r["source"] for r in out["records"]}, {"enwiki:T1@11", "enwiki:T2@22", "enwiki:T3@33"})
        self.assertEqual(len(out["records"]), 4 + 4 + 3)


if __name__ == "__main__":
    unittest.main()
