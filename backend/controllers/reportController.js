/**
 * PyroChain - PDF Report Controller
 */
const PDFDocument = require('pdfkit');
const { FireAlert } = require('../models/FireAlert');

const generateReport = async (req, res) => {
    try {
        const { severity, from, to } = req.query;
        const filter = {};
        if (severity) filter.severity = severity.toUpperCase();
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const alerts = await FireAlert.find(filter).sort({ createdAt: -1 }).limit(200).lean();

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="pyrochain_report_${Date.now()}.pdf"`);
        doc.pipe(res);

        // ── Header ──
        doc.rect(0, 0, 612, 80).fill('#1a1a2e');
        doc.fontSize(22).fillColor('#FF6D00').text('PyroChain — Fire Alert Report', 40, 20);
        doc.fontSize(10).fillColor('#aaaaaa').text(`Generated: ${new Date().toLocaleString()}`, 40, 52);
        doc.fontSize(10).fillColor('#aaaaaa').text(`Total Records: ${alerts.length}`, 400, 52);

        doc.moveDown(3);

        // ── Table header ──
        const tableTop = 100;
        const cellH = 22;
        const cols = [40, 130, 220, 290, 350, 430, 510];
        const headers = ['Time', 'Device', 'Severity', 'Temp °C', 'Smoke', 'Location', 'Status'];

        doc.rect(30, tableTop - 5, 540, cellH).fill('#16213e');
        headers.forEach((h, i) => {
            doc.fontSize(8).fillColor('#FF6D00').text(h, cols[i], tableTop, { width: 80 });
        });

        let y = tableTop + cellH;
        const severityColors = { CRITICAL: '#FF1744', HIGH: '#FF6D00', MEDIUM: '#FFC107', LOW: '#4CAF50', NORMAL: '#607D8B' };

        alerts.forEach((alert, idx) => {
            if (y > 750) { doc.addPage(); y = 40; }

            const bg = idx % 2 === 0 ? '#0f0f1a' : '#12122a';
            doc.rect(30, y - 3, 540, cellH).fill(bg);

            const color = severityColors[alert.severity] || '#ffffff';
            const rowData = [
                new Date(alert.createdAt).toLocaleDateString(),
                (alert.deviceId || '').substring(0, 14),
                alert.severity,
                alert.temperature?.toFixed(1) || '-',
                String(alert.smokeLevel),
                (alert.location || '').substring(0, 15),
                alert.status,
            ];

            rowData.forEach((val, i) => {
                const cellColor = i === 2 ? color : '#cccccc';
                doc.fontSize(7).fillColor(cellColor).text(val, cols[i], y, { width: 85 });
            });

            y += cellH;
        });

        doc.end();
    } catch (err) {
        console.error('[Report] PDF generation error:', err);
        res.status(500).json({ success: false, message: 'Report generation failed.' });
    }
};

module.exports = { generateReport };
