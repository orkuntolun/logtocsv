let parsedDataset = [];
let detectedHeaders = [];
let activeMetrics = new Set();
let availableNumericCols = [];
let chartInstance = null;
let currentBaseFileName = '';
let batchDatasets = {};

const colorPalette = [
  { border: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' },
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' },
  { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
  { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)' },
  { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' }
];

const dropZone = document.getElementById('dropZone');
const filePicker = document.getElementById('filePicker');
const btnSelectFiles = document.getElementById('btnSelectFiles');
const fileStatus = document.getElementById('fileStatus');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const btnClear = document.getElementById('btnClear');
const btnTogglePaste = document.getElementById('btnTogglePaste');
const pasteBox = document.getElementById('pasteBox');
const rawInput = document.getElementById('rawInput');
const btnParse = document.getElementById('btnParse');
const inputStats = document.getElementById('inputStats');
const resultsSection = document.getElementById('resultsSection');
const previewTable = document.getElementById('previewTable');
const outputStats = document.getElementById('outputStats');
const btnDownloadXlsx = document.getElementById('btnDownloadXlsx');
const btnDownloadCsv = document.getElementById('btnDownloadCsv');
const btnCopyTsv = document.getElementById('btnCopyTsv');
const btnCopyJson = document.getElementById('btnCopyJson');
const btnOpenOptions = document.getElementById('btnOpenOptions');
const parseMode = document.getElementById('parseMode');
const customDelim = document.getElementById('customDelim');
const delimSetting = document.getElementById('delimSetting');
const filterErrors = document.getElementById('filterErrors');
const includeSourceCol = document.getElementById('includeSourceCol');
const btnSampleKV = document.getElementById('btnSampleKV');
const btnSampleGPS = document.getElementById('btnSampleGPS');
const metricBadges = document.getElementById('metricBadges');
const btnDownloadChart = document.getElementById('btnDownloadChart');
const btnResetZoom = document.getElementById('btnResetZoom');

btnSelectFiles.addEventListener('click', () => filePicker.click());
btnOpenOptions.addEventListener('click', () => openModal('optionsModal'));

btnTogglePaste.addEventListener('click', () => {
  pasteBox.style.display = pasteBox.style.display === 'none' ? 'flex' : 'none';
  if (pasteBox.style.display === 'flex') rawInput.focus();
});

parseMode.addEventListener('change', () => {
  delimSetting.style.display = parseMode.value === 'delimited' ? 'block' : 'none';
});

['dragenter', 'dragover'].forEach(name => {
  dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(name => {
  dropZone.addEventListener(name, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
});

dropZone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleMultipleFiles(Array.from(e.dataTransfer.files));
  }
});

filePicker.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleMultipleFiles(Array.from(e.target.files));
  }
});

rawInput.addEventListener('input', () => {
  if (currentBaseFileName || Object.keys(batchDatasets).length > 0) {
    currentBaseFileName = '';
    batchDatasets = {};
    fileStatus.style.display = 'none';
    filePicker.value = '';
  }
  const lines = rawInput.value.split('\n').filter(l => l.trim().length > 0);
  inputStats.innerText = `${lines.length} lines`;
});

btnParse.addEventListener('click', parseLogs);

function handleMultipleFiles(files) {
  batchDatasets = {};
  fileStatus.style.display = 'flex';

  if (files.length === 1) {
    const file = files[0];
    currentBaseFileName = file.name.replace(/\.[^/.]+$/, "");
    fileNameDisplay.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    const reader = new FileReader();
    reader.onload = (event) => {
      rawInput.value = event.target.result;
      inputStats.innerText = `${event.target.result.split('\n').length} lines`;
      parseLogs();
    };
    reader.readAsText(file);
    return;
  }

  currentBaseFileName = `batch_${files.length}_files`;
  fileNameDisplay.innerText = `${files.length} files selected (Batch)`;

  let mergedContent = '';
  let readCount = 0;

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      batchDatasets[file.name] = content;
      mergedContent += (mergedContent ? '\n' : '') + content;
      readCount++;

      if (readCount === files.length) {
        rawInput.value = mergedContent;
        inputStats.innerText = `${mergedContent.split('\n').length} lines`;
        parseLogs();
      }
    };
    reader.readAsText(file);
  });
}

function getExportFileName(extension) {
  if (currentBaseFileName) {
    return `${currentBaseFileName}_parsed.${extension}`;
  }
  const now = new Date();
  const d = now.toISOString().slice(0, 10);
  const t = now.toTimeString().slice(0, 5).replace(':', '-');
  return `telemetry_${d}_${t}.${extension}`;
}

