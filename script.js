const taskInput = document.querySelector('.taskInput');
const addBtn = document.querySelector('.addBtn');
const tasksList = document.querySelector('.tasks');
const progressBar = document.querySelector('.progressBar');
const motivatorText = document.querySelector('.motivatorText');
const STORAGE_KEY = 'todoTasks';

let taskAmountText = document.querySelector('.taskAmount');
let taskDone = 0;
let taskAmount = 0;

const clickAudio = new Audio("Button Click SFX.mp3");
clickAudio.preload = 'auto';

const taskCompleteAudio = new Audio("Goal SFX.mp3");
taskCompleteAudio.preload = 'auto';

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        addTask();
    }
});

loadTasks();
updateTaskAmount();

function addTask(){
    playClickSound();
    const taskText = taskInput.value.trim();


    if (taskText === "") {
       
        alert("Please enter a task!");
        return;
        
    }
    else{
        const taskItem = createTaskItem(taskText);
        tasksList.appendChild(taskItem);
        taskInput.value = "";
        updateTaskAmount();
    }
}

function createTaskItem(taskText, isCompleted = false) {
    const taskItem = document.createElement('li');
    const taskMain = document.createElement('div');
    taskMain.classList.add('taskMain');

    const checkBtn = document.createElement('button');
    checkBtn.classList.add('checkBtn');
    checkBtn.innerHTML = '<i class="fa-solid fa-check"></i>';

    const taskTextSpan = document.createElement('span');
    taskTextSpan.classList.add('taskText');
    taskTextSpan.textContent = taskText;

    taskMain.appendChild(checkBtn);
    taskMain.appendChild(taskTextSpan);

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

    if (isCompleted) {
        taskItem.classList.add('completed');
    }

    editBtn.addEventListener('click', () => {
        playClickSound();
        const newTaskText = prompt("Edit your task:", taskTextSpan.textContent);
        if (newTaskText !== null && newTaskText.trim() !== "") {
            taskTextSpan.textContent = newTaskText.trim();
            saveTasks();
        }
    });

    checkBtn.addEventListener('click', () => {
        playClickSound();
        taskItem.classList.toggle('completed');
        updateTaskAmount();
        playTaskCompleteSound();
    });

    deleteBtn.addEventListener('click', () => {
        playClickSound();
        tasksList.removeChild(taskItem);
        updateTaskAmount();
    });

    return taskItem;
}

function saveTasks() {
    const tasksData = Array.from(tasksList.querySelectorAll('li')).map((taskItem) => {
        const taskText = taskItem.querySelector('.taskText')?.textContent ?? '';
        return {
            text: taskText,
            completed: taskItem.classList.contains('completed')
        };
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksData));
}

function loadTasks() {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    if (!savedTasks) {
        return;
    }

    try {
        const parsedTasks = JSON.parse(savedTasks);
        if (!Array.isArray(parsedTasks)) {
            return;
        }

        parsedTasks.forEach((task) => {
            if (typeof task.text !== 'string' || task.text.trim() === '') {
                return;
            }

            const taskItem = createTaskItem(task.text, Boolean(task.completed));
            tasksList.appendChild(taskItem);
        });
    } catch {
        localStorage.removeItem(STORAGE_KEY);
    }
}

function updateTaskAmount(){

    taskAmount = tasksList.children.length;
    taskDone = tasksList.querySelectorAll('.completed').length;
    taskAmountText.textContent = `${taskDone}/${taskAmount}`;

    const progressPercent = taskAmount === 0 ? 0 : (taskDone / taskAmount) * 100;
    progressBar.style.width = `${progressPercent}%`;

    if (progressPercent === 100) {
        motivatorText.textContent = "Great job!";
    } else if (progressPercent >= 50) {
        motivatorText.textContent = "Doing well!";
    } else if (progressPercent > 0) {
        motivatorText.textContent = "Keep it up!";
    } else {
        motivatorText.textContent = "Let's start!";
    }

    saveTasks();

}

function playClickSound(){
    clickAudio.currentTime = 0;
    clickAudio.play();
}

function playTaskCompleteSound(){
    taskCompleteAudio.currentTime = 0;
    taskCompleteAudio.play();
}