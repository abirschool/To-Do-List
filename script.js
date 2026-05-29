const taskInput = document.querySelector('.taskInput');
const matrixSelect = document.querySelector('.matrixSelect');
const detailsToggleBtn = document.querySelector('.detailsToggleBtn');
const taskDetailsPanel = document.querySelector('.taskDetailsPanel');
const typePills = Array.from(document.querySelectorAll('.typePill'));
const durationChips = Array.from(document.querySelectorAll('.durationChip'));
const durationInput = document.querySelector('.durationInput');
const deadlineInput = document.querySelector('.deadlineInput');
const deadlineContainer = document.querySelector('.deadlineContainer');
const calendarBtn = document.querySelector('.calendarBtn');
const addBtn = document.querySelector('.addBtn');
const priorityToggle = document.querySelector('.priorityToggle');
const priorityModeHint = document.querySelector('.priorityModeHint');
const sortOnceBtn = document.querySelector('.sortOnceBtn');
const alertToggleBtn = document.querySelector('.alertToggleBtn');
const urgencyAlert = document.querySelector('.urgencyAlert');
const urgencyAlertText = document.querySelector('.urgencyAlertText');
const activityMonthRow = document.querySelector('.activityMonthRow');
const activityDayLabels = document.querySelector('.activityDayLabels');
const activityGrid = document.querySelector('.activityGrid');
const activitySummary = document.querySelector('.activitySummary');
const deadlinePresetButtons = Array.from(document.querySelectorAll('.deadlinePresetBtn'));
const taskViewButtons = Array.from(document.querySelectorAll('.taskViewBtn'));
const tasksList = document.querySelector('.tasks');
const progressBar = document.querySelector('.progressBar');
const motivatorText = document.querySelector('.motivatorText');
const taskAmountText = document.querySelector('.taskAmount');

const STORAGE_KEY = 'todoTasksV3';
const PREV_STORAGE_KEY = 'todoTasksV2';
const LEGACY_STORAGE_KEY = 'todoTasks';
const SETTINGS_KEY = 'todoSettingsV1';
const ACTIVITY_KEY = 'todoActivityV1';

const MATRIX_CONFIG = {
    do: { label: 'Do', rank: 4, className: 'matrix-do' },
    schedule: { label: 'Schedule', rank: 3, className: 'matrix-schedule' },
    delegate: { label: 'Delegate', rank: 2, className: 'matrix-delegate' },
    eliminate: { label: 'Eliminate', rank: 1, className: 'matrix-eliminate' }
};

const TASK_TYPE_CONFIG = {
    timeboxed: { label: 'Timeboxed', rank: 2 },
    open: { label: 'Open-ended', rank: 1 }
};

const VIEW_CONFIG = {
    all: { emptyMessage: 'No tasks yet. Add one to get started.' },
    focus: { emptyMessage: 'No focus tasks right now.' },
    overdue: { emptyMessage: 'No overdue tasks. Nice work.' },
    today: { emptyMessage: 'No tasks due today.' },
    week: { emptyMessage: 'No tasks due this week.' },
    completed: { emptyMessage: 'No completed tasks yet.' }
};

let tasks = [];
let isAutoPrioritize = false;
let activeView = 'all';
let dragSourceTaskId = null;
let realtimeIntervalId = null;
let lastRealtimeBucket = -1;
let lastActivityRenderDateKey = '';
let taskEditorOverlay = null;
let activeEditorTaskId = null;
const notifiedStageKeys = new Set();
let popupAlertsEnabled = false;
let activityCountsByDate = {};

const clickAudio = new Audio('Button Click SFX.mp3');
clickAudio.preload = 'auto';

const taskCompleteAudio = new Audio('Goal SFX.mp3');
taskCompleteAudio.preload = 'auto';

addBtn.addEventListener('click', addTaskFromInputs);
calendarBtn.addEventListener('click', openCalendar);
priorityToggle.addEventListener('change', onToggleAutoPriority);
sortOnceBtn.addEventListener('click', onSuggestOrderOnce);
alertToggleBtn.addEventListener('click', onTogglePopupAlerts);
detailsToggleBtn.addEventListener('click', () => {
    setDetailsPanelOpen(!taskDetailsPanel.classList.contains('open'));
});

deadlineContainer.addEventListener('click', (event) => {
    if (event.target.closest('.calendarBtn')) {
        return;
    }
    setDetailsPanelOpen(true);
    showDeadlinePresets();
    openCalendar();
});

deadlineInput.addEventListener('focus', () => {
    setDetailsPanelOpen(true);
    showDeadlinePresets();
});

deadlineInput.addEventListener('blur', () => {
    setTimeout(hideDeadlinePresets, 120);
});

typePills.forEach((pill) => {
    pill.addEventListener('click', () => {
        playClickSound();
        setTaskTypePillState(pill.dataset.type || 'open');
        updateDurationInputVisibility();
    });
});

durationChips.forEach((chip) => {
    chip.addEventListener('click', () => {
        playClickSound();
        setTaskTypePillState('timeboxed');
        updateDurationInputVisibility();
        durationInput.value = chip.dataset.minutes || '';
        syncDurationChipState();
    });
});

durationInput.addEventListener('input', syncDurationChipState);

deadlinePresetButtons.forEach((button) => {
    button.addEventListener('click', () => {
        playClickSound();
        applyDeadlinePreset(button.dataset.preset || 'clear');
    });
});

taskViewButtons.forEach((button) => {
    button.addEventListener('click', () => {
        playClickSound();
        setActiveView(button.dataset.view || 'all');
    });
});

taskInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        addTaskFromInputs();
    }
});

loadSettings();
loadTasks();
loadActivityCounts();
applyOrdering();
setTaskTypePillState('open');
updateDurationInputVisibility();
setDetailsPanelOpen(false);
renderTasks();
updateTaskSummary();
updateAlertToggleButton();
renderActivityHeatmap();
startRealtimeUpdates();
initializeTaskEditor();

