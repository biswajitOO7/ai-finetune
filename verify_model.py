from transformers import GPT2LMHeadModel, GPT2Tokenizer
import torch

model_path = "./fine_tuned_model"

print(f"Loading model from {model_path}...")
try:
    model = GPT2LMHeadModel.from_pretrained(model_path)
    tokenizer = GPT2Tokenizer.from_pretrained(model_path)
    print("Model and tokenizer loaded successfully.")
except Exception as e:
    print(f"Failed to load model: {e}")
    exit(1)

print("Model loaded. Type your prompt below (or 'exit' to quit):")
print("-" * 50)

while True:
    input_text = input("You: ")
    if input_text.lower() in ['exit', 'quit']:
        break

    input_ids = tokenizer.encode(input_text, return_tensors='pt')
    
    # Create attention mask
    attention_mask = torch.ones(input_ids.shape, dtype=torch.long)

    # Generate output
    output = model.generate(
        input_ids, 
        attention_mask=attention_mask,
        pad_token_id=tokenizer.eos_token_id,
        max_length=100, 
        num_return_sequences=1, 
        do_sample=True,
        top_k=50, 
        top_p=0.95
    )

    generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
    print(f"Model: {generated_text}")
    print("-" * 50)
