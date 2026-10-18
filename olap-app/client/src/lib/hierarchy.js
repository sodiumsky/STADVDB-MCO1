// Drill state: { levelIndex, members } where members maps a level id to the member that was
// clicked at that level, e.g. { borough: 'Manhattan' }.

export const initialDrill = () => ({ levelIndex: 0, members: {} });

export function drillInto(report, drill, member) {
  const last = report.levels.length - 1;
  if (drill.levelIndex >= last) return drill;
  const level = report.levels[drill.levelIndex];
  return { levelIndex: drill.levelIndex + 1, members: { ...drill.members, [level.id]: member } };
}

export function drillDown(report, drill) {
  const last = report.levels.length - 1;
  if (drill.levelIndex >= last) return drill;
  return { ...drill, levelIndex: drill.levelIndex + 1 };
}

// Roll up to the level at `index`, forgetting any member chosen at that level or below.
export function rollTo(report, drill, index) {
  const members = {};
  report.levels.forEach((l, i) => {
    if (i < index && drill.members[l.id] !== undefined) members[l.id] = drill.members[l.id];
  });
  return { levelIndex: index, members };
}

export const rollUp = (report, drill) =>
  drill.levelIndex === 0 ? drill : rollTo(report, drill, drill.levelIndex - 1);

// Filters actually sent to the server: the user's filters, with drilled members laid over them.
export function effectiveFilters(report, filterDefs, filters, drill) {
  const out = { ...filters };
  report.levels.forEach((level, i) => {
    if (i < drill.levelIndex && drill.members[level.id] !== undefined) {
      const member = drill.members[level.id];
      out[level.filter] = filterDefs[level.filter]?.control === 'multi' ? [member] : member;
    }
  });
  return out;
}

// Filter keys currently set by a drill, mapped to the member that set them.
export function lockedFilters(report, drill) {
  const locked = {};
  report.levels.forEach((level, i) => {
    if (i < drill.levelIndex && drill.members[level.id] !== undefined) {
      locked[level.filter] = drill.members[level.id];
    }
  });
  return locked;
}
