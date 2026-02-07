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

// --- Kimi Routes ---

app.get('/kimi', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'kimi.html'));
});

// Endpoint to extract text from PDF (reuses python machinery or simple script)
app.post('/extract-text', upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const filePath = req.file.path;
    const pythonExecutable = process.env.PYTHON_PATH || path.join(__dirname, 'venv', 'Scripts', 'python');

    // We need a simple script to just dump text. 
    // Let's reuse train.py logic or create a one-liner.
    // Creating a dedicated script is cleaner.
    const pythonProcess = spawn(pythonExecutable, ['extract_text.py', filePath]);

    let textData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => textData += data.toString());
    pythonProcess.stderr.on('data', (data) => errorData += data.toString());

    pythonProcess.on('close', (code) => {
        // Cleanup
        // fs.unlinkSync(filePath); 
        if (code !== 0) {
            res.status(500).json({ message: 'Extraction failed', error: errorData });
        } else {
            res.json({ text: textData.trim() });
        }
    });
});

app.post('/api/kimi-chat', async (req, res) => {
    const { prompt, context } = req.body;

    // Construct the prompt with context
    const fullPrompt = context
        ? `Context:\n${context}\n\nQuestion: ${prompt}\n\nAnswer based on the context above:`
        : prompt;

    try {
        const response = await fetch("https://router.huggingface.co/v1/chat/completions", { // Updated per user instruction base_url
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`, // Use env var for token
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "moonshotai/Kimi-K2.5", // Correct model ID from router
                messages: [
                    { role: "user", content: fullPrompt }
                ],
                max_tokens: 500,
                stream: false
            })
        });

        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON response:", text);
            return res.status(500).json({ message: "Invalid response from Kimi API" });
        }

        if (response.ok) {
            res.json({ response: data.choices[0].message.content });
        } else {
            res.status(response.status).json({ message: data || "API Error" });
        }
    } catch (error) {
        console.error("Kimi API Error:", error);
        res.status(500).json({ message: "Failed to connect to Kimi API" });
    }
});

// Create models directory
const modelsDir = 'models';
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir);
}



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