function addTaskFromInputs() {
    playClickSound();

    const taskText = taskInput.value.trim();
    if (taskText === '') {
        alert('Please enter a task!');
        return;
    }

    const taskType = getSelectedTaskType();
    const estimateMinutes = taskType === 'timeboxed' ? parseDurationMinutes(durationInput.value) : null;
    const matrix = getValidMatrixValue(matrixSelect.value);
    const dueAt = parseDeadlineInput(deadlineInput.value);
    const timestamp = new Date().toISOString();

    const nextManualOrder = tasks.length === 0
        ? 1
        : Math.max(...tasks.map((task) => task.manualOrder || 0)) + 1;

    const newTask = {
        id: generateTaskId(),
        text: taskText,
        completed: false,
        matrix,
        taskType,
        estimateMinutes,
        dueAt,
        createdAt: timestamp,
        updatedAt: timestamp,
        manualOrder: nextManualOrder
    };

    tasks.push(newTask);

    taskInput.value = '';
    matrixSelect.value = 'schedule';
    setTaskTypePillState('open');
    durationInput.value = '';
    deadlineInput.value = '';
    hideDeadlinePresets();
    updateDurationInputVisibility();

    applyOrdering();
    renderTasks();
    updateTaskSummary();
    updateUrgencyAlert();
    saveTasks();
}

function openCalendar() {
    playClickSound();
    setDetailsPanelOpen(true);
    showDeadlinePresets();

    if (typeof deadlineInput.showPicker === 'function') {
        deadlineInput.showPicker();
    } else {
        deadlineInput.focus();
    }
}

function onToggleAutoPriority() {
    playClickSound();
    isAutoPrioritize = priorityToggle.checked;
    applyOrdering();
    renderTasks();
    updateTaskSummary();
    updateUrgencyAlert();
    saveSettings();
}

function onTogglePopupAlerts() {
    if (!('Notification' in window)) {
        urgencyAlertText.textContent = 'Popup alerts are not supported in this browser.';
        popupAlertsEnabled = false;
        updateAlertToggleButton();
        saveSettings();
        return;
    }

    if (!popupAlertsEnabled) {
        if (Notification.permission === 'granted') {
            popupAlertsEnabled = true;
            updateAlertToggleButton();
            saveSettings();
            return;
        }

        Notification.requestPermission().then((permission) => {
            popupAlertsEnabled = permission === 'granted';
            if (!popupAlertsEnabled) {
                urgencyAlertText.textContent = 'Popup alerts blocked. Enable permission in browser settings if needed.';
            }
            updateAlertToggleButton();
            saveSettings();
        });
        return;
    }

    popupAlertsEnabled = false;
    updateAlertToggleButton();
    saveSettings();
}

function updateAlertToggleButton() {
    if (!alertToggleBtn) {
        return;
    }

    if (!('Notification' in window)) {
        alertToggleBtn.textContent = 'Popup alerts: Unsupported';
        alertToggleBtn.classList.remove('enabled');
        alertToggleBtn.disabled = true;
        return;
    }

    alertToggleBtn.disabled = false;
    alertToggleBtn.classList.toggle('enabled', popupAlertsEnabled);
    alertToggleBtn.textContent = popupAlertsEnabled ? 'Popup alerts: On' : 'Popup alerts: Off';
}

function onSuggestOrderOnce() {
    if (isAutoPrioritize || activeView !== 'all') {
        return;
    }

    playClickSound();

    tasks.sort(compareByPriority);
    tasks.forEach((task, index) => {
        task.manualOrder = index + 1;
        task.updatedAt = new Date().toISOString();
    });

    renderTasks();
    updateTaskSummary();
    updateUrgencyAlert();
    saveTasks();
    priorityModeHint.textContent = 'Suggested order applied once. You are still in manual mode, so drag-and-drop remains available.';
}

function updateDurationInputVisibility() {
    const isTimeboxed = getSelectedTaskType() === 'timeboxed';
    durationInput.classList.toggle('hidden', !isTimeboxed);
    document.querySelector('.durationWrap')?.classList.toggle('hidden', !isTimeboxed);

    if (!isTimeboxed) {
        durationInput.value = '';
    }

    syncDurationChipState();
}

function applyDeadlinePreset(preset) {
    const now = new Date();
    let presetDate = null;

    switch (preset) {
        case 'hour2': {
            presetDate = new Date(now);
            presetDate.setMinutes(0, 0, 0);
            presetDate.setHours(presetDate.getHours() + 2);
            break;
        }
        case 'hour6': {
            presetDate = new Date(now);
            presetDate.setMinutes(0, 0, 0);
            presetDate.setHours(presetDate.getHours() + 6);
            break;
        }
        case 'eod': {
            presetDate = new Date(now);
            presetDate.setHours(23, 0, 0, 0);
            break;
        }
        case 'tomorrow': {
            presetDate = new Date(now);
            presetDate.setDate(presetDate.getDate() + 1);
            presetDate.setHours(9, 0, 0, 0);
            break;
        }
        case 'clear': {
            deadlineInput.value = '';
            return;
        }
        default: {
            return;
        }
    }

    deadlineInput.value = toDatetimeLocalValue(presetDate.toISOString());
}

function setActiveView(view) {
    if (!Object.prototype.hasOwnProperty.call(VIEW_CONFIG, view)) {
        view = 'all';
    }

    activeView = view;

    taskViewButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.view === activeView);
    });

    renderTasks();
}

function setDetailsPanelOpen(isOpen) {
    taskDetailsPanel.classList.toggle('open', isOpen);
    detailsToggleBtn.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) {
        hideDeadlinePresets();
    }
}

function showDeadlinePresets() {
    taskDetailsPanel.classList.add('show-presets');
}

function hideDeadlinePresets() {
    taskDetailsPanel.classList.remove('show-presets');
}

function getSelectedTaskType() {
    const activePill = typePills.find((pill) => pill.classList.contains('active'));
    return getValidTaskType(activePill?.dataset.type || 'open');
}

function setTaskTypePillState(taskType) {
    const normalizedTaskType = getValidTaskType(taskType);
    typePills.forEach((pill) => {
        pill.classList.toggle('active', pill.dataset.type === normalizedTaskType);
    });
}

function syncDurationChipState() {
    const selectedMinutes = String(parseDurationMinutes(durationInput.value) || '');
    durationChips.forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.minutes === selectedMinutes);
    });
}

function renderTasks() {
    tasksList.innerHTML = '';
    const visibleTasks = getVisibleTasks();

    if (visibleTasks.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'emptyTasksMsg';
        emptyMessage.textContent = VIEW_CONFIG[activeView].emptyMessage;
        tasksList.appendChild(emptyMessage);
    } else {
        visibleTasks.forEach((task) => {
            tasksList.appendChild(createTaskItem(task));
        });
    }

    tasksList.classList.toggle('priority-on', isAutoPrioritize);
    updatePriorityModeHint();
    updateUrgencyAlert();
}