btnSampleKV.addEventListener('click', () => {
  currentBaseFileName = 'sample_esp32';
  batchDatasets = {};
  fileStatus.style.display = 'flex';
  fileNameDisplay.innerText = 'Sample: ESP32 Telemetry';
  rawInput.value = `[14:02:01.002] NODE_01 temp=24.2 hum=58.1 volt=3.31 stat=OK
[14:02:02.005] NODE_01 temp=24.4 hum=57.9 volt=3.30 stat=OK
[14:02:03.010] [ERR] packet_crc_corrupted
[14:02:04.015] NODE_01 temp=24.8 hum=57.6 volt=3.29 stat=OK
[14:02:05.020] [DEBUG] wifi_reconnect_attempt
[14:02:06.025] NODE_01 temp=25.3 hum=56.9 volt=3.28 stat=OK
[14:02:07.030] NODE_01 temp=25.7 hum=56.2 volt=3.27 stat=OK
[14:02:08.035] NODE_01 temp=26.1 hum=55.8 volt=3.27 stat=OK`;
  parseLogs();
});

btnSampleGPS.addEventListener('click', () => {
  currentBaseFileName = 'sample_gps';
  batchDatasets = {};
  fileStatus.style.display = 'flex';
  fileNameDisplay.innerText = 'Sample: GPS NMEA';
  rawInput.value = `$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
$GPGGA,123520,4807.042,N,01131.005,E,1,08,0.9,546.1,M,46.9,M,,*42
$DEBUG: satellite locked
$GPGGA,123521,4807.048,N,01131.010,E,1,09,0.8,547.0,M,46.9,M,,*45
$GPGGA,123522,4807.053,N,01131.015,E,1,09,0.8,548.2,M,46.9,M,,*49`;
  parseLogs();
});

btnClear.addEventListener('click', () => {
  rawInput.value = '';
  fileStatus.style.display = 'none';
  fileNameDisplay.innerText = 'No file chosen';
  currentBaseFileName = '';
  batchDatasets = {};
  filePicker.value = '';
  parsedDataset = [];
  detectedHeaders = [];
  activeMetrics.clear();
  availableNumericCols = [];
  resultsSection.style.display = 'none';
  renderTable();
  resetChart();
});

btnResetZoom.addEventListener('click', () => {
  if (chartInstance) chartInstance.resetZoom();
});

