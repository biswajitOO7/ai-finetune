import sys
import torch
import os
from transformers import GPT2LMHeadModel, GPT2Tokenizer
import argparse

# Suppress warnings
os.environ["HF_HUB_TIMEOUT"] = "60"
os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = "60"

def generate_response(model_dir, prompt):
    try:
        tokenizer = GPT2Tokenizer.from_pretrained(model_dir)
        model = GPT2LMHeadModel.from_pretrained(model_dir)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    input_ids = tokenizer.encode(prompt, return_tensors='pt')
    
    # Create attention mask
    attention_mask = torch.ones(input_ids.shape, dtype=torch.long)

    # Generate output
    output = model.generate(
        input_ids, 
        attention_mask=attention_mask,
        pad_token_id=tokenizer.eos_token_id,
        max_length=150, 
        num_return_sequences=1, 
        do_sample=True,
        top_k=50, 
        top_p=0.95
    )

    generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
    
    # Remove the prompt from the output to show only the new text
    response = generated_text[len(prompt):].strip()
    print(response)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_dir", required=True, help="Path to the model directory")
    parser.add_argument("--prompt", required=True, help="User prompt")
    args = parser.parse_args()

    if not os.path.exists(args.model_dir):
        print(f"Error: Model directory '{args.model_dir}' not found.")
        sys.exit(1)

    generate_response(args.model_dir, args.prompt)