function getVisibleTasks() {
    switch (activeView) {
        case 'focus': {
            const now = Date.now();
            const in24Hours = now + (24 * 60 * 60 * 1000);

            return [...tasks]
                .filter((task) => {
                    if (task.completed) {
                        return false;
                    }

                    const status = getDeadlineStatus(task.dueAt);
                    const dueSoon = status.hasDeadline && status.deadlineTimestamp <= in24Hours;
                    const urgentMatrix = getValidMatrixValue(task.matrix) === 'do';
                    const shortTimeboxed = getValidTaskType(task.taskType) === 'timeboxed' && (task.estimateMinutes || 0) > 0 && (task.estimateMinutes || 0) <= 60;

                    return status.isOverdue || dueSoon || urgentMatrix || shortTimeboxed;
                })
                .sort(compareByPriority)
                .slice(0, 3);
        }
        case 'overdue':
            return tasks.filter((task) => !task.completed && getDeadlineStatus(task.dueAt).isOverdue);
        case 'today':
            return tasks.filter((task) => {
                if (task.completed || !task.dueAt || !isValidDateValue(task.dueAt)) {
                    return false;
                }

                const dueDate = new Date(task.dueAt);
                const now = new Date();
                return dueDate.getFullYear() === now.getFullYear()
                    && dueDate.getMonth() === now.getMonth()
                    && dueDate.getDate() === now.getDate();
            });
        case 'week': {
            const now = Date.now();
            const weekAhead = now + (7 * 24 * 60 * 60 * 1000);

            return tasks.filter((task) => {
                if (task.completed || !task.dueAt || !isValidDateValue(task.dueAt)) {
                    return false;
                }
                const dueTimestamp = new Date(task.dueAt).getTime();
                return dueTimestamp >= now && dueTimestamp <= weekAhead;
            });
        }
        case 'completed':
            return tasks.filter((task) => task.completed);
        case 'all':
        default:
            return tasks;
    }
}

function createTaskItem(task) {
    const taskItem = document.createElement('li');
    taskItem.dataset.taskId = task.id;

    if (task.completed) {
        taskItem.classList.add('completed');
    }

    const taskMain = document.createElement('div');
    taskMain.classList.add('taskMain');

    const checkBtn = document.createElement('button');
    checkBtn.classList.add('checkBtn');
    checkBtn.innerHTML = '<i class="fa-solid fa-check"></i>';

    const taskContent = document.createElement('div');
    taskContent.classList.add('taskContent');

    const taskTextSpan = document.createElement('span');
    taskTextSpan.classList.add('taskText');
    taskTextSpan.textContent = task.text;

    const taskMeta = document.createElement('div');
    taskMeta.classList.add('taskMeta');

    const matrixBadge = document.createElement('span');
    const matrixData = MATRIX_CONFIG[getValidMatrixValue(task.matrix)];
    matrixBadge.classList.add('matrixBadge', matrixData.className);
    matrixBadge.textContent = matrixData.label;

    const effortBadge = document.createElement('span');
    effortBadge.classList.add('effortBadge');
    effortBadge.textContent = getEffortLabel(task);

    const deadlineBadge = document.createElement('span');
    deadlineBadge.classList.add('deadlineBadge');

    const countdownBadge = document.createElement('span');
    countdownBadge.classList.add('countdownBadge');

    const deadlineStatus = getDeadlineStatus(task.dueAt);
    taskItem.classList.add(`status-${deadlineStatus.urgencyLevel}`);
    deadlineBadge.classList.add(deadlineStatus.deadlineClassName);
    deadlineBadge.textContent = deadlineStatus.deadlineLabel;

    countdownBadge.classList.add(deadlineStatus.countdownClassName);
    countdownBadge.textContent = deadlineStatus.countdownLabel;

    taskMeta.appendChild(matrixBadge);
    taskMeta.appendChild(effortBadge);
    taskMeta.appendChild(deadlineBadge);
    taskMeta.appendChild(countdownBadge);

    taskContent.appendChild(taskTextSpan);
    taskContent.appendChild(taskMeta);

    taskMain.appendChild(checkBtn);
    taskMain.appendChild(taskContent);

    const taskButtons = document.createElement('div');
    taskButtons.classList.add('taskButtons');

    const editBtn = document.createElement('button');
    editBtn.classList.add('editBtn');
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('deleteBtn');
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

    taskButtons.appendChild(editBtn);
    taskButtons.appendChild(deleteBtn);

    taskItem.appendChild(taskMain);
    taskItem.appendChild(taskButtons);

    checkBtn.addEventListener('click', () => {
        playClickSound();
        toggleTaskCompletion(task.id);
        playTaskCompleteSound();
    });

    editBtn.addEventListener('click', () => {
        playClickSound();
        editTask(task.id);
    });

    deleteBtn.addEventListener('click', () => {
        playClickSound();
        deleteTask(task.id);
    });

    attachDragEvents(taskItem);
    return taskItem;
}

function getEffortLabel(task) {
    const taskType = getValidTaskType(task.taskType);
    if (taskType === 'timeboxed') {
        const minutes = task.estimateMinutes || 0;
        return minutes > 0 ? `Timeboxed ${minutes}m` : 'Timeboxed';
    }
    return 'Open-ended';
}

function canUseManualDrag() {
    return !isAutoPrioritize && activeView === 'all';
}

