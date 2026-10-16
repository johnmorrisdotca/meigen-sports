import re
import unittest
from pathlib import Path


QUERY = Path(__file__).parent / "queries" / "player-birthday-candidates.sql"


class ReadOnlyPlayerBirthdayQueryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = QUERY.read_text(encoding="utf-8")
        code = re.sub(r"--[^\n]*", "", cls.sql)
        cls.code = re.sub(r"'(?:''|[^'])*'", "''", code).lower()
        cls.normalized = re.sub(r"\s+", " ", code).lower()

    def test_query_is_wrapped_in_read_only_transaction(self):
        self.assertRegex(self.code.strip(), r"^begin\s+read only;\s*set local statement_timeout\s*=.*?;\s*with\b")
        self.assertRegex(self.code.strip(), r"::text;\s*rollback;$")
        self.assertNotRegex(self.code, r"\b(insert|update|delete|truncate|alter|drop|copy|grant|revoke|create)\b")

    def test_candidate_requires_exact_unambiguous_wikidata_birth_date(self):
        self.assertIn("c.prop = 'p569'", self.normalized)
        self.assertIn("cl.value_prec = 11", self.code)
        self.assertIn("count(*) = count(value_on)", self.normalized)
        self.assertIn("count(distinct value_on) = 1", self.normalized)
        self.assertIn("bool_and(value_prec = 11)", self.normalized)
        self.assertIn("p.birth_date = b.birth_date", self.code)
        self.assertIn("s.role = 'player'", self.normalized)
        self.assertIn("where exists ( select 1 from core.roster_stint s", self.normalized)

    def test_candidate_requires_player_identity_and_archived_source_bytes(self):
        for required in (
            "x.entity_kind = 'person'",
            "src.code = 'wikidata'",
            "src.licence like 'cc0%'",
            "a.sha256 ~ '^[a-f0-9]{64}$'",
            "a.saved_on in (select distinct i.fetched_on",
            "legacy_files.raw_archive",
            "sourceevidence",
            "raw_claim.value #>> '{mainsnak,datavalue,value,precision}' = '11'",
            "raw_claim.ordinal = cl.n + 1",
            "raw_claim.value #>> '{rank}'",
            "limit :page_limit",
            "after_date",
            "after_qid",
            "single_identity_qids",
            "scannedcount",
            "nextcursor",
        ):
            self.assertIn(required, self.normalized)


if __name__ == "__main__":
    unittest.main()
