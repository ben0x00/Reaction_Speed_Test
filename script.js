const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const downloadTrialsBtn = document.getElementById('downloadTrialsBtn');
const downloadSummaryBtn = document.getElementById('downloadSummaryBtn');
const gameArea = document.getElementById('gameArea');
const gameText = document.getElementById('gameText');
const feedback = document.getElementById('feedback');
const instructions = document.getElementById('instructions');
const stageName = document.getElementById('stageName');
const progress = document.getElementById('progress');
const summary = document.getElementById('summary');
const resultsSection = document.getElementById('resultsSection');
const stageChartCanvas = document.getElementById('stageChart');
let stageChart = null;
const stageTabs = [...document.querySelectorAll('.stage-tab')];
const stageIntro = document.getElementById('stageIntro');
const stageIntroTitle = document.getElementById('stageIntroTitle');
const stageIntroText = document.getElementById('stageIntroText');
const continueBtn = document.getElementById('continueBtn');
const stopBtn = document.getElementById('stopBtn');
const skipStageBtn = document.getElementById('skipStageBtn');
const stopStageBtn = document.getElementById('stopStageBtn');
const minDelayInput = document.getElementById('minDelayInput');
const maxDelayInput = document.getElementById('maxDelayInput');
const repeatDelayInput = document.getElementById('repeatDelayInput');
const redDurationInput = document.getElementById('redDurationInput');
const stageRepeatInputs = [
  document.getElementById('stage1RepeatsInput'),
  document.getElementById('stage2RepeatsInput'),
  document.getElementById('stage3RepeatsInput'),
];
const sliderValues = [
  [minDelayInput, document.getElementById('minDelayValue')],
  [maxDelayInput, document.getElementById('maxDelayValue')],
  [repeatDelayInput, document.getElementById('repeatDelayValue')],
  [redDurationInput, document.getElementById('redDurationValue')],
  ...stageRepeatInputs.map((input, index) => [input, document.getElementById(`stage${index + 1}RepeatsValue`)]),
];

const jumpscareVideo = document.createElement('video');
jumpscareVideo.id = 'jumpscareVideo';
jumpscareVideo.className = 'jumpscare-video';
jumpscareVideo.playsInline = true;
jumpscareVideo.preload = 'auto';
jumpscareVideo.controls = false;
jumpscareVideo.loop = false;
jumpscareVideo.setAttribute('aria-hidden', 'true');

const jumpscareSources = ['./video.mp4', 'file:///Users/ben/Downloads/video.mp4'];
const jumpscareSource = document.createElement('source');
jumpscareSource.src = jumpscareSources[0];
jumpscareSource.type = 'video/mp4';
jumpscareVideo.appendChild(jumpscareSource);
jumpscareVideo.addEventListener('error', () => {
  if (jumpscareVideo.dataset.fallbackUsed === 'true') {
    return;
  }

  jumpscareVideo.dataset.fallbackUsed = 'true';
  const fallbackSource = document.createElement('source');
  fallbackSource.src = jumpscareSources[1];
  fallbackSource.type = 'video/mp4';
  jumpscareVideo.replaceChildren(fallbackSource);
  jumpscareVideo.load();
});
gameArea.appendChild(jumpscareVideo);

const stages = [
  {
    id: 'control',
    name: 'Stage 1: Green control',
    instruction: 'Press Space as soon as the uniform green target appears.',
    colours: ['green'],
    required: { green: 10 },
    responseKeys: { green: 'Space' },
  },
  {
    id: 'selective',
    name: 'Stage 2: Green response with red distractors',
    instruction: 'Press Space only when green appears. Do not press for red.',
    colours: ['red', 'green'],
    required: { green: 10 },
    responseKeys: { green: 'Space' },
  },
  {
    id: 'discrimination',
    name: 'Stage 3: Three-colour discrimination',
    instruction: 'Press Space for green, Enter for blue, and do not press for red.',
    colours: ['red', 'green', 'blue'],
    required: { red: 10, green: 10, blue: 10 },
    responseKeys: { green: 'Space', blue: 'Enter' },
  },
];

