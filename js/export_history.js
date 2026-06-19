// Export functionality for voting history
document.addEventListener('DOMContentLoaded', function () {
    // Export as PDF
    const pdfExportBtn = document.getElementById('exportPdfBtn');
    if (pdfExportBtn) {
        pdfExportBtn.addEventListener('click', function () {
            exportToPDF();
        });
    }

    // Export as CSV
    const csvExportBtn = document.getElementById('exportCsvBtn');
    if (csvExportBtn) {
        csvExportBtn.addEventListener('click', function () {
            exportToCSV();
        });
    }
});

function exportToPDF() {
    // Show loading state
    const btn = document.getElementById('exportPdfBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg class="animate-spin h-4 w-4 inline mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generating...';
    btn.disabled = true;

    // Fetch voting history data
    fetch('/api/votes/history', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                generatePDFReport(data.votes);
            } else {
                showNotification('Failed to fetch voting history', 'error');
            }
        })
        .catch(error => {
            console.error('Error fetching voting history:', error);
            showNotification('Error generating PDF report', 'error');
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

function generatePDFReport(votes) {
    // Create a simple HTML structure for PDF
    const reportWindow = window.open('', '_blank');
    const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Voting History Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
                h1 { color: #4f46e5; border-bottom: 3px solid #4f46e5; padding-bottom: 10px; }
                .header { text-align: center; margin-bottom: 30px; }
                .meta { color: #64748b; font-size: 14px; margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #4f46e5; color: white; padding: 12px; text-align: left; }
                td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                tr:hover { background: #f8fafc; }
                .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🗳️ VoteSecure Online - Voting History Report</h1>
                <div class="meta">
                    Generated on: ${new Date().toLocaleString()}<br>
                    Total Votes Cast: ${votes.length}
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Election</th>
                        <th>Candidate</th>
                        <th>Date Voted</th>
                        <th>Receipt Hash</th>
                    </tr>
                </thead>
                <tbody>
                    ${votes.map(vote => `
                        <tr>
                            <td>${vote.Election ? vote.Election.title : 'N/A'}</td>
                            <td>${vote.Candidate ? vote.Candidate.name : 'N/A'}</td>
                            <td>${new Date(vote.createdAt).toLocaleDateString()}</td>
                            <td style="font-family: monospace; font-size: 11px;">${vote.receipt_hash ? vote.receipt_hash.substring(0, 16) + '...' : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                <p>This is an official record from VoteSecure Online</p>
                <p>All votes are cryptographically verified and immutable</p>
            </div>
        </body>
        </html>
    `;

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();

    // Trigger print dialog
    setTimeout(() => {
        reportWindow.print();
    }, 500);

    showNotification('PDF report generated successfully', 'success');
}

function exportToCSV() {
    // Show loading state
    const btn = document.getElementById('exportCsvBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg class="animate-spin h-4 w-4 inline mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Exporting...';
    btn.disabled = true;

    // Fetch voting history data
    fetch('/api/votes/history', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                generateCSVFile(data.votes);
            } else {
                showNotification('Failed to fetch voting history', 'error');
            }
        })
        .catch(error => {
            console.error('Error fetching voting history:', error);
            showNotification('Error generating CSV file', 'error');
        })
        .finally(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
}

function generateCSVFile(votes) {
    // CSV Header
    const headers = ['Election Title', 'Candidate Name', 'Date Voted', 'Receipt Hash'];

    // CSV Rows
    const rows = votes.map(vote => [
        vote.Election ? vote.Election.title : 'N/A',
        vote.Candidate ? vote.Candidate.name : 'N/A',
        new Date(vote.createdAt).toLocaleDateString(),
        vote.receipt_hash || 'N/A'
    ]);

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `voting_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('CSV file downloaded successfully', 'success');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        } text-white`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}
