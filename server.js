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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

const kimiModelsDir = 'kimi_models';
if (!fs.existsSync(kimiModelsDir)) {
    fs.mkdirSync(kimiModelsDir);
}

app.get('/kimi', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'kimi.html'));
});

// List available Kimi "models" (saved contexts)
app.get('/kimi-models', (req, res) => {
    if (!fs.existsSync(kimiModelsDir)) {
        return res.json([]);
    }
    const files = fs.readdirSync(kimiModelsDir)
        .filter(file => file.endsWith('.txt'))
        .map(file => file.replace('.txt', ''));
    res.json(files);
});

// Endpoint to extract text and SAVE it as a named "model"
app.post('/kimi-upload', upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const modelName = req.body.modelName;
    if (!modelName) {
        return res.status(400).send({ message: 'Model name is required.' });
    }

    const filePath = req.file.path;
    const pythonExecutable = process.env.PYTHON_PATH || path.join(__dirname, 'venv', 'Scripts', 'python');

    const pythonProcess = spawn(pythonExecutable, ['extract_text.py', filePath]);

    let textData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => textData += data.toString());
    pythonProcess.stderr.on('data', (data) => errorData += data.toString());

    pythonProcess.on('close', (code) => {
        // Cleanup uploaded file if desired
        // fs.unlinkSync(filePath); 

        if (code !== 0) {
            res.status(500).json({ message: 'Extraction failed', error: errorData });
        } else {
            const extractedText = textData.trim(); // Trim whitespace
            if (!extractedText) {
                return res.status(500).json({ message: 'Extraction failed: No text found in PDF.' });
            }

            // Save to kimi_models directory
            const savePath = path.join(kimiModelsDir, `${modelName}.txt`);
            try {
                fs.writeFileSync(savePath, extractedText);
                res.json({ message: `Model '${modelName}' created successfully!`, textLength: extractedText.length });
            } catch (err) {
                console.error("Error saving model:", err);
                res.status(500).json({ message: 'Failed to save model context.' });
            }
        }
    });
});

app.post('/api/kimi-chat', async (req, res) => {
    const { prompt, modelName, context } = req.body;

    let contextToUse = context || "";

    // If modelName is provided, load context from file
    if (modelName) {
        const modelPath = path.join(kimiModelsDir, `${modelName}.txt`);
        if (fs.existsSync(modelPath)) {
            try {
                contextToUse = fs.readFileSync(modelPath, 'utf8');
            } catch (err) {
                console.error("Error reading context file:", err);
            }
        }
    }

    // Construct the prompt with context
    const fullPrompt = contextToUse
        ? `Context:\n${contextToUse}\n\nQuestion: ${prompt}\n\nAnswer based on the context above:`
        : prompt;

    try {
        const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "moonshotai/Kimi-K2.5",
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

// --- GPT-2 Routes (Original) ---

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