function attachDragEvents(taskItem) {
    taskItem.draggable = canUseManualDrag();

    taskItem.addEventListener('dragstart', (event) => {
        if (!canUseManualDrag()) {
            event.preventDefault();
            return;
        }

        dragSourceTaskId = taskItem.dataset.taskId;
        taskItem.classList.add('dragging');
        tasksList.classList.add('drag-active');

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', dragSourceTaskId || '');
        }
    });

    taskItem.addEventListener('dragover', (event) => {
        if (!canUseManualDrag() || !dragSourceTaskId || dragSourceTaskId === taskItem.dataset.taskId) {
            return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    });

    taskItem.addEventListener('dragenter', (event) => {
        if (!canUseManualDrag() || !dragSourceTaskId || dragSourceTaskId === taskItem.dataset.taskId) {
            return;
        }

        event.preventDefault();
        taskItem.classList.add('drag-over-slot');
    });

    taskItem.addEventListener('dragleave', () => {
        taskItem.classList.remove('drag-over-slot');
    });

    taskItem.addEventListener('drop', (event) => {
        event.preventDefault();

        if (!canUseManualDrag() || !dragSourceTaskId) {
            clearDragStates();
            return;
        }

        const targetTaskId = taskItem.dataset.taskId;
        if (!targetTaskId || dragSourceTaskId === targetTaskId) {
            clearDragStates();
            return;
        }

        const sourceItem = tasksList.querySelector(`[data-task-id="${CSS.escape(dragSourceTaskId)}"]`);
        const targetItem = tasksList.querySelector(`[data-task-id="${CSS.escape(targetTaskId)}"]`);

        if (!sourceItem || !targetItem) {
            clearDragStates();
            return;
        }

        swapTaskSlotsWithAnimation(sourceItem, targetItem);
        syncManualOrderFromDom();
        saveTasks();
        clearDragStates();
    });

    taskItem.addEventListener('dragend', clearDragStates);
}

function clearDragStates() {
    dragSourceTaskId = null;
    tasksList.classList.remove('drag-active');

    tasksList.querySelectorAll('li').forEach((taskItem) => {
        taskItem.classList.remove('dragging', 'drag-over-slot');
    });
}

function swapTaskSlotsWithAnimation(sourceItem, targetItem) {
    const allItemsBeforeSwap = Array.from(tasksList.querySelectorAll('li'));
    const firstRects = new Map(allItemsBeforeSwap.map((item) => [item, item.getBoundingClientRect()]));

    const sourceNextSibling = sourceItem.nextSibling;
    const targetNextSibling = targetItem.nextSibling;

    if (sourceNextSibling === targetItem) {
        tasksList.insertBefore(targetItem, sourceItem);
    } else if (targetNextSibling === sourceItem) {
        tasksList.insertBefore(sourceItem, targetItem);
    } else {
        tasksList.insertBefore(targetItem, sourceNextSibling);
        tasksList.insertBefore(sourceItem, targetNextSibling);
    }

    Array.from(tasksList.querySelectorAll('li')).forEach((item) => {
        const firstRect = firstRects.get(item);
        if (!firstRect) {
            return;
        }

        const lastRect = item.getBoundingClientRect();
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;

        if (deltaX === 0 && deltaY === 0) {
            return;
        }

        item.style.transition = 'none';
        item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

        requestAnimationFrame(() => {
            item.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
            item.style.transform = '';

            const cleanTransition = () => {
                item.style.transition = '';
                item.removeEventListener('transitionend', cleanTransition);
            };

            item.addEventListener('transitionend', cleanTransition);
        });
    });
}

function syncManualOrderFromDom() {
    const orderedIds = Array.from(tasksList.querySelectorAll('li'))
        .map((item) => item.dataset.taskId)
        .filter(Boolean);

    orderedIds.forEach((taskId, index) => {
        const task = findTaskById(taskId);
        if (!task) {
            return;
        }

        task.manualOrder = index + 1;
        task.updatedAt = new Date().toISOString();
    });

    tasks.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
}

function toggleTaskCompletion(taskId) {
    const task = findTaskById(taskId);
    if (!task) {
        return;
    }

    const wasCompleted = task.completed;

    task.completed = !task.completed;
    task.updatedAt = new Date().toISOString();

    if (!wasCompleted && task.completed) {
        addActivityCount(1);
    } else if (wasCompleted && !task.completed) {
        addActivityCount(-1);
    }

    applyOrdering();
    renderTasks();
    updateTaskSummary();
    updateUrgencyAlert();
    renderActivityHeatmap();
    saveTasks();
}

function deleteTask(taskId) {
    tasks = tasks.filter((task) => task.id !== taskId);
    normalizeManualOrder();
    applyOrdering();
    renderTasks();
    updateTaskSummary();
    updateUrgencyAlert();
    saveTasks();
}

function editTask(taskId) {
    const task = findTaskById(taskId);
    if (!task || !taskEditorOverlay) {
        return;
    }

    const editorTextInput = taskEditorOverlay.querySelector('.editorTextInput');
    const editorMatrixSelect = taskEditorOverlay.querySelector('.editorMatrixSelect');
    const editorTaskTypeSelect = taskEditorOverlay.querySelector('.editorTaskTypeSelect');
    const editorDurationInput = taskEditorOverlay.querySelector('.editorDurationInput');
    const editorDeadlineInput = taskEditorOverlay.querySelector('.editorDeadlineInput');

    if (!editorTextInput || !editorMatrixSelect || !editorTaskTypeSelect || !editorDurationInput || !editorDeadlineInput) {
        return;
    }

    activeEditorTaskId = taskId;
    editorTextInput.value = task.text;
    editorMatrixSelect.value = getValidMatrixValue(task.matrix);
    editorTaskTypeSelect.value = getValidTaskType(task.taskType);
    editorDurationInput.value = task.estimateMinutes ? String(task.estimateMinutes) : '';
    editorDeadlineInput.value = task.dueAt ? toDatetimeLocalValue(task.dueAt) : '';

    updateEditorDurationInputVisibility();

    taskEditorOverlay.classList.add('open');
    editorTextInput.focus();
    editorTextInput.select();
}

