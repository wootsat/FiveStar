// Matchup write-ups.
//
// Written by hand (ask Claude in chat to draft one from a month's results, then
// it lands here), committed, and shipped with `npm run deploy`. No API key, no
// server, no cost — the text ships with the app.
//
// Shape:  RECAPS[leagueId][month] = [ { teams: [nameA, nameB], title, text }, ... ]
//   leagueId — the six-digit invite code, as a string
//   month    — 'YYYY-MM'
//   teams    — the two team names, in either order; matching is case-insensitive
//   title    — the write-up's own headline, shown above the text
//   text     — plain paragraphs separated by a blank line
//
// Shown on a matchup's detail screen — tap a matchup on the Matchups tab.

export const RECAPS = {
  '875351': {
    '2026-05': [
      {
        teams: ['YOLO Kings', 'Investment Giants'],
        title: 'Equal and Opposite',
        text: `You could not have drawn this one up more neatly. YOLO Kings +5.61%, Investment Giants -5.59% — two teams the same distance from zero, pointing in opposite directions. In a league where a big month is about 5%, the Kings had one and the Giants had precisely its reflection.

The Kings open the season 1-0, and by the standards of everything except one other result this month, +5.61% is a genuinely strong start. The Giants begin 0-1 and will want to file May under calibration.`,
      },
      {
        teams: ['Omaha Lions', 'Wolf Lady'],
        title: 'Omaha Breaks the Scoreboard',
        text: `+52.54%. In a league where a big month is 5%, the Omaha Lions turned in roughly ten of them at once. This is the best single-month performance the league has on record and it isn't close — the kind of number you check twice, and then check again to see what on earth they were holding.

Spare a thought for Wolf Lady, who posted +4.44%. In a normal month that is a solid, competitive result worth talking about. Here it lost by forty-eight points. Omaha start the season 1-0, Wolf Lady 0-1, and everyone else now has a benchmark they will probably never touch again.`,
      },
    ],
    '2026-06': [
      {
        teams: ['Omaha Lions', 'YOLO Kings'],
        title: 'Twenty-Seven Points of Daylight',
        text: `The Omaha Lions put up +22.78% in June and the YOLO Kings put up -4.96%, which is less a head-to-head than a demonstration. Twenty-seven and a half points is the kind of margin where the loser stops doing the math halfway through and just closes the app.

That's two from two for Omaha, who are starting to look like a team that knows something the rest of the league doesn't. The Kings drop to 1-1, and can at least console themselves that everyone has to play the Lions eventually — better to get it over with in June than in December.`,
      },
      {
        teams: ['Investment Giants', 'Wolf Lady'],
        title: 'The Giants Find Their Feet',
        text: `Investment Giants took this one +5.36% to -9.49%. A 14.85-point margin isn't June's biggest, but it was decisive enough — the Giants were one of only two teams to finish the month in the black, and Wolf Lady posted the worst number in the league.

The Giants level up at 1-1 and look steady. Wolf Lady drops to 0-2, which is early enough not to panic and late enough to start reading the standings with one eye closed. Two months is a slump. Three is a personality.`,
      },
    ],
    '2026-07': [
      {
        teams: ['Wolf Lady', 'YOLO Kings'],
        title: 'Green by a Whisker',
        text: `+0.87% is not a number anyone frames. In July it was the only green figure in the entire league — three of the four teams finished the month underwater, and the YOLO Kings cleared the bar by less than a point. Wolf Lady came in at -6.27%, and seven points of daylight settled it comfortably.

The two books could not have been built more differently. The Kings went into July holding three positions; Wolf Lady held eight. Both leaned on Apple, which did neither of them any favours. But where Wolf Lady's spread meant the bad news arrived from six directions at once, the Kings simply had fewer places to bleed from. In a month like this one, that turned out to be the entire strategy.

The Kings move to 2-1 and are quietly the most sensible team in the league. Wolf Lady falls to 0-3. Last month we suggested that two months is a slump and three is a personality. July has gone ahead and made that call for us.`,
      },
      {
        teams: ['Omaha Lions', 'Investment Giants'],
        title: 'Undefeated and Underwater',
        text: `The Omaha Lions lost 9.38% in July and won their matchup by six and a half points. That is the kind of month it was. The Investment Giants finished at -15.86%, and this was less a contest of who played well than of who flinched less.

That -15.86% is the worst single month the league has on record, and it belongs to the same season that produced Omaha's +52.54% in May. Sixty-eight points separate the ceiling and the floor of this league's record book, and both entries were written inside ten weeks of each other.

Omaha move to 3-0, which is the genuinely strange part. They are the only undefeated team in the league and they got there in July by handing back nearly a tenth of the portfolio. Nobody is putting that on a banner. It counts the same in the standings. The Giants drop to 1-2.`,
      },
    ],
  },
};

const norm = (name) => String(name ?? '').trim().toLowerCase();

// Order-insensitive lookup on the two team names. Returns the whole entry so
// callers get the headline alongside the body.
export const recapForMatchup = (leagueId, month, nameA, nameB) => {
  const entries = RECAPS[String(leagueId)]?.[month];
  if (!Array.isArray(entries)) return undefined;
  const want = [norm(nameA), norm(nameB)].sort();
  return entries.find(e => {
    const got = (e.teams || []).map(norm).sort();
    return got.length === 2 && got[0] === want[0] && got[1] === want[1];
  });
};

// True when any matchup that month has a write-up — drives the month chip icon.
export const monthHasRecap = (leagueId, month) =>
  Array.isArray(RECAPS[String(leagueId)]?.[month]) && RECAPS[String(leagueId)][month].length > 0;
