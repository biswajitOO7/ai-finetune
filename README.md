# GPT-2 Fine-tuning Application

This guide explains how to run the application and verify its functionality.

## Prerequisites

- **Node.js** installed.
- **Python** installed (must be added to PATH).

## Running the Application

I have created a helper script `setup_and_run.bat` to automate the setup process.

1.  **Open a terminal** in `d:/projects/AI/Fineture`.
2.  **Run the script**:
    ```powershell
    setup_and_run.bat
    ```
    This script will:
    - Create a Python virtual environment (`venv`).
    - Install necessary Python packages (`transformers`, `torch`, `pdfplumber`, etc.).
    - Start the Node.js server.

    *Note: The first run might take a few minutes to install the Python dependencies.*

3.  **Access the App**:
    - Open your browser and go to `http://localhost:3000`.

## Features

### 1. Fine-tuning
- Drag and drop a PDF file into the upload area.
- Enter a **Model Name** (e.g., "Biology").
- Click **Start Fine-tuning**.
- The logs will show progress. Once complete, your model is saved in `models/<ModelName>`.

### 2. Chat Interface
- Use the dropdown menu in the "Chat with Fine-tuned Models" section to select one of your trained models.
- Type your prompt and press "Send". The model will respond based on its training.

## Output Structure
- Models are now saved in the `models/` directory.
- Each fine-tuned model has its own subfolder (e.g., `models/Biology`, `models/Finance`).

## Version Control

To push this project to GitHub:

1.  **Create a new repository** on GitHub.
2.  **Run the following commands** in your terminal (replace `<YOUR_REPO_URL>`):

```powershell
& "C:\Program Files\Git\cmd\git.exe" remote add origin <YOUR_REPO_URL>
& "C:\Program Files\Git\cmd\git.exe" branch -M main
& "C:\Program Files\Git\cmd\git.exe" push -u origin main
```

## Deployment (Hugging Face Spaces)

This project is configured for **Hugging Face Spaces**.

1.  **Create a new Space** on [Hugging Face](https://huggingface.co/new-space).
    -   **SDK**: Docker
    -   **Hardware**: Free CPU basic (2 vCPU, 16GB RAM)
2.  **Connect GitHub**:
    -   Select "Connect to GitHub" (if prompted) or push your code directly to the Space's Git repository.
3.  **Wait for Build**: Hugging Face will automatically build the Docker image and start the app.
4.  **Access**: Your app will be live at `https://huggingface.co/spaces/<username>/<space-name>`.

## Troubleshooting

- If the training fails, the frontend will now display the error logs in the red error box.
- Check the terminal where `node server.js` is running for more detailed output if needed.
- Ensure your PDF is readable and contains text (scanned PDFs without OCR won't work).
