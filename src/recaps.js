// Matchup write-ups.
//
// Written by hand (ask Claude in chat to draft one from a month's results, then
// it lands here), committed, and shipped with `npm run deploy`. No API key, no
// server, no cost — the text ships with the app.
//
// Shape:  RECAPS[leagueId][month] = [ { teams: [nameA, nameB], text }, ... ]
//   leagueId — the six-digit invite code, as a string
//   month    — 'YYYY-MM'
//   teams    — the two team names, in either order; matching is case-insensitive
//   text     — plain paragraphs separated by a blank line
//
// Shown on a matchup's detail screen — tap a matchup on the Matchups tab.

export const RECAPS = {
  '875351': {
    '2026-06': [
      {
        teams: ['Omaha Lions', 'YOLO Kings'],
        text: `The Omaha Lions put up +22.78% in June and the YOLO Kings put up -4.96%, which is less a head-to-head than a demonstration. Twenty-seven and a half points is the kind of margin where the loser stops doing the math halfway through and just closes the app.

That's two from two for Omaha, who are starting to look like a team that knows something the rest of the league doesn't. The Kings drop to 1-1, and can at least console themselves that everyone has to play the Lions eventually — better to get it over with in June than in December.`,
      },
      {
        teams: ['Investment Giants', 'Wolf Lady'],
        text: `Investment Giants took this one +5.36% to -9.49%. A 14.85-point margin isn't June's biggest, but it was decisive enough — the Giants were one of only two teams to finish the month in the black, and Wolf Lady posted the worst number in the league.

The Giants level up at 1-1 and look steady. Wolf Lady drops to 0-2, which is early enough not to panic and late enough to start reading the standings with one eye closed. Two months is a slump. Three is a personality.`,
      },
    ],
  },
};

const norm = (name) => String(name ?? '').trim().toLowerCase();

// Order-insensitive lookup on the two team names.
export const recapForMatchup = (leagueId, month, nameA, nameB) => {
  const entries = RECAPS[String(leagueId)]?.[month];
  if (!Array.isArray(entries)) return undefined;
  const want = [norm(nameA), norm(nameB)].sort();
  return entries.find(e => {
    const got = (e.teams || []).map(norm).sort();
    return got.length === 2 && got[0] === want[0] && got[1] === want[1];
  })?.text;
};

// True when any matchup that month has a write-up — drives the month chip icon.
export const monthHasRecap = (leagueId, month) =>
  Array.isArray(RECAPS[String(leagueId)]?.[month]) && RECAPS[String(leagueId)][month].length > 0;
