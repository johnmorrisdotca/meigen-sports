/** Curated history families. Availability describes implementation evidence, not live database coverage. */
export interface HistoryType {
 readonly id: string;
 readonly label: string;
 readonly modes: readonly ("spx-derived" | "external" | "manual")[];
 readonly evidence: string;
 readonly readiness: "seeded" | "extractable-if-populated" | "validation-needed" | "needs-source";
}
/** Thirty history families; quotation and precise event subtypes are separate tags. */
export const HISTORY_TYPES: readonly HistoryType[] = [
 {"id": "championship-win", "label": "Championship victory", "modes": ["spx-derived", "external", "manual"], "evidence": "Champion, competition edition and deciding result", "readiness": "validation-needed"},
 {"id": "historic-cup-series", "label": "Historic cup or series", "modes": ["spx-derived", "external", "manual"], "evidence": "Edition, participants and verified significance", "readiness": "validation-needed"},
 {"id": "playoffs-start", "label": "Playoffs start", "modes": ["spx-derived", "external", "manual"], "evidence": "Competition phase and first confirmed playoff fixture", "readiness": "validation-needed"},
 {"id": "season-boundary", "label": "Season opener or finale", "modes": ["spx-derived", "external", "manual"], "evidence": "Season, schedule completeness and actual played date", "readiness": "extractable-if-populated"},
 {"id": "series-start", "label": "Series begins", "modes": ["spx-derived", "external", "manual"], "evidence": "Series membership and first played fixture", "readiness": "validation-needed"},
 {"id": "series-clinch", "label": "Series clinch or sweep", "modes": ["spx-derived", "external", "manual"], "evidence": "Series rules and complete results", "readiness": "validation-needed"},
 {"id": "match-result", "label": "Match result", "modes": ["spx-derived", "external", "manual"], "evidence": "Participants, final score and played date", "readiness": "seeded"},
 {"id": "overtime-result", "label": "Overtime result", "modes": ["spx-derived", "external", "manual"], "evidence": "Final result and explicit overtime or extra-time evidence", "readiness": "extractable-if-populated"},
 {"id": "shutout", "label": "Shutout", "modes": ["spx-derived", "external", "manual"], "evidence": "Completed result and sport-specific scoring definition", "readiness": "extractable-if-populated"},
 {"id": "score-margin", "label": "Scoring margin", "modes": ["spx-derived", "external", "manual"], "evidence": "Completed score and explicitly bounded comparison coverage", "readiness": "extractable-if-populated"},
 {"id": "winning-streak", "label": "Winning streak", "modes": ["spx-derived", "external", "manual"], "evidence": "Ordered complete results and draw, overtime and postseason policy", "readiness": "validation-needed"},
 {"id": "first-recorded-game", "label": "First recorded game or victory", "modes": ["spx-derived", "external", "manual"], "evidence": "Coverage start and complete ordered results; distinguish recorded from inaugural", "readiness": "extractable-if-populated"},
 {"id": "franchise-founded", "label": "Franchise founded", "modes": ["external", "manual"], "evidence": "Independent founding date; first recorded game is insufficient", "readiness": "needs-source"},
 {"id": "franchise-folded", "label": "Franchise ceased operations", "modes": ["external", "manual"], "evidence": "Independent dissolution evidence; last recorded game is insufficient", "readiness": "needs-source"},
 {"id": "franchise-identity-change", "label": "Franchise identity change", "modes": ["spx-derived", "external", "manual"], "evidence": "Dated relocation, rename or lineage evidence", "readiness": "validation-needed"},
 {"id": "venue-history", "label": "Venue milestone", "modes": ["external", "manual"], "evidence": "Verified opening, closing, rename or first-event evidence", "readiness": "needs-source"},
 {"id": "player-birthday", "label": "Player birthday", "modes": ["spx-derived", "external", "manual"], "evidence": "Verified birth date and stable person identity", "readiness": "extractable-if-populated"},
 {"id": "age-at-event", "label": "Age at an event", "modes": ["spx-derived", "external", "manual"], "evidence": "Verified birth date and event date with age calculation convention", "readiness": "extractable-if-populated"},
 {"id": "player-career-boundary", "label": "Player debut or final appearance", "modes": ["spx-derived", "external", "manual"], "evidence": "Complete appearance coverage; distinguish last known from career final", "readiness": "validation-needed"},
 {"id": "player-retirement", "label": "Player retirement", "modes": ["external", "manual"], "evidence": "Dated retirement announcement or transaction; final appearance is insufficient", "readiness": "needs-source"},
 {"id": "draft-selection", "label": "Draft selection", "modes": ["spx-derived", "external", "manual"], "evidence": "Draft edition, round, pick, team and person identity", "readiness": "extractable-if-populated"},
 {"id": "award-honour", "label": "Award or honour", "modes": ["spx-derived", "external", "manual"], "evidence": "Award edition, recipient and award or announcement date", "readiness": "validation-needed"},
 {"id": "season-stat-milestone", "label": "Season statistical milestone", "modes": ["spx-derived", "external", "manual"], "evidence": "Metric, season, scope, value and complete inputs; exact crossing requires event history", "readiness": "validation-needed"},
 {"id": "career-stat-milestone", "label": "Career statistical milestone", "modes": ["spx-derived", "external", "manual"], "evidence": "Stable person identity, metric, scope and complete career inputs", "readiness": "validation-needed"},
 {"id": "competition-boundary", "label": "Competition begins or ends", "modes": ["spx-derived", "external", "manual"], "evidence": "Explicit start or end role and date precision", "readiness": "seeded"},
 {"id": "scoring-performance", "label": "Scoring performance", "modes": ["external", "manual"], "evidence": "Verified participant-level event evidence; aggregates cannot identify decisive scorer", "readiness": "needs-source"},
 {"id": "result-streak", "label": "Losing, winless or unbeaten streak", "modes": ["spx-derived", "external", "manual"], "evidence": "Ordered complete results and explicit streak subtype and result policy", "readiness": "validation-needed"},
 {"id": "combat-sport-result", "label": "Combat sports result or title reign", "modes": ["external", "manual"], "evidence": "Bout result, sanctioning body, division and title lineage where relevant", "readiness": "needs-source"},
 {"id": "athletics-performance", "label": "Athletics performance or medal", "modes": ["external", "manual"], "evidence": "Discipline, round, result, conditions and official placing", "readiness": "needs-source"},
 {"id": "sport-record", "label": "Sporting record progression", "modes": ["external", "manual"], "evidence": "Metric, scope, former holder, attained value, authority and ratification status", "readiness": "needs-source"},
];
