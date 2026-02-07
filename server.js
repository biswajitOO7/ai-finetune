const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 7860;

app.use(cors());
app.use(express.static('public'));
app.use(express.json()); // Added for parsing JSON bodies in /chat

// Create models directory
const modelsDir = 'models';
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir);
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const modelName = req.body.modelName;
    if (!modelName) {
        return res.status(400).send({ message: 'Model name is required.' });
    }

    const filePath = req.file.path;
    const modelOutputDir = path.join(modelsDir, modelName);

    console.log(`File uploaded: ${filePath}, Model Name: ${modelName}`);

    // Spawn Python process
    // Use the python executable from the virtual environment or environment variable
    const pythonExecutable = process.env.PYTHON_PATH || path.join(__dirname, 'venv', 'Scripts', 'python');
    const pythonProcess = spawn(pythonExecutable, ['train.py', filePath, '--output_dir', modelOutputDir]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
        stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        // Cleanup uploaded file
        // fs.unlinkSync(filePath); 

        if (code !== 0) {
            res.status(500).send({
                message: 'Training failed',
                logs: stderrData || stdoutData || 'Unknown error occurred.'
            });
        } else {
            res.send({
                message: 'Training completed',
                logs: stdoutData
            });
        }
    });
});

app.get('/models', (req, res) => {
    if (!fs.existsSync(modelsDir)) {
        return res.json([]);
    }
    const models = fs.readdirSync(modelsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    res.json(models);
});

app.post('/chat', (req, res) => {
    const { modelName, prompt } = req.body;
    if (!modelName || !prompt) {
        return res.status(400).json({ message: 'Model name and prompt are required.' });
    }

    const modelpath = path.join(modelsDir, modelName);
    if (!fs.existsSync(modelpath)) {
        return res.status(404).json({ message: 'Model not found.' });
    }

    const pythonExecutable = process.env.PYTHON_PATH || path.join(__dirname, 'venv', 'Scripts', 'python');
    const pythonProcess = spawn(pythonExecutable, ['chat.py', '--model_dir', modelpath, '--prompt', prompt]);

    let responseText = '';
    let errorText = '';

    pythonProcess.stdout.on('data', (data) => {
        responseText += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Chat stderr: ${data}`);
        errorText += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            res.status(500).json({ message: 'Chat generation failed', error: errorText });
        } else {
            res.json({ response: responseText.trim() });
        }
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