const state = {
  phase: 'idle',
  stageIndex: 0,
  counts: {},
  stageCounts: stages.map((stage) => createCounts(stage)),
  records: [],
  timerId: null,
  stimulusStartedAt: 0,
  currentColour: null,
  currentTrial: 0,
  trialId: 0,
  countdownRemaining: 0,
  jumpscareTriggered: false,
  jumpscareTargetTrial: null,
};

function settings() {
  const minimum = Math.max(0, Number(minDelayInput.value) || 0);
  const maximum = Math.max(minimum, Number(maxDelayInput.value) || minimum);
  return {
    minimum,
    maximum,
    repeatDelay: Math.max(0, Number(repeatDelayInput.value) || 0),
    redDuration: Math.max(100, Number(redDurationInput.value) || 1000),
  };
}

function stageRepeatCount(index) {
  return Math.max(1, Number(stageRepeatInputs[index].value) || 10);
}

function updateSliderValue(input, output) {
  const suffix = input.id.includes('Repeats') ? '' : ' ms';
  output.value = `${input.value}${suffix}`;
  output.textContent = `${input.value}${suffix}`;
}

sliderValues.forEach(([input, output]) => {
  updateSliderValue(input, output);
  input.addEventListener('input', () => updateSliderValue(input, output));
});

function scheduleRepeat() {
  clearTimer();
  state.timerId = setTimeout(() => {
    state.timerId = null;
    beginStimulus();
  }, settings().repeatDelay);
}

function currentStage() {
  return stages[state.stageIndex];
}

function randomDelay() {
  const { minimum, maximum } = settings();
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function createCounts(stage) {
  return Object.fromEntries(Object.keys(stage.required).map((colour) => [colour, 0]));
}

function clearTimer() {
  if (state.timerId !== null) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function updateStudyControls(isRunning) {
  startBtn.disabled = isRunning;
  stopBtn.disabled = !isRunning;
  startBtn.textContent = isRunning ? 'Study in progress' : 'Start study';
}

function startCountdown(callback) {
  clearTimer();
  state.phase = 'countdown';
  state.countdownRemaining = 3;
  setPhase('countdown', 'Get ready');

  const tick = () => {
    if (state.phase !== 'countdown') {
      return;
    }

    feedback.textContent = `Get ready: ${state.countdownRemaining}`;
    if (state.countdownRemaining === 0) {
      feedback.textContent = 'Starting…';
      state.timerId = setTimeout(() => {
        state.timerId = null;
        callback();
      }, 250);
      return;
    }

    state.countdownRemaining -= 1;
    state.timerId = setTimeout(tick, 1000);
  };

  tick();
}

function setPhase(phase, text, colour = null) {
  state.phase = phase;
  gameArea.className = `game-area ${phase}`;
  gameText.textContent = '';
  gameText.setAttribute('aria-label', text || '');
  gameText.style.backgroundColor = phase === 'ready' ? colour || '' : '';
  gameArea.style.backgroundColor = '';
}

function updateStatus() {
  const stage = currentStage();
  const requiredTotal = stageRepeatCount(state.stageIndex);
  const completedTotal = Object.values(state.counts).reduce((total, count) => total + count, 0);

  stageName.textContent = stage.name;
  progress.textContent = `${completedTotal} / ${requiredTotal}`;
  instructions.textContent = stage.instruction;
  stageTabs.forEach((tab, index) => {
    tab.classList.toggle('active', index === state.stageIndex);
    tab.classList.toggle('complete', index < state.stageIndex || state.phase === 'complete');
  });
}

function setStage(index, showIntro = true) {
  if (index < 0 || index >= stages.length) {
    return;
  }
  clearTimer();
  state.stageIndex = index;
  state.counts = state.stageCounts[index];
  state.currentColour = null;
  updateStatus();
  if (showIntro) {
    showStageIntro();
  }
}

function recordTrial({ colour, responseKey = '', reactionMs = '', correct, outcome }) {
  state.trialId += 1;
  state.records.push({
    trial: state.trialId,
    stage: currentStage().id,
    colour,
    responseKey,
    correct: correct === true ? 'yes' : correct === false ? 'no' : 'not_applicable',
    outcome,
    reactionMs,
  });
}

function isStageComplete() {
  const completedTotal = Object.values(state.counts).reduce((total, count) => total + count, 0);
  return completedTotal >= stageRepeatCount(state.stageIndex);
}

function maybeTriggerJumpscare() {
  if (state.jumpscareTriggered || state.stageIndex !== 2 || state.jumpscareTargetTrial === null) {
    return;
  }

  if (state.currentTrial !== state.jumpscareTargetTrial) {
    return;
  }

  state.jumpscareTriggered = true;
  gameArea.classList.add('jumpscare');
  jumpscareVideo.currentTime = 0;
  jumpscareVideo.style.display = 'block';
  jumpscareVideo.play().catch(() => {});
  feedback.textContent = 'Unexpected stimulus!';
  setPhase('feedback', 'Unexpected stimulus');
  const overlay = document.createElement('div');
  overlay.className = 'jumpscare-overlay';
  gameArea.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
    jumpscareVideo.style.display = 'none';
    gameArea.classList.remove('jumpscare');
    if (state.phase === 'feedback') {
      setPhase('ready', 'Stimulus', state.currentColour);
    }
  }, 1800);
}

