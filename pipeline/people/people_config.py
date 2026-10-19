"""Countries, sports and the selection rule for the meigen-sports people list. Every id here is checked against Wikidata by `fetch_people.py verify`.

Nothing here names or selects people by sex or gender (P21), ethnicity, religion, health, family or politics.
"""
from __future__ import annotations

TARGET_TOTAL = 2000          # the list grows from 1,000 to 2,000 people
MIN_SITELINKS_TIER_B = 20    # tier B: a Wikipedia article in at least 20 languages
MIN_SITELINKS_FILL = 8       # tier C: used only to fill a thin (country, sport) cell
CELL_FILL_TARGET = 3         # a cell below this many people may use tier C
MEDAL_CAP = 5                # medals beyond this add nothing to the score
MEDAL_WEIGHT = 10            # score = sitelinks + MEDAL_WEIGHT * min(medals, MEDAL_CAP)
SEARCH_LIMIT = 50            # Wikidata search hits read per (country, sport) cell

# code, Wikidata item, English name, tier, new-person quota, extra citizenship items (historical states), Olympic NOC codes
COUNTRIES = [
    ("JP", "Q17", "Japan", 1, 70, [], ["JPN"]),
    ("CA", "Q16", "Canada", 1, 70, [], ["CAN"]),
    ("US", "Q30", "United States", 1, 45, [], ["USA"]),
    ("DE", "Q183", "Germany", 1, 55, ["Q16957", "Q713750"], ["GER", "EUA", "FRG", "GDR"]),
    ("FR", "Q142", "France", 1, 55, [], ["FRA"]),
    ("IT", "Q38", "Italy", 1, 55, [], ["ITA"]),
    ("GB", "Q145", "United Kingdom", 1, 55, [], ["GBR"]),
    ("BR", "Q155", "Brazil", 1, 40, [], ["BRA"]),
    ("AU", "Q408", "Australia", 1, 40, [], ["AUS"]),
    ("CN", "Q148", "China", 1, 40, [], ["CHN"]),
    ("KR", "Q884", "South Korea", 1, 40, [], ["KOR"]),
    ("RU", "Q159", "Russia", 1, 40, ["Q15180"], ["RUS", "URS", "EUN", "ROC", "OAR"]),
    ("ES", "Q29", "Spain", 1, 40, [], ["ESP"]),
    ("NL", "Q55", "Netherlands", 1, 40, ["Q29999"], ["NED"]),
    ("JM", "Q766", "Jamaica", 2, 12, [], ["JAM"]),
    ("CU", "Q241", "Cuba", 2, 12, [], ["CUB"]),
    ("KE", "Q114", "Kenya", 2, 10, [], ["KEN"]),
    ("ET", "Q115", "Ethiopia", 2, 10, [], ["ETH"]),
    ("SE", "Q34", "Sweden", 2, 12, [], ["SWE"]),
    ("FI", "Q33", "Finland", 2, 12, [], ["FIN"]),
    ("NO", "Q20", "Norway", 2, 12, [], ["NOR"]),
    ("CZ", "Q213", "Czech Republic", 2, 12, ["Q33946"], ["CZE", "TCH"]),
    ("HU", "Q28", "Hungary", 2, 12, [], ["HUN"]),
    ("PL", "Q36", "Poland", 2, 12, [], ["POL"]),
    ("AR", "Q414", "Argentina", 2, 12, [], ["ARG"]),
    ("MX", "Q96", "Mexico", 2, 12, [], ["MEX"]),
    ("UA", "Q212", "Ukraine", 2, 12, [], ["UKR"]),
    ("NZ", "Q664", "New Zealand", 2, 12, [], ["NZL"]),
    ("CH", "Q39", "Switzerland", 2, 12, [], ["SUI"]),
    ("TR", "Q43", "Turkey", 2, 10, [], ["TUR"]),
    ("IR", "Q794", "Iran", 2, 8, [], ["IRI"]),
    ("IN", "Q668", "India", 2, 10, [], ["IND"]),
    ("ZA", "Q258", "South Africa", 2, 10, [], ["RSA"]),
    ("NG", "Q1033", "Nigeria", 2, 8, [], ["NGR"]),
    ("EG", "Q79", "Egypt", 2, 8, [], ["EGY"]),
    ("GR", "Q41", "Greece", 2, 8, [], ["GRE"]),
    ("RO", "Q218", "Romania", 2, 10, [], ["ROU"]),
    ("BG", "Q219", "Bulgaria", 2, 8, [], ["BUL"]),
    ("BE", "Q31", "Belgium", 2, 10, [], ["BEL"]),
    ("DK", "Q35", "Denmark", 2, 10, ["Q756617"], ["DEN"]),
    ("AT", "Q40", "Austria", 2, 10, [], ["AUT"]),
    ("HR", "Q224", "Croatia", 2, 8, ["Q36704"], ["CRO"]),
    ("RS", "Q403", "Serbia", 2, 8, ["Q36704"], ["SRB", "YUG"]),
    ("CO", "Q739", "Colombia", 2, 8, [], ["COL"]),
    ("VE", "Q717", "Venezuela", 2, 6, [], ["VEN"]),
    ("DO", "Q786", "Dominican Republic", 2, 6, [], ["DOM"]),
]

