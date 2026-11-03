/** The words of the catalogue page and of the demo's "what is inside" panel, in the two languages the demo shows. */
const KIND = {
  en: { "player-birthday": "Birthdays", "player-death": "Deaths", "game-on-day": "Games", "competition-start": "Competitions begun", "competition-end": "Competitions ended", "sport-event": "Events held", "retired-number": "Retired numbers", "soccer-on-day": "Soccer matches", "all-star": "All-Star Games", "championship-final": "Championship finals", "game-feat": "No-hitters and perfect games", "venue-opening": "Venue openings", "player-feat": "Player feats", "franchise-event": "Club identities", "award": "Awards" },
  ja: { "player-birthday": "誕生日", "player-death": "亡くなった日", "game-on-day": "試合", "competition-start": "大会の開始", "competition-end": "大会の終了", "sport-event": "行われた大会", "retired-number": "永久欠番", "soccer-on-day": "サッカーの試合", "all-star": "オールスター", "championship-final": "優勝決定戦", "game-feat": "ノーヒットノーランと完全試合", "venue-opening": "会場の開業", "player-feat": "選手の大記録", "franchise-event": "球団の名前の変化", "award": "賞" },
} as const;
const SOURCE = {
  en: { wikidata: "Wikidata", retrosheet: "Retrosheet", wikipedia: "Wikipedia", nflverse: "nflverse", jfjelstul_worldcup: "Fjelstul World Cup database", openfootball_mls: "openfootball (MLS)", wikipedia_daily: "Wikipedia (daily)", wikipedia_mls: "Wikipedia (MLS)", openfootball_worldcup: "openfootball (World Cup)" },
  ja: { wikidata: "Wikidata", retrosheet: "Retrosheet", wikipedia: "ウィキペディア", nflverse: "nflverse", jfjelstul_worldcup: "Fjelstul ワールドカップDB", openfootball_mls: "openfootball（MLS）", wikipedia_daily: "ウィキペディア（毎日）", wikipedia_mls: "ウィキペディア（MLS）", openfootball_worldcup: "openfootball（ワールドカップ）" },
} as const;

