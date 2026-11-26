function datedValues(sheet, metric) {
  const values = new Map();
  for (const { date, value } of sheet[metric] ?? []) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue;
    values.set(date, value);
  }
  return values;
}

export function summarizeCoverage(sheets) {
  const dates = new Set();
  const participants = sheets.map(sheet => {
    const steps = datedValues(sheet, 'steps_count');
    const minutes = datedValues(sheet, 'screen_total_min');
    for (const date of steps.keys()) dates.add(date);
    for (const date of minutes.keys()) dates.add(date);
    return { steps, minutes };
  });

  const calendar = [...dates].sort();
  const start = calendar[0] ?? null;
  const end = calendar.at(-1) ?? null;
  const daily = [];
  const totals = { steps: 0, minutes: 0, paired: 0 };
  if (start) {
    const day = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (day <= last) {
      const date = day.toISOString().slice(0, 10);
      const counts = { date, steps: 0, minutes: 0, paired: 0 };
      for (const participant of participants) {
        const hasSteps = Number.isFinite(participant.steps.get(date));
        const hasMinutes = Number.isFinite(participant.minutes.get(date));
        if (hasSteps) counts.steps++;
        if (hasMinutes) counts.minutes++;
        if (hasSteps && hasMinutes) counts.paired++;
      }
      daily.push(counts);
      totals.steps += counts.steps;
      totals.minutes += counts.minutes;
      totals.paired += counts.paired;
      day.setUTCDate(day.getUTCDate() + 1);
    }
  }

  return {
    start, end,
    participants: sheets.length,
    days: daily.length,
    possible: sheets.length * daily.length,
    daily, ...totals,
  };
}

function percent(count, possible) {
  return possible ? count / possible * 100 : 0;
}

export function showCompleteness(sheets, draw) {
  const { start, end, participants, days, possible, steps, minutes, paired, daily } = summarizeCoverage(sheets);
  const summary = document.getElementById('coverage-summary');
  if (!days) {
    summary.textContent = 'No valid dates were found in the step or screen-time records.';
    return;
  }

  summary.textContent = `${participants} participants over ${days} days (${start} to ${end}). There are ${possible} possible readings for each measurement.`;

  draw('coverage-overall', 'bar', 'Available readings (%)', [{
    label: 'Available records',
    data: [
      { date: 'Steps', value: percent(steps, possible) },
      { date: 'Screen time', value: percent(minutes, possible) },
    ],
  }]);

  draw('coverage-daily', 'line', 'Participants reporting (%)', [
    { label: 'Steps', data: daily.map(day => ({ date: day.date, value: percent(day.steps, participants) })) },
    { label: 'Screen time', data: daily.map(day => ({ date: day.date, value: percent(day.minutes, participants) })) },
  ]);

  document.getElementById('coverage-finding').textContent = `Steps have ${steps} of ${possible} readings (${percent(steps, possible).toFixed(1)}%). Screen time has ${minutes} of ${possible} readings (${percent(minutes, possible).toFixed(1)}%). Paired readings (same participant and date): ${paired}.`;
}