function beginStimulus() {
  const stage = currentStage();
  state.currentColour = stage.colours[Math.floor(Math.random() * stage.colours.length)];
  state.currentTrial += 1;

  if (stage.id === 'discrimination' && state.jumpscareTargetTrial === null) {
    const totalStageTrials = stageRepeatCount(state.stageIndex);
    state.jumpscareTargetTrial = 1 + Math.floor(Math.random() * Math.max(1, totalStageTrials - 1));
  }

  setPhase('waiting', `Trial ${state.currentTrial}`, null);
  updateStatus();

  state.timerId = setTimeout(() => {
    state.timerId = null;
    state.stimulusStartedAt = performance.now();
    setPhase('ready', 'Stimulus', state.currentColour);

    if (state.currentColour === 'red' && (stage.id === 'selective' || stage.id === 'discrimination')) {
      state.timerId = setTimeout(() => {
        state.timerId = null;
        finishNoPress();
      }, settings().redDuration);
    }

    if (stage.id === 'discrimination') {
      maybeTriggerJumpscare();
    }
  }, randomDelay());
}

function startStage() {
  state.counts = state.stageCounts[state.stageIndex];
  state.currentTrial = 0;
  updateStatus();
  showStageIntro();
}

function showStageIntro() {
  clearTimer();
  const stage = currentStage();
  stageIntro.hidden = false;
  stageIntroTitle.textContent = stage.name;
  stageIntroText.textContent = `${stage.instruction} You need ${stageRepeatCount(state.stageIndex)} successful responses in this stage.`;
  continueBtn.textContent = 'Begin';
  setPhase('intro', 'Read the instructions');
  updateStatus();
}

function continueStage() {
  if (state.phase !== 'intro') {
    return;
  }

  stageIntro.hidden = true;
  updateStudyControls(true);
  startCountdown(beginStimulus);
}

function finishStudy() {
  clearTimer();
  stageIntro.hidden = true;
  state.phase = 'complete';
  state.currentColour = null;
  setPhase('complete', 'Study complete');
  stageName.textContent = 'Study complete';
  progress.textContent = 'All stages complete';
  instructions.textContent = 'Download the trial-level data and summary statistics.';
  updateStudyControls(false);
  startBtn.textContent = 'Restart study';
  downloadTrialsBtn.disabled = false;
  downloadSummaryBtn.disabled = false;
  resultsSection.hidden = false;
  renderSummary();
  renderChart();
}

function advanceAfterValidTrial() {
  if (isStageComplete()) {
    if (state.stageIndex === stages.length - 1) {
      finishStudy();
      return;
    }

    state.stageIndex += 1;
    state.counts = state.stageCounts[state.stageIndex];
    feedback.textContent = `${stages[state.stageIndex].name} is ready.`;
    startStage();
    return;
  }

  beginStimulus();
}

