import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, Legend,
  DoughnutController, ArcElement,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import './Charts.css';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend, DoughnutController, ArcElement);
ChartJS.defaults.color = '#6d7175';
ChartJS.defaults.font.family = "'Inter', sans-serif";
ChartJS.defaults.font.size = 10;

const lineOpts = () => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: { maxTicksLimit: 6, color: '#8c9196', font: { size: 9 } },
    },
    y: {
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: { maxTicksLimit: 5, color: '#8c9196', font: { size: 9 } },
    },
  },
});

export function TempChart({ labels, data }) {
  const chartData = {
    labels,
    datasets: [{
      label: 'Room Temp °C',
      data,
      borderColor: '#1a1a1a',
      backgroundColor: 'rgba(26,26,26,0.05)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#1a1a1a',
      tension: 0.4,
      fill: true,
    }],
  };
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Room Temp °C — Fire Sensor</span>
        <span className="chart-sub">Last 20 Readings</span>
      </div>
      <div className="chart-body">
        <Line data={chartData} options={lineOpts()} />
      </div>
    </div>
  );
}

export function SmokeChart({ labels, data }) {
  const chartData = {
    labels,
    datasets: [{
      label: 'Smoke Level (MQ2)',
      data,
      borderColor: '#6d7175',
      backgroundColor: 'rgba(109,113,117,0.06)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#6d7175',
      tension: 0.4,
      fill: true,
    }],
  };
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Smoke / Gas Level — MQ2 Sensor</span>
        <span className="chart-sub">Last 20 Readings</span>
      </div>
      <div className="chart-body">
        <Line data={chartData} options={lineOpts()} />
      </div>
    </div>
  );
}

export function SeverityPieChart({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const data = {
    labels: ['Critical', 'High', 'Medium', 'Low', 'Normal'],
    datasets: [{
      data: [counts.CRITICAL || 0, counts.HIGH || 0, counts.MEDIUM || 0, counts.LOW || 0, counts.NORMAL || 0],
      backgroundColor: [
        '#e51c00',
        '#e07d10',
        '#b98900',
        '#007a5a',
        '#c9cccf',
      ],
      borderColor: ['#ffffff','#ffffff','#ffffff','#ffffff','#ffffff'],
      borderWidth: 2,
    }],
  };
  const opts = {
    responsive: true, maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 10, font: { size: 10 }, color: '#6d7175', boxWidth: 10 },
      },
    },
    animation: { duration: 300 },
  };
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Severity Distribution</span>
        <span className="chart-sub">{total} total</span>
      </div>
      <div className="chart-body chart-body--pie">
        <Doughnut data={data} options={opts} />
      </div>
    </div>
  );
}
