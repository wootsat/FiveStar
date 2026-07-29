// Monthly league recaps.
//
// These are written by hand (ask Claude in chat to draft one from the month's
// results, then it lands here), committed, and shipped with `npm run deploy`.
// No API key, no server, no cost — the text ships with the app.
//
// Shape:  RECAPS[leagueId][month] = "text"
//   leagueId — the six-digit invite code, as a string
//   month    — 'YYYY-MM'
//   text     — plain paragraphs separated by a blank line; the app splits on
//              blank lines and renders each as its own paragraph.
//
// Displayed on the Matchups tab when that month is selected.

export const RECAPS = {
  // '418206': {
  //   '2026-07': `First paragraph of the July recap.
  //
  // Second paragraph.`,
  // },
};

export const recapFor = (leagueId, month) => RECAPS[String(leagueId)]?.[month];