function initializeTaskEditor() {
    taskEditorOverlay = document.createElement('div');
    taskEditorOverlay.className = 'taskEditorOverlay';
    taskEditorOverlay.innerHTML = `
        <div class="taskEditorCard" role="dialog" aria-modal="true" aria-label="Edit task">
            <h2>Edit Task</h2>
            <label>
                Task
                <input type="text" class="editorTextInput" maxlength="240">
            </label>
            <label>
                Eisenhower Matrix
                <select class="editorMatrixSelect">
                    <option value="do">Do (Important + Urgent)</option>
                    <option value="schedule">Schedule (Important)</option>
                    <option value="delegate">Delegate (Urgent)</option>
                    <option value="eliminate">Eliminate (Low Priority)</option>
                </select>
            </label>
            <label>
                Task Type
                <div class="editorEffortRow">
                    <select class="editorTaskTypeSelect">
                        <option value="timeboxed">Timeboxed task (known duration)</option>
                        <option value="open">Open-ended task (unknown duration)</option>
                    </select>
                    <input type="number" class="editorDurationInput" min="5" step="5" placeholder="Minutes">
                </div>
            </label>
            <label>
                Deadline
                <div class="editorDeadlineWrap">
                    <input type="datetime-local" class="editorDeadlineInput">
                    <button type="button" class="editorCalendarBtn" aria-label="Open edit deadline calendar">
                        <i class="fa-regular fa-calendar"></i>
                    </button>
                </div>
            </label>
            <div class="editorActions">
                <button type="button" class="editorCancelBtn">Cancel</button>
                <button type="button" class="editorSaveBtn">Save</button>
            </div>
        </div>
    `;

    document.body.appendChild(taskEditorOverlay);

    const editorTextInput = taskEditorOverlay.querySelector('.editorTextInput');
    const editorTaskTypeSelect = taskEditorOverlay.querySelector('.editorTaskTypeSelect');
    const editorDurationInput = taskEditorOverlay.querySelector('.editorDurationInput');
    const editorDeadlineInput = taskEditorOverlay.querySelector('.editorDeadlineInput');
    const editorDeadlineWrap = taskEditorOverlay.querySelector('.editorDeadlineWrap');
    const editorCalendarBtn = taskEditorOverlay.querySelector('.editorCalendarBtn');
    const editorCancelBtn = taskEditorOverlay.querySelector('.editorCancelBtn');
    const editorSaveBtn = taskEditorOverlay.querySelector('.editorSaveBtn');

    if (editorTaskTypeSelect) {
        editorTaskTypeSelect.addEventListener('change', updateEditorDurationInputVisibility);
    }

    if (editorCalendarBtn && editorDeadlineInput) {
        editorCalendarBtn.addEventListener('click', () => {
            if (typeof editorDeadlineInput.showPicker === 'function') {
                editorDeadlineInput.showPicker();
            } else {
                editorDeadlineInput.focus();
            }
        });
    }

    if (editorDeadlineWrap && editorDeadlineInput) {
        editorDeadlineWrap.addEventListener('click', (event) => {
            if (event.target.closest('.editorCalendarBtn')) {
                return;
            }
            if (typeof editorDeadlineInput.showPicker === 'function') {
                editorDeadlineInput.showPicker();
            } else {
                editorDeadlineInput.focus();
            }
        });
    }

    if (editorCancelBtn) {
        editorCancelBtn.addEventListener('click', closeTaskEditor);
    }

    if (editorSaveBtn) {
        editorSaveBtn.addEventListener('click', saveTaskEditorChanges);
    }

    if (editorTextInput) {
        editorTextInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                saveTaskEditorChanges();
            }
        });
    }

    taskEditorOverlay.addEventListener('click', (event) => {
        if (event.target === taskEditorOverlay) {
            closeTaskEditor();
        }
    });

    if (editorDurationInput) {
        editorDurationInput.classList.add('hidden');
    }
}

function updateEditorDurationInputVisibility() {
    if (!taskEditorOverlay) {
        return;
    }

    const editorTaskTypeSelect = taskEditorOverlay.querySelector('.editorTaskTypeSelect');
    const editorDurationInput = taskEditorOverlay.querySelector('.editorDurationInput');

    if (!editorTaskTypeSelect || !editorDurationInput) {
        return;
    }

    const isTimeboxed = getValidTaskType(editorTaskTypeSelect.value) === 'timeboxed';
    editorDurationInput.classList.toggle('hidden', !isTimeboxed);

    if (!isTimeboxed) {
        editorDurationInput.value = '';
    }
}

function closeTaskEditor() {
    if (!taskEditorOverlay) {
        return;
    }

    taskEditorOverlay.classList.remove('open');
    activeEditorTaskId = null;
}

function saveTaskEditorChanges() {
    if (!taskEditorOverlay || !activeEditorTaskId) {
        return;
    }

    const task = findTaskById(activeEditorTaskId);
    if (!task) {
        closeTaskEditor();
        return;
    }

    const editorTextInput = taskEditorOverlay.querySelector('.editorTextInput');
    const editorMatrixSelect = taskEditorOverlay.querySelector('.editorMatrixSelect');
    const editorTaskTypeSelect = taskEditorOverlay.querySelector('.editorTaskTypeSelect');
    const editorDurationInput = taskEditorOverlay.querySelector('.editorDurationInput');
    const editorDeadlineInput = taskEditorOverlay.querySelector('.editorDeadlineInput');

    if (!editorTextInput || !editorMatrixSelect || !editorTaskTypeSelect || !editorDurationInput || !editorDeadlineInput) {
        closeTaskEditor();
        return;
    }

    const updatedText = editorTextInput.value.trim();
    if (updatedText === '') {
        alert('Task text cannot be empty.');
        editorTextInput.focus();
        return;
    }

    const updatedTaskType = getValidTaskType(editorTaskTypeSelect.value);

    task.text = updatedText;
    task.matrix = getValidMatrixValue(editorMatrixSelect.value);
    task.taskType = updatedTaskType;
    task.estimateMinutes = updatedTaskType === 'timeboxed' ? parseDurationMinutes(editorDurationInput.value) : null;
    task.dueAt = parseDeadlineInput(editorDeadlineInput.value);
    task.updatedAt = new Date().toISOString();

    applyOrdering();
    renderTasks();
    updateTaskSummary();
    updateUrgencyAlert();
    saveTasks();
    closeTaskEditor();
}

function applyOrdering() {
    if (isAutoPrioritize) {
        tasks.sort(compareByPriority);
        return;
    }

    tasks.sort((a, b) => {
        const orderDiff = (a.manualOrder || 0) - (b.manualOrder || 0);
        if (orderDiff !== 0) {
            return orderDiff;
        }
        return compareByCreatedTime(a, b);
    });
}

