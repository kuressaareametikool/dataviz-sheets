import Chart from 'chart.js/auto';
import { showCompleteness } from './completeness.js';

function readings(sheet, metric) {
  const points = sheet[metric] ?? [];
  return points
    .filter(point => point.date)
    .map(({ date, value }) => ({
      date,
      value: Number.isFinite(value) ? value : null,
    }));
}

function draw(id, type, unit, datasets) {
  new Chart(document.getElementById(id), {
    type,
    data: { datasets },
    options: {
      parsing: { xAxisKey: 'date', yAxisKey: 'value' },
      scales: { y: { beginAtZero: true, title: { display: true, text: unit } } },
    },
  });
}
function participantDatasets(sheets, metric) {
  const dates = new Set();
  const participants = sheets.map(sheet => {
    const byDate = new Map();
    for (const { date, value } of readings(sheet, metric)) {
      dates.add(date);
      byDate.set(date, value);
    }
    return { name: sheet.name, byDate };
  });

  const calendar = [...dates].sort();
  return participants.map(({ name, byDate }, index) => ({
    label: name,
    data: calendar.map(date => ({ date, value: byDate.get(date) ?? null })),
    borderColor: `hsl(${index * 137.508 % 360}, 65%, 40%)`,
    backgroundColor: `hsl(${index * 137.508 % 360}, 65%, 40%)`,
    spanGaps: false,
  }));
}

async function drawCharts() {
  const response = await fetch('/api/data');
  const sheets = await response.json();
  if (!response.ok) throw new Error(sheets.error);

  showCompleteness(sheets, draw);
  if (sheets.length === 0) return;

  const first = sheets[0];

  const steps = readings(first, 'steps_count');
  draw('steps', 'bar', 'Steps', [
    { label: first.name, data: steps },
  ]);

  const minutes = readings(first, 'screen_total_min');
  draw('minutes', 'line', 'Minutes', [
    { label: first.name, data: minutes },
  ]);

  draw('all-steps', 'line', 'Steps', participantDatasets(sheets, 'steps_count'));
  draw('all-minutes', 'line', 'Minutes', participantDatasets(sheets, 'screen_total_min'));

  const stepsByDate = new Map();
  for (const sheet of sheets) {
    for (const { date, value } of readings(sheet, 'steps_count')) {
      if (!stepsByDate.has(date)) stepsByDate.set(date, []);
      if (value !== null) stepsByDate.get(date).push(value);
    }
  }

  const dates = [...stepsByDate.keys()].sort();
  const totals = [];
  const means = [];
  for (const date of dates) {
    const values = stepsByDate.get(date);
    const sum = values.reduce((total, value) => total + value, 0);
    totals.push({ date, value: values.length ? sum : null });
    means.push({ date, value: values.length ? sum / values.length : null });
  }

  draw('total', 'bar', 'Steps', [{ label: 'Class total', data: totals }]);
  draw('mean', 'line', 'Steps', [{ label: 'Mean per participant', data: means }]);

  const medians = dates.map(date => {
    const values = [...stepsByDate.get(date)].sort((a, b) => a - b);
    if (values.length === 0) return { date, value: null };

    const middle = Math.floor(values.length / 2);
    let median = values[middle];
    if (values.length % 2 === 0) median = (values[middle - 1] + values[middle]) / 2;
    return { date, value: median };
  });
  draw('median', 'line', 'Steps', [{ label: 'Median per participant', data: medians }]);
}

drawCharts().catch(error => {
  document.querySelector('#error').textContent = error.message;
  document.querySelector('#coverage-summary').textContent = 'Could not load workbook records. See the error below.';
});
