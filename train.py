import sys
import os
# Set timeout for Hugging Face Hub downloads
os.environ["HF_HUB_TIMEOUT"] = "60"
os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = "60" 

import pdfplumber
import torch
from torch.utils.data import Dataset
from transformers import GPT2Tokenizer, GPT2LMHeadModel, DataCollatorForLanguageModeling, Trainer, TrainingArguments

class CustomTextDataset(Dataset):
    def __init__(self, tokenizer, file_path, block_size=128):
        with open(file_path, encoding="utf-8") as f:
            text = f.read()
        
        # Tokenize the entire text
        self.examples = []
        tokenized_text = tokenizer.encode(text)
        
        # Create examples of block_size
        for i in range(0, len(tokenized_text) - block_size + 1, block_size):
            self.examples.append(tokenized_text[i:i + block_size])

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, item):
        return torch.tensor(self.examples[item], dtype=torch.long)

def extract_text_from_pdf(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text() + "\n"
    return text

def fine_tune_gpt2(pdf_path, model_name="gpt2", output_dir="./fine_tuned_model"):
    print(f"Extracting text from {pdf_path}...")
    try:
        text = extract_text_from_pdf(pdf_path)
    except Exception as e:
        print(f"Error extracting text: {e}")
        return

    train_file = "train.txt"
    with open(train_file, "w", encoding="utf-8") as f:
        f.write(text)
        
    print("Loading model and tokenizer...")
    tokenizer = GPT2Tokenizer.from_pretrained(model_name)
    # Add padding token if it doesn't exist
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = GPT2LMHeadModel.from_pretrained(model_name)
    
    print("Preparing dataset...")
    train_dataset = CustomTextDataset(
        tokenizer=tokenizer,
        file_path=train_file,
        block_size=128
    )
    
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer, mlm=False
    )
    
    training_args = TrainingArguments(
        output_dir=output_dir,

        num_train_epochs=3,
        per_device_train_batch_size=4,
        save_steps=10_000,
        save_total_limit=2,
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        data_collator=data_collator,
        train_dataset=train_dataset,
    )
    
    print("Starting training...")
    trainer.train()
    
    print(f"Saving model to {output_dir}...")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    print("Training finished.") 

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("--output_dir", default="./fine_tuned_model", help="Directory to save the model")
    args = parser.parse_args()
        
    fine_tune_gpt2(args.pdf_path, output_dir=args.output_dir)