function finishNoPress() {
  if (state.phase !== 'ready') {
    return;
  }

  const colour = state.currentColour;
  if (colour === 'red' && currentStage().id === 'selective') {
    recordTrial({ colour, correct: null, outcome: 'distractor_no_press' });
    setPhase('feedback', 'Red ignored');
    window.setTimeout(beginStimulus, settings().repeatDelay);
    return;
  }

  if (colour === 'red' && currentStage().id === 'discrimination') {
    feedback.textContent = 'Red ignored.';
    setPhase('feedback', 'Red ignored');
    scheduleRepeat();
    return;
  }

  recordTrial({ colour, correct: false, outcome: 'missed_response' });
  feedback.textContent = 'No response recorded. The trial will repeat.';
  setPhase('feedback', 'Missed');
  scheduleRepeat();
}

function handleResponse(event) {
  if (event.repeat || !['Space', 'Enter'].includes(event.code)) {
    return;
  }

  if (state.phase === 'waiting') {
    feedback.textContent = 'Early press ignored. Wait for the colour.';
    return;
  }

  if (state.phase !== 'ready') {
    return;
  }

  event.preventDefault();
  clearTimer();

  const colour = state.currentColour;
  const expectedKey = currentStage().responseKeys[colour];
  const reactionMs = Math.round(performance.now() - state.stimulusStartedAt);

  if (colour === 'red' && currentStage().id === 'discrimination') {
    feedback.textContent = 'Red ignored.';
    setPhase('feedback', 'Red ignored');
    scheduleRepeat();
    return;
  }

  if (event.code !== expectedKey) {
    recordTrial({ colour, responseKey: event.code, reactionMs: '', correct: false, outcome: 'incorrect_response' });
    feedback.textContent = 'Incorrect response. The trial will repeat.';
    setPhase('feedback', 'Try again');
    scheduleRepeat();
    return;
  }

  recordTrial({ colour, responseKey: event.code, reactionMs, correct: true, outcome: 'correct_response' });
  state.counts[colour] += 1;
  feedback.textContent = 'Recorded.';
  setPhase('feedback', 'Recorded');
  advanceAfterValidTrial();
}

function resetStudy(showIntro = false) {
  clearTimer();
  state.phase = 'idle';
  state.stageIndex = 0;
  state.stageCounts = stages.map((stage) => createCounts(stage));
  state.counts = state.stageCounts[0];
  state.records = [];
  state.stimulusStartedAt = 0;
  state.currentColour = null;
  state.currentTrial = 0;
  state.trialId = 0;
  state.countdownRemaining = 0;
  state.jumpscareTriggered = false;
  state.jumpscareTargetTrial = null;
  jumpscareVideo.pause();
  jumpscareVideo.currentTime = 0;
  jumpscareVideo.style.display = 'none';
  gameArea.classList.remove('jumpscare');
  updateStudyControls(false);
  downloadTrialsBtn.disabled = true;
  downloadSummaryBtn.disabled = true;
  resultsSection.hidden = true;
  feedback.textContent = '';
  stageIntro.hidden = true;
  setPhase('idle', 'Press Start study');
  updateStatus();
  summary.innerHTML = '<p>Results will appear after the study is complete.</p>';

  if (showIntro) {
    showStageIntro();
  }
}