function compareByPriority(taskA, taskB) {
    if (taskA.completed !== taskB.completed) {
        return taskA.completed ? 1 : -1;
    }

    const statusA = getDeadlineStatus(taskA.dueAt);
    const statusB = getDeadlineStatus(taskB.dueAt);

    if (statusA.isOverdue !== statusB.isOverdue) {
        return statusA.isOverdue ? -1 : 1;
    }

    if (statusA.hasDeadline !== statusB.hasDeadline) {
        return statusA.hasDeadline ? -1 : 1;
    }

    if (statusA.deadlineTimestamp !== statusB.deadlineTimestamp) {
        return statusA.deadlineTimestamp - statusB.deadlineTimestamp;
    }

    const matrixRankA = MATRIX_CONFIG[getValidMatrixValue(taskA.matrix)].rank;
    const matrixRankB = MATRIX_CONFIG[getValidMatrixValue(taskB.matrix)].rank;
    if (matrixRankA !== matrixRankB) {
        return matrixRankB - matrixRankA;
    }

    const typeRankA = TASK_TYPE_CONFIG[getValidTaskType(taskA.taskType)].rank;
    const typeRankB = TASK_TYPE_CONFIG[getValidTaskType(taskB.taskType)].rank;
    if (typeRankA !== typeRankB) {
        return typeRankB - typeRankA;
    }

    if (getValidTaskType(taskA.taskType) === 'timeboxed' && getValidTaskType(taskB.taskType) === 'timeboxed') {
        const minsA = taskA.estimateMinutes || Number.MAX_SAFE_INTEGER;
        const minsB = taskB.estimateMinutes || Number.MAX_SAFE_INTEGER;
        if (minsA !== minsB) {
            return minsA - minsB;
        }
    }

    return compareByCreatedTime(taskA, taskB);
}

function compareByCreatedTime(taskA, taskB) {
    const createdA = new Date(taskA.createdAt).getTime() || 0;
    const createdB = new Date(taskB.createdAt).getTime() || 0;

    if (createdA !== createdB) {
        return createdA - createdB;
    }

    return taskA.id.localeCompare(taskB.id);
}

function updateTaskSummary() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.completed).length;

    taskAmountText.textContent = `${completedTasks}/${totalTasks}`;

    const progressPercent = totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100;
    progressBar.style.width = `${progressPercent}%`;

    if (progressPercent === 100 && totalTasks > 0) {
        motivatorText.textContent = 'Great job!';
    } else if (progressPercent >= 50) {
        motivatorText.textContent = 'Doing well!';
    } else if (progressPercent > 0) {
        motivatorText.textContent = 'Keep it up!';
    } else {
        motivatorText.textContent = "Let's start!";
    }
}

function updatePriorityModeHint() {
    sortOnceBtn.disabled = isAutoPrioritize || activeView !== 'all';

    if (isAutoPrioritize) {
        priorityModeHint.textContent = 'Auto mode: tasks are sorted by deadline, matrix, and task type. Drag and drop is disabled.';
        return;
    }

    if (activeView !== 'all') {
        priorityModeHint.textContent = 'Manual mode with filtered view: drag and drop is disabled. Switch to All to reorder.';
        return;
    }

    priorityModeHint.textContent = 'Manual mode: drag and drop to customize order. Use Suggest order once for a one-time smart sort.';
}

function loadTasks() {
    const v3 = localStorage.getItem(STORAGE_KEY);
    if (v3) {
        try {
            const parsed = JSON.parse(v3);
            if (Array.isArray(parsed)) {
                tasks = parsed.map((task, index) => normalizeTask(task, index + 1));
                normalizeManualOrder();
                return;
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    const v2 = localStorage.getItem(PREV_STORAGE_KEY);
    if (v2) {
        try {
            const parsed = JSON.parse(v2);
            if (Array.isArray(parsed)) {
                tasks = parsed.map((task, index) => normalizeTask(task, index + 1));
                normalizeManualOrder();
                saveTasks();
                return;
            }
        } catch {
            localStorage.removeItem(PREV_STORAGE_KEY);
        }
    }

    migrateLegacyTasks();
}

function migrateLegacyTasks() {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
        tasks = [];
        return;
    }

    try {
        const parsed = JSON.parse(legacyRaw);
        if (!Array.isArray(parsed)) {
            tasks = [];
            return;
        }

        const now = Date.now();
        tasks = parsed
            .filter((task) => typeof task.text === 'string' && task.text.trim() !== '')
            .map((task, index) => {
                const createdAt = new Date(now + index).toISOString();
                return {
                    id: generateTaskId(),
                    text: task.text.trim(),
                    completed: Boolean(task.completed),
                    matrix: 'schedule',
                    taskType: 'open',
                    estimateMinutes: null,
                    dueAt: null,
                    createdAt,
                    updatedAt: createdAt,
                    manualOrder: index + 1
                };
            });

        saveTasks();
    } catch {
        tasks = [];
    }
}

function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) {
        isAutoPrioritize = false;
        priorityToggle.checked = false;
        popupAlertsEnabled = false;
        return;
    }

    try {
        const parsed = JSON.parse(saved);
        isAutoPrioritize = Boolean(parsed.autoPrioritize);
        priorityToggle.checked = isAutoPrioritize;
        popupAlertsEnabled = Boolean(parsed.popupAlertsEnabled);

        if (!('Notification' in window) || Notification.permission !== 'granted') {
            popupAlertsEnabled = false;
        }
    } catch {
        isAutoPrioritize = false;
        priorityToggle.checked = false;
        popupAlertsEnabled = false;
    }
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        autoPrioritize: isAutoPrioritize,
        popupAlertsEnabled
    }));
}

function loadActivityCounts() {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) {
        activityCountsByDate = {};
        return;
    }

    try {
        const parsed = JSON.parse(raw);
        activityCountsByDate = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        activityCountsByDate = {};
    }

    pruneActivityCounts();
}

function saveActivityCounts() {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityCountsByDate));
}

function addActivityCount(delta) {
    const todayKey = getDateKey(new Date());
    const current = Number(activityCountsByDate[todayKey]) || 0;
    const next = Math.max(0, current + delta);

    if (next === 0) {
        delete activityCountsByDate[todayKey];
    } else {
        activityCountsByDate[todayKey] = next;
    }

    pruneActivityCounts();
    saveActivityCounts();
}

function pruneActivityCounts() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 220);

    Object.keys(activityCountsByDate).forEach((dateKey) => {
        const date = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(date.getTime()) || date < cutoff) {
            delete activityCountsByDate[dateKey];
        }
    });
}