# slug, English label, P641 sport items (verified), Wikipedia medallist lists ("List of Olympic medalists in ...")
SPORTS = [
    ("judo", "judo", ["Q11420"], ["judo"]),
    ("athletics", "athletics", ["Q542"], ["athletics (men)", "athletics (women)"]),
    ("figure_skating", "figure skating", ["Q38108"], ["figure skating"]),
    ("speed_skating", "speed skating", ["Q192431", "Q193654"], ["speed skating", "short track speed skating"]),
    ("swimming", "swimming", ["Q31920"], ["swimming (men)", "swimming (women)"]),
    ("gymnastics", "gymnastics", ["Q43450", "Q326827", "Q61465"], ["gymnastics (men)", "gymnastics (women)"]),
    ("soccer", "association football", ["Q2736"], []),
    ("basketball", "basketball", ["Q5372"], []),
    ("ice_hockey", "ice hockey", ["Q41466"], []),
    ("baseball", "baseball", ["Q5369"], []),
    ("tennis", "tennis", ["Q847"], []),
    ("cycling", "cycling", ["Q53121"], ["cycling (men)", "cycling (women)"]),
    ("boxing", "boxing", ["Q32112"], ["boxing"]),
    ("karate", "karate", ["Q11419"], ["karate"]),
    ("taekwondo", "taekwondo", ["Q36389"], ["taekwondo"]),
    ("wrestling", "wrestling", ["Q42486", "Q327223", "Q389654"], ["freestyle wrestling", "Greco-Roman wrestling"]),
    ("sumo", "sumo", ["Q40561"], []),
    ("mma", "mixed martial arts", ["Q114466"], []),
    ("fencing", "fencing", ["Q12100"], ["fencing"]),
    ("weightlifting", "weightlifting", ["Q83462"], ["weightlifting"]),
    ("rowing", "rowing", ["Q159354"], ["rowing (men)", "rowing (women)"]),
    ("diving", "diving", ["Q7735"], []),
    ("golf", "golf", ["Q5377"], ["golf"]),
    ("badminton", "badminton", ["Q7291"], ["badminton"]),
    ("table_tennis", "table tennis", ["Q3930"], ["table tennis"]),
    ("volleyball", "volleyball", ["Q1734"], []),
    ("alpine_skiing", "alpine skiing", ["Q186222"], ["alpine skiing"]),
    ("cross_country_skiing", "cross-country skiing", ["Q179687"], ["cross-country skiing"]),
    ("ski_jumping", "ski jumping", ["Q7718"], ["ski jumping"]),
    ("snowboarding", "snowboarding", ["Q178131"], ["snowboarding"]),
    ("rugby_union", "rugby union", ["Q5849"], []),
    ("cricket", "cricket", ["Q5375"], []),
    ("formula_one", "Formula One", ["Q1968"], []),
    ("motorcycle_racing", "motorcycle racing", ["Q17163326"], []),
    ("handball", "handball", ["Q8418"], []),
    ("softball", "softball", ["Q171038"], []),
    ("triathlon", "triathlon", ["Q10980"], ["triathlon"]),
    ("canoeing", "canoeing", ["Q20856109", "Q213934"], ["canoeing"]),
    ("archery", "archery", ["Q108429"], ["archery"]),
    ("sailing", "sailing", ["Q14085739"], ["sailing"]),
]

SPORT_ORDER = [row[0] for row in SPORTS]

# Honour lists read from English Wikipedia (wikitext). Members that are human athletes join before the country rounds, tier H.
# id, article, section heading of the table, sport, how many to take (table order). The first link of each table row is the person.
HONOUR_LISTS = [
    ("nba50", "50 Greatest Players in NBA History", "===List===", "basketball", 50),
]