function stopStudy() {
  if (state.phase === 'idle' || state.phase === 'complete' || state.phase === 'stopped') {
    return;
  }
  clearTimer();
  stageIntro.hidden = true;
  state.phase = 'stopped';
  state.currentColour = null;
  state.jumpscareTriggered = false;
  state.jumpscareTargetTrial = null;
  jumpscareVideo.pause();
  jumpscareVideo.style.display = 'none';
  gameArea.classList.remove('jumpscare');
  setPhase('stopped', 'Study stopped');
  feedback.textContent = 'Study stopped by researcher. Press Resume study to continue.';
  startBtn.textContent = 'Resume study';
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

function skipStage() {
  const nextIndex = Math.min(state.stageIndex + 1, stages.length - 1);
  if (nextIndex === state.stageIndex) {
    finishStudy();
    return;
  }
  setStage(nextIndex);
}

function stopCurrentStage() {
  clearTimer();
  stageIntro.hidden = true;
  state.phase = 'stopped';
  state.currentColour = null;
  state.jumpscareTriggered = false;
  state.jumpscareTargetTrial = null;
  jumpscareVideo.pause();
  jumpscareVideo.style.display = 'none';
  gameArea.classList.remove('jumpscare');
  setPhase('stopped', 'Stage stopped');
  feedback.textContent = 'Current stage stopped. Select another stage or press Resume study.';
  startBtn.textContent = 'Resume study';
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

function reactionRecords() {
  return state.records.filter((record) => record.correct === 'yes' && record.reactionMs !== '');
}

function calculateStats(records) {
  const values = records.map((record) => Number(record.reactionMs));
  if (values.length === 0) {
    return { count: 0, highest: '', lowest: '', average: '', deviation: '' };
  }

  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length);
  return {
    count: values.length,
    highest: Math.max(...values).toFixed(1),
    lowest: Math.min(...values).toFixed(1),
    average: average.toFixed(1),
    deviation: deviation.toFixed(1),
  };
}

function summaryRows() {
  const rows = [];
  stages.forEach((stage) => {
    Object.keys(stage.required).forEach((colour) => {
      if (stage.id === 'discrimination' && colour === 'red') {
        return;
      }
      const records = reactionRecords().filter((record) => record.stage === stage.id && record.colour === colour);
      const stats = calculateStats(records);
      rows.push({ stage: stage.id, colour, ...stats });
    });
  });
  return rows;
}

function renderSummary() {
  const rows = summaryRows();
  summary.innerHTML = `
    <table>
      <thead><tr><th>Stage</th><th>Colour</th><th>Average (ms)</th><th>Highest (ms)</th><th>Lowest (ms)</th><th>Deviation (ms)</th></tr></thead>
      <tbody>${rows.map((row) => `
        <tr><td>${row.stage}</td><td>${row.colour}</td><td>${row.average || '--'}</td><td>${row.highest || '--'}</td><td>${row.lowest || '--'}</td><td>${row.deviation || '--'}</td></tr>
      `).join('')}</tbody>
    </table>
    <p class="note">Red trials in Stage 3 are accuracy-only and therefore have no reaction-time statistics.</p>
  `;
}

function renderChart() {
  const stageRows = stages.map((stage) => {
    const records = reactionRecords().filter((record) => record.stage === stage.id);
    const stats = calculateStats(records);
    return {
      label: stage.name.replace(/^Stage \d+: /, ''),
      average: Number(stats.average) || 0,
      deviation: Number(stats.deviation) || 0,
      highest: Number(stats.highest) || 0,
      lowest: Number(stats.lowest) || 0,
    };
  });

  if (typeof Chart === 'undefined') {
    stageChartCanvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'note',
      textContent: 'The chart library could not be loaded. Use the summary table or CSV export.',
    }));
    return;
  }

  if (stageChart) {
    stageChart.destroy();
  }

  const statisticsOverlay = {
    id: 'statisticsOverlay',
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const yScale = scales.y;
      const bars = chart.getDatasetMeta(0).data;

      ctx.save();
      ctx.lineWidth = 2;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';

      stageRows.forEach((row, index) => {
        const bar = bars[index];
        if (!bar) {
          return;
        }

        const x = bar.x;
        const averageY = yScale.getPixelForValue(row.average);
        const deviationTopY = yScale.getPixelForValue(row.average + row.deviation);
        const deviationBottomY = yScale.getPixelForValue(Math.max(0, row.average - row.deviation));
        const maxY = yScale.getPixelForValue(row.highest);
        const minY = yScale.getPixelForValue(row.lowest);

        ctx.strokeStyle = '#ef5350';
        ctx.beginPath();
        ctx.moveTo(x, deviationTopY);
        ctx.lineTo(x, deviationBottomY);
        ctx.moveTo(x - 7, deviationTopY);
        ctx.lineTo(x + 7, deviationTopY);
        ctx.moveTo(x - 7, deviationBottomY);
        ctx.lineTo(x + 7, deviationBottomY);
        ctx.stroke();

        ctx.fillStyle = '#f5a623';
        ctx.beginPath();
        ctx.moveTo(x, maxY - 7);
        ctx.lineTo(x + 7, maxY + 5);
        ctx.lineTo(x - 7, maxY + 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#28c76f';
        ctx.beginPath();
        ctx.arc(x, minY, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    },
  };

  stageChart = new Chart(stageChartCanvas, {
    type: 'bar',
    data: {
      labels: stageRows.map((row) => row.label),
      datasets: [
        {
          label: 'Average reaction time (ms)',
          data: stageRows.map((row) => row.average),
          backgroundColor: '#1769aa',
        },
      ],
    },
    plugins: [statisticsOverlay],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        subtitle: {
          display: true,
          text: 'Bars: average | whiskers: error variance | triangles: maximum | dots: minimum',
          color: '#5f6b76',
          padding: { bottom: 12 },
        },
        tooltip: {
          callbacks: {
            label: (context) => `Average: ${context.parsed.y.toFixed(1)} ms`,
            afterLabel: (context) => {
              const row = stageRows[context.dataIndex];
              return [
                `Error variance: ±${row.deviation.toFixed(1)} ms`,
                `Maximum: ${row.highest.toFixed(1)} ms`,
                `Minimum: ${row.lowest.toFixed(1)} ms`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(...stageRows.flatMap((row) => [row.highest, row.average + row.deviation])) * 1.1,
          title: { display: true, text: 'Reaction time (ms)' },
        },
      },
    },
  });
}

function updateFullscreenButton() {
  const isFullscreen = document.fullscreenElement !== null;
  const label = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
  fullscreenBtn.setAttribute('aria-label', label);
  fullscreenBtn.title = label;
  fullscreenBtn.querySelector('.fullscreen-label').textContent = isFullscreen ? 'Exit' : 'Fullscreen';
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled) {
    feedback.textContent = 'Fullscreen is not available in this browser.';
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadTrials() {
  const analysisRecords = state.records.filter((record) => !(record.colour === 'red' && record.correct === 'no'));
  downloadCsv('reaction-study-trials.csv', ['trial', 'stage', 'colour', 'response_key', 'correct', 'outcome', 'reaction_ms'], analysisRecords.map((record) => [
    record.trial, record.stage, record.colour, record.responseKey, record.correct, record.outcome, record.reactionMs,
  ]));
}

function downloadSummary() {
  const rows = stages.flatMap((stage) => {
    const stageRecords = reactionRecords().filter((record) => record.stage === stage.id);
    const records = stage.id === 'discrimination'
      ? stageRecords.filter((record) => ['green', 'blue'].includes(record.colour))
      : stageRecords;
    const stats = calculateStats(records);
    return [{
      stage: stage.id,
      colour: stage.id === 'discrimination' ? 'combined' : Object.keys(stage.required)[0],
      ...stats,
    }];
  });

  downloadCsv('reaction-study-summary.csv', ['stage', 'colour', 'average_ms', 'highest_ms', 'lowest_ms', 'deviation_ms'], rows.map((row) => [
    row.stage, row.colour, row.average, row.highest, row.lowest, row.deviation,
  ]));
}

startBtn.addEventListener('click', () => {
  if (state.phase === 'stopped') {
    startStage();
    updateStudyControls(true);
    return;
  }
  if (state.phase === 'idle' || state.phase === 'complete') {
    resetStudy();
    startStage();
    updateStudyControls(true);
  }
});
resetBtn.addEventListener('click', () => resetStudy(true));
stopBtn.addEventListener('click', stopStudy);
skipStageBtn.addEventListener('click', skipStage);
stopStageBtn.addEventListener('click', stopCurrentStage);
stageTabs.forEach((tab) => tab.addEventListener('click', () => setStage(Number(tab.dataset.stage))));
continueBtn.addEventListener('click', continueStage);
downloadTrialsBtn.addEventListener('click', downloadTrials);
downloadSummaryBtn.addEventListener('click', downloadSummary);
fullscreenBtn.addEventListener('click', () => {
  toggleFullscreen().catch(() => {
    feedback.textContent = 'Fullscreen could not be changed.';
  });
});
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('keydown', handleResponse);

resetStudy(true);