function renderActivityHeatmap() {
    if (!activityGrid || !activitySummary || !activityMonthRow || !activityDayLabels) {
        return;
    }

    const totalWeeks = 26;
    const totalDays = totalWeeks * 7;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activityStart = new Date(today);
    activityStart.setDate(today.getDate() - (182 - 1));

    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());

    // Anchor the grid to the current week so "this week" is always visible.
    const calendarEnd = new Date(currentWeekStart);
    calendarEnd.setDate(currentWeekStart.getDate() + 6);

    const calendarStart = new Date(calendarEnd);
    calendarStart.setDate(calendarEnd.getDate() - (totalDays - 1));

    activityGrid.style.gridTemplateColumns = `repeat(${totalWeeks}, minmax(0, 1fr))`;
    activityMonthRow.style.gridTemplateColumns = `repeat(${totalWeeks}, minmax(0, 1fr))`;

    activityMonthRow.innerHTML = '';
    activityDayLabels.innerHTML = '';
    activityGrid.innerHTML = '';

    let activeDays = 0;
    let todayCompletions = 0;
    let thisWeekCompletions = 0;
    let lastMonth = null;
    let lastLabeledWeek = -10;

    dayNames.forEach((name) => {
        const label = document.createElement('span');
        label.className = 'activityDayLabel';
        label.textContent = name;
        activityDayLabels.appendChild(label);
    });

    for (let week = 0; week < totalWeeks; week += 1) {
        const weekDate = new Date(calendarStart);
        weekDate.setDate(calendarStart.getDate() + (week * 7));
        const currentMonth = weekDate.getMonth();

        const monthCell = document.createElement('span');
        monthCell.className = 'activityMonthLabel';
        const isMonthStart = currentMonth !== lastMonth;
        const hasEnoughSpacing = week - lastLabeledWeek >= 3;
        monthCell.textContent = isMonthStart && hasEnoughSpacing ? monthNames[currentMonth] : '';
        if (monthCell.textContent) {
            lastLabeledWeek = week;
        }
        activityMonthRow.appendChild(monthCell);
        lastMonth = currentMonth;
    }

    for (let i = 0; i < totalDays; i += 1) {
        const date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + i);
        const dateKey = getDateKey(date);
        const inWindow = date >= activityStart && date <= today;
        const count = Number(activityCountsByDate[dateKey]) || 0;
        if (inWindow && count > 0) {
            activeDays += 1;
        }

        if (inWindow && dateKey === getDateKey(today)) {
            todayCompletions = count;
        }

        if (inWindow && date >= currentWeekStart && date <= today) {
            thisWeekCompletions += count;
        }

        const cell = document.createElement('span');
        cell.className = `heatCell level-${getHeatLevel(count)}`;
        if (!inWindow) {
            cell.classList.add('outside-window');
        }
        cell.title = `${dateKey}: ${count} completed task${count === 1 ? '' : 's'}`;
        activityGrid.appendChild(cell);
    }

    activitySummary.textContent = `Today: ${todayCompletions} | This week: ${thisWeekCompletions} | ${activeDays} active day${activeDays === 1 ? '' : 's'} in last 6 months`;
    activityGrid.setAttribute('aria-label', `Activity heatmap for the last 6 months ending ${getDateKey(today)}`);
    lastActivityRenderDateKey = getDateKey(today);
}

function getHeatLevel(count) {
    if (count <= 0) {
        return 0;
    }
    if (count === 1) {
        return 1;
    }
    if (count <= 3) {
        return 2;
    }
    if (count <= 5) {
        return 3;
    }
    return 4;
}

function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function normalizeTask(task, fallbackManualOrder) {
    const createdAt = isValidDateValue(task.createdAt)
        ? new Date(task.createdAt).toISOString()
        : new Date().toISOString();

    const dueAt = task.dueAt && isValidDateValue(task.dueAt)
        ? new Date(task.dueAt).toISOString()
        : null;

    return {
        id: typeof task.id === 'string' && task.id.trim() !== '' ? task.id : generateTaskId(),
        text: typeof task.text === 'string' ? task.text.trim() : '',
        completed: Boolean(task.completed),
        matrix: getValidMatrixValue(task.matrix),
        taskType: getValidTaskType(task.taskType),
        estimateMinutes: parseDurationMinutes(task.estimateMinutes),
        dueAt,
        createdAt,
        updatedAt: isValidDateValue(task.updatedAt) ? new Date(task.updatedAt).toISOString() : createdAt,
        manualOrder: Number.isFinite(task.manualOrder) ? Number(task.manualOrder) : fallbackManualOrder
    };
}

function normalizeManualOrder() {
    tasks.sort((a, b) => (a.manualOrder || 0) - (b.manualOrder || 0));
    tasks.forEach((task, index) => {
        task.manualOrder = index + 1;
    });
}

function getValidMatrixValue(value) {
    return Object.prototype.hasOwnProperty.call(MATRIX_CONFIG, value) ? value : 'do';
}

function getValidTaskType(value) {
    return Object.prototype.hasOwnProperty.call(TASK_TYPE_CONFIG, value) ? value : 'open';
}

function parseDurationMinutes(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.round(parsed);
}