function parseLinesToDataset(lines, sourceName = '') {
  const dataset = [];
  const headerSet = new Set();
  const mode = parseMode.value;
  const shouldFilter = filterErrors.checked;
  const withSource = includeSourceCol.checked && Object.keys(batchDatasets).length > 1;

  const timestampRegex = /(?:\[\b)(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,4})?)(?:\]|\b)/;
  const kvRegex = /([a-zA-Z_0-9]+)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/g;

  lines.forEach((line, index) => {
    line = line.trim();
    if (!line) return;

    if (shouldFilter) {
      const upper = line.toUpperCase();
      if (
        upper.includes('[ERR') ||
        upper.includes('ERROR') ||
        upper.includes('[DEBUG') ||
        upper.includes('[WARN') ||
        upper.includes('CRC_') ||
        upper.includes('CORRUPTED') ||
        upper.includes('BOOT_') ||
        upper.includes('_INIT')
      ) {
        return;
      }
    }

    const row = { "#": index + 1 };
    headerSet.add("#");

    if (withSource && sourceName) {
      row["Source_File"] = sourceName;
      headerSet.add("Source_File");
    }

    let cleanLine = line;
    const timeMatch = line.match(timestampRegex);
    if (timeMatch) {
      row["Timestamp"] = timeMatch[1];
      headerSet.add("Timestamp");
      cleanLine = line.replace(timeMatch[0], '').replace(/^\[|\]/g, '').trim();
    }

    if (mode === 'nmea' || (mode === 'auto' && cleanLine.startsWith('$GPGGA'))) {
      if (cleanLine.startsWith('$GPGGA')) {
        const parts = cleanLine.split(',');
        if (parts.length >= 10) {
          row["UTC_Time"] = parts[1];
          row["Latitude"] = parts[2] ? `${parts[2]} ${parts[3]}` : '';
          row["Longitude"] = parts[4] ? `${parts[4]} ${parts[5]}` : '';
          row["Fix_Quality"] = parts[6];
          row["Satellites"] = parts[7];
          row["HDOP"] = parts[8];
          row["Altitude"] = parts[9] ? parts[9] : '';

          ["UTC_Time", "Latitude", "Longitude", "Fix_Quality", "Satellites", "HDOP", "Altitude"].forEach(h => headerSet.add(h));
          dataset.push(row);
          return;
        }
      }
      if (shouldFilter) return;
    }

    if (mode === 'delimited') {
      let sep = customDelim.value || ',';
      if (sep.toLowerCase() === 'tab') sep = '\t';
      else if (sep.toLowerCase() === 'space') sep = ' ';

      const parts = cleanLine.split(sep).map(p => p.trim());
      if (parts.length > 1) {
        parts.forEach((p, idx) => {
          const col = `Col_${idx + 1}`;
          row[col] = p;
          headerSet.add(col);
        });
        dataset.push(row);
        return;
      }
    }

    let match;
    let kvFound = false;
    while ((match = kvRegex.exec(cleanLine)) !== null) {
      const key = match[1];
      const val = match[2].replace(/^["']|["']$/g, '');
      row[key] = val;
      headerSet.add(key);
      kvFound = true;
    }

    if (!kvFound && mode === 'auto') {
      const delims = [',', ';', '\t'];
      for (const d of delims) {
        if (cleanLine.includes(d)) {
          const parts = cleanLine.split(d).map(p => p.trim());
          if (parts.length > 1) {
            parts.forEach((p, idx) => {
              const col = `Col_${idx + 1}`;
              row[col] = p;
              headerSet.add(col);
            });
            kvFound = true;
            break;
          }
        }
      }
    }

    if (!kvFound) {
      row["Raw_Message"] = cleanLine;
      headerSet.add("Raw_Message");
    }

    dataset.push(row);
  });

  return { dataset, headers: Array.from(headerSet) };
}

function parseLogs() {
  const text = rawInput.value.trim();
  if (!text) return;

  const lines = text.split('\n');
  const parsed = parseLinesToDataset(lines);
  parsedDataset = parsed.dataset;
  detectedHeaders = parsed.headers;

  if (parsedDataset.length > 0) {
    resultsSection.style.display = 'flex';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  renderTable();
  outputStats.innerText = `${parsedDataset.length} rows parsed`;
  setupMultiMetricBadges();
}

function renderTable() {
  if (parsedDataset.length === 0) {
    previewTable.innerHTML = '<thead><tr><th>No valid telemetry parsed</th></tr></thead><tbody></tbody>';
    return;
  }

  let thead = '<thead><tr>' + detectedHeaders.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
  const previewRows = parsedDataset.slice(0, 100);
  let tbody = '<tbody>';
  previewRows.forEach(row => {
    tbody += '<tr>' + detectedHeaders.map(h => `<td>${row[h] !== undefined ? row[h] : ''}</td>`).join('') + '</tr>';
  });
  tbody += '</tbody>';

  previewTable.innerHTML = thead + tbody;
}

function setupMultiMetricBadges() {
  metricBadges.innerHTML = '';
  availableNumericCols = [];
  activeMetrics.clear();

  detectedHeaders.forEach(header => {
    if (header === '#' || header === 'Source_File' || header.toLowerCase().includes('time') || header.toLowerCase().includes('message')) return;

    let hasNumber = false;
    for (let r of parsedDataset) {
      if (r[header] !== undefined && !isNaN(parseFloat(r[header])) && isFinite(r[header])) {
        hasNumber = true;
        break;
      }
    }
    if (hasNumber) availableNumericCols.push(header);
  });

  if (availableNumericCols.length === 0) {
    metricBadges.innerHTML = '<span class="hint-text">(No numeric telemetry found)</span>';
    resetChart();
    return;
  }

  activeMetrics.add(availableNumericCols[0]);

  availableNumericCols.forEach((col) => {
    const badge = document.createElement('span');
    badge.className = `metric-badge ${activeMetrics.has(col) ? 'active' : ''}`;
    badge.innerText = col;
    badge.addEventListener('click', () => {
      if (activeMetrics.has(col)) {
        if (activeMetrics.size > 1) activeMetrics.delete(col);
      } else {
        activeMetrics.add(col);
      }
      updateBadgeUI();
      renderMultiChart();
    });
    metricBadges.appendChild(badge);
  });

  renderMultiChart();
}

function updateBadgeUI() {
  const badges = metricBadges.querySelectorAll('.metric-badge');
  badges.forEach(b => {
    if (activeMetrics.has(b.innerText)) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

function renderMultiChart() {
  if (activeMetrics.size === 0) {
    resetChart();
    return;
  }

  const labels = [];
  parsedDataset.forEach(row => {
    labels.push(row["Timestamp"] || row["UTC_Time"] || `#${row["#"]}`);
  });

  const datasets = [];
  let colorIdx = 0;

  activeMetrics.forEach(metric => {
    const color = colorPalette[colorIdx % colorPalette.length];
    const dataPoints = parsedDataset.map(row => {
      const val = parseFloat(row[metric]);
      return isNaN(val) ? null : val;
    });

    datasets.push({
      label: metric,
      data: dataPoints,
      borderColor: color.border,
      backgroundColor: color.bg,
      fill: activeMetrics.size === 1,
      tension: 0.25,
      pointRadius: labels.length > 80 ? 0 : 3,
      pointHoverRadius: 6,
      borderWidth: 2
    });

    colorIdx++;
  });

  const ctx = document.getElementById('telemetryChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { labels: { color: '#334155', font: { size: 12, weight: '600' } } },
        tooltip: { mode: 'index', intersect: false },
        zoom: {
          pan: { enabled: true, mode: 'xy', modifierKey: null },
          zoom: {
            wheel: { enabled: true, speed: 0.08 },
            pinch: { enabled: true },
            mode: 'xy'
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 12, maxRotation: 0 },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        y: {
          ticks: { color: '#64748b' },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        }
      }
    }
  });
}

function resetChart() {
  if (chartInstance) chartInstance.destroy();
  chartInstance = null;
}

btnDownloadChart.addEventListener('click', () => {
  if (!chartInstance) return;
  const a = document.createElement('a');
  a.href = chartInstance.toBase64Image();
  a.download = getExportFileName('png');
  a.click();
});

function formatDatasetForExcel(dataset, headers) {
  return dataset.map(row => {
    const formattedRow = {};
    headers.forEach(h => {
      const val = row[h] !== undefined ? row[h] : '';
      const num = Number(val);
      const isNum = val !== '' && !isNaN(num) && !String(val).startsWith('0x') && !String(val).includes(':');
      formattedRow[h] = isNum ? num : val;
    });
    return formattedRow;
  });
}

btnDownloadXlsx.addEventListener('click', () => {
  if (!parsedDataset.length || typeof XLSX === 'undefined') return;

  const workbook = XLSX.utils.book_new();
  const fileKeys = Object.keys(batchDatasets);

  if (fileKeys.length > 1) {
    const combinedRows = formatDatasetForExcel(parsedDataset, detectedHeaders);
    const combinedSheet = XLSX.utils.json_to_sheet(combinedRows, { header: detectedHeaders });
    XLSX.utils.book_append_sheet(workbook, combinedSheet, "All_Merged");

    fileKeys.forEach((fileName, idx) => {
      const content = batchDatasets[fileName];
      const parsed = parseLinesToDataset(content.split('\n'), fileName);
      const rows = formatDatasetForExcel(parsed.dataset, parsed.headers);
      const sheet = XLSX.utils.json_to_sheet(rows, { header: parsed.headers });
      const cleanSheetName = fileName.replace(/[\\/?*[\]]/g, '').slice(0, 28) || `Sheet_${idx + 1}`;
      XLSX.utils.book_append_sheet(workbook, sheet, cleanSheetName);
    });
  } else {
    const exportRows = formatDatasetForExcel(parsedDataset, detectedHeaders);
    const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: detectedHeaders });
    XLSX.utils.book_append_sheet(workbook, worksheet, "TelemetryData");
  }

  XLSX.writeFile(workbook, getExportFileName('xlsx'));
});

btnDownloadCsv.addEventListener('click', () => {
  if (!parsedDataset.length) return;
  let csvContent = '\uFEFF';
  csvContent += detectedHeaders.map(h => `"${h}"`).join(',') + '\r\n';

  parsedDataset.forEach(row => {
    const line = detectedHeaders.map(h => {
      let val = row[h] !== undefined ? String(row[h]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
    csvContent += line + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', getExportFileName('csv'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

btnCopyTsv.addEventListener('click', () => {
  if (!parsedDataset.length) return;
  let tsvContent = detectedHeaders.join('\t') + '\n';
  parsedDataset.forEach(row => {
    const line = detectedHeaders.map(h => row[h] !== undefined ? String(row[h]).replace(/\t/g, ' ') : '').join('\t');
    tsvContent += line + '\n';
  });

  navigator.clipboard.writeText(tsvContent).then(() => {
    const orig = btnCopyTsv.innerHTML;
    btnCopyTsv.innerText = 'Copied TSV!';
    setTimeout(() => btnCopyTsv.innerHTML = orig, 1800);
  });
});

btnCopyJson.addEventListener('click', () => {
  if (!parsedDataset.length) return;
  navigator.clipboard.writeText(JSON.stringify(parsedDataset, null, 2)).then(() => {
    const orig = btnCopyJson.innerHTML;
    btnCopyJson.innerText = 'Copied JSON!';
    setTimeout(() => btnCopyJson.innerHTML = orig, 1800);
  });
});

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }