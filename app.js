// Productivity Tracker App
class ProductivityTracker {
    constructor() {
        this.activities = [];
        this.activeActivity = null;
        this.timerInterval = null;
        this.audioContext = null;
        this.notificationTimeouts = [];
        this.titleFlashInterval = null;
        this.originalTitle = document.title;
        
        this.init();
    }

    init() {
        this.loadFromLocalStorage();
        this.attachEventListeners();
        this.renderActivities();
    }

    attachEventListeners() {
        document.getElementById('activity-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.startActivity();
        });

        document.getElementById('complete-btn').addEventListener('click', () => {
            this.completeActivity();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportToCSV();
        });

        // Event delegation for delete buttons
        document.getElementById('activities-tbody').addEventListener('click', (e) => {
            const btn = e.target.closest('.delete-btn');
            if (btn) {
                const activityId = parseInt(btn.dataset.id);
                this.deleteActivity(activityId);
            }
        });
    }

    startActivity() {
        if (this.activeActivity) {
            alert('Please complete the current activity before starting a new one.');
            return;
        }

        const activityName = document.getElementById('activity-name').value;
        const durationEstimate = parseInt(document.getElementById('duration-estimate').value);
        
        // Validate duration estimate
        if (isNaN(durationEstimate) || durationEstimate < 1) {
            alert('Please enter a valid duration estimate (minimum 1 minute).');
            return;
        }

        const activity = {
            id: Date.now(),
            name: activityName,
            startTime: new Date().toISOString(),
            estimatedMinutes: durationEstimate,
            actualMinutes: null,
            status: 'active',
            difference: null
        };

        this.activeActivity = activity;
        this.activeActivity.remainingSeconds = durationEstimate * 60;
        
        // Clear form
        document.getElementById('activity-form').reset();
        
        // Show active section
        this.displayActiveActivity();
        
        // Start timer
        this.startTimer();
    }

    displayActiveActivity() {
        const activeSection = document.getElementById('active-section');
        activeSection.style.display = 'block';

        document.getElementById('active-activity-name').textContent = this.activeActivity.name;
        document.getElementById('active-start-time').textContent = this.formatTime(new Date(this.activeActivity.startTime));
        document.getElementById('active-estimate').textContent = this.activeActivity.estimatedMinutes;
        
        this.updateTimerDisplay();
    }

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    startTimer() {
        // Clear any existing timer interval
        this.clearTimer();
        
        this.timerInterval = setInterval(() => {
            // Check if activity is still active
            if (!this.activeActivity) {
                this.clearTimer();
                return;
            }
            
            this.activeActivity.remainingSeconds--;
            
            this.updateTimerDisplay();

            if (this.activeActivity.remainingSeconds === 0) {
                this.timerExpired();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('timer');
        const minutes = Math.floor(Math.abs(this.activeActivity.remainingSeconds) / 60);
        const seconds = Math.abs(this.activeActivity.remainingSeconds) % 60;
        
        const sign = this.activeActivity.remainingSeconds < 0 ? '-' : '';
        timerElement.textContent = `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Update timer class based on remaining time
        timerElement.classList.remove('warning', 'expired');
        if (this.activeActivity.remainingSeconds < 0) {
            timerElement.classList.add('expired');
        } else if (this.activeActivity.remainingSeconds < 60) {
            timerElement.classList.add('warning');
        }
    }

    timerExpired() {
        this.playNotificationSound();
        this.startTitleFlashing();
        // Timer continues running to show negative time
    }

    createBeepOscillator() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }

    playNotificationSound() {
        try {
            // Create AudioContext on first use and reuse it
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Resume AudioContext if it's suspended (browser autoplay policy)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // Play first beep
            this.createBeepOscillator();
            
            // Play second beep after delay
            const timeoutId = setTimeout(() => {
                this.createBeepOscillator();
                
                // Remove this timeout from tracking array
                const index = this.notificationTimeouts.indexOf(timeoutId);
                if (index > -1) {
                    this.notificationTimeouts.splice(index, 1);
                }
            }, 600);
            
            // Track timeout for cleanup
            this.notificationTimeouts.push(timeoutId);
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    }

    startTitleFlashing() {
        // Stop any existing title flashing
        this.stopTitleFlashing();
        
        let isOriginalTitle = true;
        const notificationTitle = '⏰ Time\'s Up!';
        
        // Flash the title every second
        this.titleFlashInterval = setInterval(() => {
            document.title = isOriginalTitle ? notificationTitle : this.originalTitle;
            isOriginalTitle = !isOriginalTitle;
        }, 1000);
    }

    stopTitleFlashing() {
        if (this.titleFlashInterval) {
            clearInterval(this.titleFlashInterval);
            this.titleFlashInterval = null;
            document.title = this.originalTitle;
        }
    }

    completeActivity() {
        if (!this.activeActivity) return;

        this.clearTimer();
        this.stopTitleFlashing();
        
        // Clear any pending notification timeouts
        this.notificationTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.notificationTimeouts = [];

        const endTime = new Date();
        const startTime = new Date(this.activeActivity.startTime);
        const actualMinutes = (endTime - startTime) / 60000; // Convert ms to minutes
        
        this.activeActivity.actualMinutes = parseFloat(actualMinutes.toFixed(2));
        this.activeActivity.status = 'completed';
        
        // Calculate percentage difference
        const difference = ((this.activeActivity.actualMinutes - this.activeActivity.estimatedMinutes) / this.activeActivity.estimatedMinutes) * 100;
        this.activeActivity.difference = parseFloat(difference.toFixed(1));

        // Add to activities list
        this.activities.unshift(this.activeActivity);
        
        // Save to local storage
        this.saveToLocalStorage();
        
        // Clear active activity
        this.activeActivity = null;
        document.getElementById('active-section').style.display = 'none';
        
        // Render activities
        this.renderActivities();
    }

    renderActivities() {
        const tbody = document.getElementById('activities-tbody');
        const noActivities = document.getElementById('no-activities');

        if (this.activities.length === 0) {
            tbody.innerHTML = '';
            noActivities.style.display = 'block';
            return;
        }

        noActivities.style.display = 'none';
        
        tbody.innerHTML = this.activities.map(activity => {
            const startTime = this.formatTime(new Date(activity.startTime));
            const diffClass = activity.difference > 0 ? 'difference-negative' : 'difference-positive';
            const diffSign = activity.difference > 0 ? '+' : '';
            
            return `
                <tr>
                    <td>${this.escapeHtml(activity.name)}</td>
                    <td>${startTime}</td>
                    <td>${activity.estimatedMinutes}</td>
                    <td>${activity.actualMinutes}</td>
                    <td class="${diffClass}">${diffSign}${activity.difference}%</td>
                    <td class="status-${activity.status}">${activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}</td>
                    <td>
                        <button class="delete-btn" data-id="${activity.id}" aria-label="Delete activity" title="Delete activity">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    formatTime(date) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    saveToLocalStorage() {
        localStorage.setItem('productivityTrackerActivities', JSON.stringify(this.activities));
    }

    loadFromLocalStorage() {
        const stored = localStorage.getItem('productivityTrackerActivities');
        if (stored) {
            try {
                this.activities = JSON.parse(stored);
            } catch (error) {
                console.error('Error loading from local storage:', error);
                this.activities = [];
            }
        }
    }

    deleteActivity(activityId) {
        // Find the activity to get its name for the confirmation dialog
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return;

        // Prevent deleting the currently active activity
        if (this.activeActivity && this.activeActivity.id === activityId) {
            alert('Cannot delete an activity that is currently in progress. Please complete or cancel it first.');
            return;
        }

        // Show confirmation dialog (native confirm() treats content as plain text, no XSS risk)
        const confirmed = confirm(`Are you sure you want to delete this activity?\n\nActivity: ${activity.name}`);
        
        if (confirmed) {
            // Remove the activity from the array
            this.activities = this.activities.filter(a => a.id !== activityId);
            
            // Save to local storage
            this.saveToLocalStorage();
            
            // Re-render activities
            this.renderActivities();
        }
    }

    exportToCSV() {
        if (this.activities.length === 0) {
            alert('No activities to export.');
            return;
        }

        const headers = ['Activity', 'Start Time', 'Estimated (min)', 'Actual (min)', 'Difference (%)', 'Status'];
        const rows = this.activities.map(activity => [
            activity.name,
            this.formatTime(new Date(activity.startTime)),
            activity.estimatedMinutes,
            activity.actualMinutes,
            activity.difference,
            activity.status
        ]);

        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(field => {
                // Escape fields that contain commas or quotes
                if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            }).join(',') + '\n';
        });

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `productivity-tracker-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL to prevent memory leaks
        URL.revokeObjectURL(url);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ProductivityTracker();
});