function parseDeadlineInput(value) {
    if (!value) {
        return null;
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return parsedDate.toISOString();
}

function toDatetimeLocalValue(isoValue) {
    if (!isoValue || !isValidDateValue(isoValue)) {
        return '';
    }

    const date = new Date(isoValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDeadlineStatus(dueAt) {
    if (!dueAt || !isValidDateValue(dueAt)) {
        return {
            hasDeadline: false,
            isOverdue: false,
            deadlineTimestamp: Number.MAX_SAFE_INTEGER,
            timeUntilMs: Number.MAX_SAFE_INTEGER,
            urgencyLevel: 'normal',
            deadlineLabel: 'No deadline',
            deadlineClassName: 'deadline-none',
            countdownLabel: 'No timer',
            countdownClassName: 'countdown-none'
        };
    }

    const deadlineDate = new Date(dueAt);
    const now = Date.now();
    const deadlineTimestamp = deadlineDate.getTime();
    const distance = deadlineTimestamp - now;
    const absoluteDistance = Math.abs(distance);

    const days = Math.floor(absoluteDistance / 86400000);
    const hours = Math.floor((absoluteDistance % 86400000) / 3600000);
    const minutes = Math.floor((absoluteDistance % 3600000) / 60000);
    const compactTime = `${days}d ${hours}h ${minutes}m`;

    const deadlineLabel = `Due ${deadlineDate.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    })}`;

    if (distance < 0) {
        return {
            hasDeadline: true,
            isOverdue: true,
            deadlineTimestamp,
            timeUntilMs: distance,
            urgencyLevel: 'overdue',
            deadlineLabel,
            deadlineClassName: 'deadline-overdue',
            countdownLabel: `Overdue by ${compactTime}`,
            countdownClassName: 'countdown-overdue'
        };
    }

    if (distance <= 1800000) {
        return {
            hasDeadline: true,
            isOverdue: false,
            deadlineTimestamp,
            timeUntilMs: distance,
            urgencyLevel: 'critical',
            deadlineLabel,
            deadlineClassName: 'deadline-critical',
            countdownLabel: `${compactTime} left`,
            countdownClassName: 'countdown-critical'
        };
    }

    if (distance <= 7200000) {
        return {
            hasDeadline: true,
            isOverdue: false,
            deadlineTimestamp,
            timeUntilMs: distance,
            urgencyLevel: 'soon',
            deadlineLabel,
            deadlineClassName: 'deadline-soon',
            countdownLabel: `${compactTime} left`,
            countdownClassName: 'countdown-soon'
        };
    }

    if (distance <= 86400000) {
        return {
            hasDeadline: true,
            isOverdue: false,
            deadlineTimestamp,
            timeUntilMs: distance,
            urgencyLevel: 'normal',
            deadlineLabel,
            deadlineClassName: 'deadline-soon',
            countdownLabel: `${compactTime} left`,
            countdownClassName: 'countdown-soon'
        };
    }

    return {
        hasDeadline: true,
        isOverdue: false,
        deadlineTimestamp,
        timeUntilMs: distance,
        urgencyLevel: 'normal',
        deadlineLabel,
        deadlineClassName: 'deadline-normal',
        countdownLabel: `${compactTime} left`,
        countdownClassName: 'countdown-normal'
    };
}

function refreshDeadlineBadges() {
    tasksList.querySelectorAll('li').forEach((taskItem) => {
        const taskId = taskItem.dataset.taskId;
        if (!taskId) {
            return;
        }

        const task = findTaskById(taskId);
        if (!task) {
            return;
        }

        const deadlineBadge = taskItem.querySelector('.deadlineBadge');
        const countdownBadge = taskItem.querySelector('.countdownBadge');
        const effortBadge = taskItem.querySelector('.effortBadge');
        if (!deadlineBadge || !countdownBadge || !effortBadge) {
            return;
        }

        const deadlineStatus = getDeadlineStatus(task.dueAt);

        deadlineBadge.classList.remove('deadline-none', 'deadline-normal', 'deadline-soon', 'deadline-critical', 'deadline-overdue');
        deadlineBadge.classList.add(deadlineStatus.deadlineClassName);
        deadlineBadge.textContent = deadlineStatus.deadlineLabel;

        countdownBadge.classList.remove('countdown-none', 'countdown-normal', 'countdown-soon', 'countdown-critical', 'countdown-overdue');
        countdownBadge.classList.add(deadlineStatus.countdownClassName);
        countdownBadge.textContent = deadlineStatus.countdownLabel;

        taskItem.classList.remove('status-normal', 'status-soon', 'status-critical', 'status-overdue');
        taskItem.classList.add(`status-${deadlineStatus.urgencyLevel}`);

        effortBadge.textContent = getEffortLabel(task);

        maybeNotifyTaskUrgency(task, deadlineStatus);
    });
}

function maybeNotifyTaskUrgency(task, status) {
    if (!popupAlertsEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    if (!status.hasDeadline || task.completed || status.urgencyLevel === 'normal') {
        return;
    }

    const stage = status.urgencyLevel;
    const notifyKey = `${task.id}|${task.dueAt || ''}|${stage}`;
    if (notifiedStageKeys.has(notifyKey)) {
        return;
    }

    notifiedStageKeys.add(notifyKey);

    const title = stage === 'overdue'
        ? 'Task overdue'
        : stage === 'critical'
            ? 'Task due very soon'
            : 'Task due soon';

    const body = `${task.text} • ${status.countdownLabel}`;
    new Notification(title, { body, silent: false });
}

function updateUrgencyAlert() {
    if (!urgencyAlert || !urgencyAlertText) {
        return;
    }

    const activeTasks = tasks.filter((task) => !task.completed);
    const rankedByUrgency = activeTasks
        .map((task) => ({ task, status: getDeadlineStatus(task.dueAt) }))
        .filter((entry) => entry.status.hasDeadline)
        .sort((entryA, entryB) => entryA.status.deadlineTimestamp - entryB.status.deadlineTimestamp);

    urgencyAlert.classList.remove('hidden', 'urgency-soon', 'urgency-critical', 'urgency-overdue');

    if (rankedByUrgency.length === 0) {
        urgencyAlert.classList.add('hidden');
        return;
    }

    const top = rankedByUrgency[0];
    if (top.status.urgencyLevel === 'normal') {
        urgencyAlert.classList.add('hidden');
        return;
    }

    urgencyAlert.classList.add(`urgency-${top.status.urgencyLevel}`);

    if (top.status.urgencyLevel === 'overdue') {
        urgencyAlertText.textContent = `Overdue: ${top.task.text} (${top.status.countdownLabel}).`;
    } else if (top.status.urgencyLevel === 'critical') {
        urgencyAlertText.textContent = `Due very soon: ${top.task.text} (${top.status.countdownLabel}).`;
    } else {
        urgencyAlertText.textContent = `Due soon: ${top.task.text} (${top.status.countdownLabel}).`;
    }
}

function startRealtimeUpdates() {
    if (realtimeIntervalId) {
        clearInterval(realtimeIntervalId);
    }

    realtimeIntervalId = setInterval(() => {
        refreshDeadlineBadges();
        updateUrgencyAlert();

        const todayKey = getDateKey(new Date());
        if (todayKey !== lastActivityRenderDateKey) {
            renderActivityHeatmap();
        }

        const currentBucket = Math.floor(Date.now() / 30000);
        if (currentBucket === lastRealtimeBucket) {
            return;
        }

        lastRealtimeBucket = currentBucket;

        if (isAutoPrioritize) {
            applyOrdering();
            renderTasks();
            updateTaskSummary();
            updateUrgencyAlert();
            saveTasks();
            return;
        }

        if (activeView !== 'all') {
            renderTasks();
        }
    }, 1000);
}

function isValidDateValue(value) {
    if (!value) {
        return false;
    }

    const parsedDate = new Date(value);
    return !Number.isNaN(parsedDate.getTime());
}

function findTaskById(taskId) {
    return tasks.find((task) => task.id === taskId);
}

function generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function playClickSound() {
    clickAudio.currentTime = 0;
    clickAudio.play();
}

function playTaskCompleteSound() {
    taskCompleteAudio.currentTime = 0;
    taskCompleteAudio.play();
}
