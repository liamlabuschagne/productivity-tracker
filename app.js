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
            endTime: null,
            estimatedMinutes: durationEstimate,
            actualMinutes: null,
            status: 'in-progress',
            difference: null
        };

        this.activeActivity = activity;
        this.activeActivity.remainingSeconds = durationEstimate * 60;
        
        // Add to activities list immediately with "In Progress" status
        this.activities.unshift(activity);
        this.saveToLocalStorage();
        this.renderActivities();
        
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
                this.stopTitleFlashing();
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
        
        this.activeActivity.endTime = endTime.toISOString();
        this.activeActivity.actualMinutes = parseFloat(actualMinutes.toFixed(2));
        this.activeActivity.status = 'completed';
        
        // Calculate percentage difference
        const difference = ((this.activeActivity.actualMinutes - this.activeActivity.estimatedMinutes) / this.activeActivity.estimatedMinutes) * 100;
        this.activeActivity.difference = parseFloat(difference.toFixed(1));

        // Update the activity in the list (it's already there)
        const activityIndex = this.activities.findIndex(a => a.id === this.activeActivity.id);
        if (activityIndex !== -1) {
            this.activities[activityIndex] = this.activeActivity;
        }
        
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
            const endTime = activity.endTime ? this.formatTime(new Date(activity.endTime)) : '-';
            const diffClass = activity.difference > 0 ? 'difference-negative' : 'difference-positive';
            const diffSign = activity.difference > 0 ? '+' : '';
            const displayStatus = activity.status === 'in-progress' ? 'In Progress' : 
                                 activity.status.charAt(0).toUpperCase() + activity.status.slice(1);
            
            return `
                <tr data-id="${activity.id}">
                    <td class="editable" data-field="name">${this.escapeHtml(activity.name)}</td>
                    <td class="editable" data-field="startTime">${startTime}</td>
                    <td class="editable" data-field="endTime">${endTime}</td>
                    <td class="editable" data-field="estimatedMinutes">${activity.estimatedMinutes}</td>
                    <td class="editable" data-field="actualMinutes">${activity.actualMinutes || '-'}</td>
                    <td class="${diffClass}">${activity.difference !== null ? diffSign + activity.difference + '%' : '-'}</td>
                    <td class="editable status-${activity.status}" data-field="status">${displayStatus}</td>
                    <td>
                        <button class="delete-btn" data-id="${activity.id}" aria-label="Delete activity" title="Delete activity">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Attach event listeners for inline editing
        this.attachEditListeners();
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

    attachEditListeners() {
        const editableCells = document.querySelectorAll('.editable');
        editableCells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                this.makeEditable(e.target);
            });
        });
    }

    makeEditable(cell) {
        // Don't allow editing if already editing
        if (cell.querySelector('input') || cell.querySelector('select')) {
            return;
        }

        const field = cell.dataset.field;
        const row = cell.closest('tr');
        const activityId = parseInt(row.dataset.id);
        const activity = this.activities.find(a => a.id === activityId);
        
        if (!activity) return;

        const currentValue = cell.textContent.trim();
        const originalValue = activity[field];

        // Create appropriate input based on field type
        let input;
        if (field === 'status') {
            input = document.createElement('select');
            input.className = 'edit-select';
            const options = ['in-progress', 'completed'];
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt === 'in-progress' ? 'In Progress' : 'Completed';
                if (activity.status === opt) {
                    option.selected = true;
                }
                input.appendChild(option);
            });
        } else if (field === 'estimatedMinutes' || field === 'actualMinutes') {
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'edit-input';
            input.value = originalValue || '';
            input.min = '0';
            input.step = '0.1';
        } else if (field === 'startTime' || field === 'endTime') {
            input = document.createElement('input');
            input.type = 'datetime-local';
            input.className = 'edit-input';
            if (originalValue) {
                const date = new Date(originalValue);
                // Format for datetime-local input
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'edit-input';
            input.value = originalValue;
        }

        // Replace cell content with input
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();

        // Handle save on blur or enter
        const saveEdit = () => {
            let newValue = input.value.trim();
            
            // Validate and convert based on field type
            if (field === 'estimatedMinutes' || field === 'actualMinutes') {
                newValue = parseFloat(newValue);
                if (isNaN(newValue) || newValue < 0) {
                    alert('Please enter a valid number greater than or equal to 0.');
                    input.focus();
                    return;
                }
            } else if (field === 'startTime' || field === 'endTime') {
                if (newValue) {
                    newValue = new Date(newValue).toISOString();
                } else if (field === 'endTime') {
                    newValue = null;
                } else {
                    alert('Start time is required.');
                    input.focus();
                    return;
                }
            } else if (field === 'name' && !newValue) {
                alert('Activity name cannot be empty.');
                input.focus();
                return;
            }

            // Update the activity
            activity[field] = newValue;
            
            // Recalculate actual minutes and difference if times were changed
            if ((field === 'startTime' || field === 'endTime') && activity.startTime && activity.endTime) {
                const start = new Date(activity.startTime);
                const end = new Date(activity.endTime);
                const actualMinutes = (end - start) / 60000;
                activity.actualMinutes = parseFloat(actualMinutes.toFixed(2));
                
                if (activity.estimatedMinutes) {
                    const difference = ((activity.actualMinutes - activity.estimatedMinutes) / activity.estimatedMinutes) * 100;
                    activity.difference = parseFloat(difference.toFixed(1));
                }
            } else if (field === 'estimatedMinutes' && activity.actualMinutes) {
                const difference = ((activity.actualMinutes - activity.estimatedMinutes) / activity.estimatedMinutes) * 100;
                activity.difference = parseFloat(difference.toFixed(1));
            } else if (field === 'actualMinutes' && activity.estimatedMinutes) {
                const difference = ((activity.actualMinutes - activity.estimatedMinutes) / activity.estimatedMinutes) * 100;
                activity.difference = parseFloat(difference.toFixed(1));
            }
            
            // If status changed to completed and there's an active activity with this ID
            if (field === 'status' && newValue === 'completed' && this.activeActivity && this.activeActivity.id === activityId) {
                this.clearTimer();
                this.stopTitleFlashing();
                this.notificationTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
                this.notificationTimeouts = [];
                this.activeActivity = null;
                document.getElementById('active-section').style.display = 'none';
            }

            this.saveToLocalStorage();
            this.renderActivities();
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            } else if (e.key === 'Escape') {
                this.renderActivities();
            }
        });
    }

    exportToCSV() {
        if (this.activities.length === 0) {
            alert('No activities to export.');
            return;
        }

        const headers = ['Activity', 'Start Time', 'End Time', 'Estimated (min)', 'Actual (min)', 'Difference (%)', 'Status'];
        const rows = this.activities.map(activity => [
            activity.name,
            this.formatTime(new Date(activity.startTime)),
            activity.endTime ? this.formatTime(new Date(activity.endTime)) : '',
            activity.estimatedMinutes,
            activity.actualMinutes || '',
            activity.difference || '',
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