export const catalogueWords = (language: "en" | "ja"): Record<string, string> => ({
  ...Object.fromEntries(Object.entries(KIND[language]).map(([key, text]) => [`kind-${key}`, text])),
  ...Object.fromEntries(Object.entries(SOURCE[language]).map(([key, text]) => [`source-${key}`, text])),
  ...(language === "en" ? {
    catalogue: "What is inside", catTitle: "What is inside the data", catIntro: "Everything here is counted by the build from the facts themselves, never typed in. The same numbers are in catalogue.json, in the npm package and on this site.",
    catBuilt: "Package {version}. Facts rebuilt on {date}.", catBuiltNone: "Package {version}.", catBack: "Back to the demo", catJson: "catalogue.json", catLoading: "Loading the catalogue...", catError: "The catalogue could not be loaded.",
    catTotals: "In numbers", catFacts: "facts", catPeople: "people", catEvents: "events and competitions", catSources: "sources", catDays: "days thinner than {n} facts", catEmpty: "days with no fact", catOffline: "facts in the offline set", catQuotes: "quotations",
    chKinds: "Facts by kind", chSports: "Facts by sport (top 15, the rest as other)", chDecades: "Facts by decade", chYears: "Facts by year", chDays: "Facts on each day of the year (darker is more; outlined is thin)", chPeople: "People by sport (top 12)", chSources: "Where the facts come from", chOffline: "The bundled offline set and the full set",
    colKind: "Kind", colSport: "Sport", colDecade: "Decade", colYear: "Year", colDay: "Day", colFacts: "Facts", colShare: "Share", colSource: "Source", colLicence: "Licence", colPeople: "People", colDeceased: "Deceased", colNotKnown: "Not known to be deceased", colSet: "Set", colRecords: "Facts", colDaysCovered: "Days covered",
    tableOf: "Table of these numbers", other: "Other", noSport: "No sport", legendDeceased: "Deceased", legendNotKnown: "Not known to be deceased (never \"living\")",
    offlineSet: "Offline set", fullSet: "Full set", offlinePerDay: "{min} to {max} facts for every day",
    gapsTitle: "Gaps", gapsIntro: "What is thin or missing, said plainly. Below these numbers a day, sport, league or decade counts as thin: {day} facts for a day, {sport} for a sport, {league} for a league, {decade} for a decade.",
    gapsShow: "Show the list", gapsDays: "Thin days ({n})", gapsSports: "Sports with few facts ({n})", gapsLeagues: "Thin leagues ({n})", gapsDecades: "Thin decades ({n})", gapsNone: "None.", gapsNotes: "Partial or waiting", "status-partial": "partial", "status-waiting": "waiting", "status-not-planned": "not planned",
    rulesTitle: "Rules in force", extractsTitle: "Made from these extracts", extractsIntro: "The facts were rebuilt from these files. The SHA-256 names each one exactly.", colFile: "File", colModified: "Changed", colSha: "SHA-256",
    fameTitle: "The 100 most famous people", fameIntro: "The package is built around 2,000 people, ranked by world fame. The score is the number of Wikipedia languages the person has an article in, plus a few points for Olympic medals, world titles and halls of fame. A tie goes to the older list. The full list of 2,000 is in catalogue.json.", fameSum: "{n} people ranked, {scored} scored. In the first 100: {sports}; {countries}.", fameJson: "The full list (catalogue.json)",
    colRank: "Rank", colName: "Name", colCountry: "Country", colScore: "Score",
    catPanelText: "{facts} facts about {people} people and {events} events, from {sources} sources, counted by the build. {thin} days have fewer than {n} facts.", catPanelLink: "See the charts", catPanelGaps: "Show the gaps", catPanelGapsHide: "Hide the gaps",
  } : {
    catalogue: "中身の一覧", catTitle: "データの中身", catIntro: "ここにある数字はすべて、ビルドがデータそのものから数えたもので、手で書いたものではありません。同じ数字が catalogue.json にあり、npmパッケージとこのサイトにも入っています。",
    catBuilt: "パッケージ {version}。事実の作り直し：{date}。", catBuiltNone: "パッケージ {version}。", catBack: "デモにもどる", catJson: "catalogue.json", catLoading: "一覧を読み込んでいます...", catError: "一覧を読み込めませんでした。",
    catTotals: "数字で見る", catFacts: "件の事実", catPeople: "人", catEvents: "大会・行事", catSources: "出典", catDays: "日（事実が{n}件より少ない）", catEmpty: "日（事実が1件もない）", catOffline: "件（オフライン版）", catQuotes: "件の名言",
    chKinds: "種類ごとの事実の数", chSports: "競技ごとの事実の数（上位15、残りは「その他」）", chDecades: "年代ごとの事実の数", chYears: "年ごとの事実の数", chDays: "一年の各日の事実の数（色が濃いほど多い。枠のある日は少ない日）", chPeople: "競技ごとの人数（上位12）", chSources: "事実の出どころ", chOffline: "同梱のオフライン版と全データ",
    colKind: "種類", colSport: "競技", colDecade: "年代", colYear: "年", colDay: "日", colFacts: "事実", colShare: "割合", colSource: "出典", colLicence: "ライセンス", colPeople: "人数", colDeceased: "亡くなった人", colNotKnown: "亡くなったか不明の人", colSet: "データ", colRecords: "事実", colDaysCovered: "カバーする日",
    tableOf: "これらの数字の表", other: "その他", noSport: "競技なし", legendDeceased: "亡くなった人", legendNotKnown: "亡くなったか分かっていない人（「存命」とは書きません）",
    offlineSet: "オフライン版", fullSet: "全データ", offlinePerDay: "どの日も{min}〜{max}件",
    gapsTitle: "足りないところ", gapsIntro: "少ないところ、ないところを、そのまま示します。次の数より少ないと「少ない」とします：日は{day}件、競技は{sport}件、リーグは{league}件、年代は{decade}件。",
    gapsShow: "一覧を見る", gapsDays: "事実の少ない日（{n}）", gapsSports: "事実の少ない競技（{n}）", gapsLeagues: "事実の少ないリーグ（{n}）", gapsDecades: "事実の少ない年代（{n}）", gapsNone: "ありません。", gapsNotes: "一部だけ・待ち", "status-partial": "一部だけ", "status-waiting": "待ち", "status-not-planned": "予定なし",
    rulesTitle: "守っているルール", extractsTitle: "作るのに使ったファイル", extractsIntro: "事実は、これらのファイルから作り直しました。SHA-256 でファイルを正確に特定できます。", colFile: "ファイル", colModified: "更新日", colSha: "SHA-256",
    fameTitle: "世界でいちばん有名な100人", fameIntro: "このパッケージは2,000人の選手を中心に作られていて、世界での有名さの順に並べています。点数は、その人の記事があるウィキペディアの言語の数に、オリンピックのメダル、世界タイトル、殿堂入りの点を少し足したものです。同点のときは、前からあるリストの順です。2,000人の全部は catalogue.json にあります。", fameSum: "{n}人を順位づけ（点数がついたのは{scored}人）。上位100人では：{sports}、{countries}。", fameJson: "全員のリスト（catalogue.json）",
    colRank: "順位", colName: "名前", colCountry: "国", colScore: "点数",
    catPanelText: "{sources}の出典から、{people}人と{events}の大会・行事について、事実が{facts}件あります（ビルドが数えた数字です）。事実が{n}件より少ない日が{thin}日あります。", catPanelLink: "グラフを見る", catPanelGaps: "足りないところを見る", catPanelGapsHide: "足りないところを隠す",
  }),
});
