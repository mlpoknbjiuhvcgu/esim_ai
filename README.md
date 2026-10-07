# eSIM 推薦 AI

An AI assistant fine-tuned to recommend eSIM plans for international travelers. Trained on real pricing data from ChicTrip (去趣), runs locally via Ollama, and served through a Gradio web interface.

## Overview

Choosing the right eSIM depends on destination, trip length, data usage, and budget. This project automates that decision by:

1. **Scraping** live eSIM plan data from ChicTrip
2. **Building** a structured Alpaca-format training dataset
3. **Fine-tuning** Qwen2.5-3B-Instruct via LoRA on Google Colab
4. **Exporting** the model to GGUF format (Q4_K_M)
5. **Deploying** locally with Ollama + Gradio

## Repository Structure

```
esim_ai/
├── scraper/
│   └── chictrip_scraper.py        # Playwright scraper for ChicTrip pricing API
├── dataset/
│   ├── esim_dataset_builder.py    # Generates Alpaca Q&A training samples
│   └── alpaca_esim.json           # Generated training dataset
├── data/
│   ├── chictrip_plans.json        # Structured plan data (output of scraper)
│   └── chictrip_raw.json          # Raw scraped data
├── training/
│   └── esim_finetune_colab.ipynb  # Colab notebook: LoRA fine-tune + GGUF export
├── server/
│   └── app.py                     # Gradio web interface
└── Modelfile                      # Ollama model configuration
```

## Technical Architecture

- **Data collection**: Playwright intercepts ChicTrip's internal `GetProduct` API to extract SKU-level plan data (days, GB, price, network)
- **Dataset**: Rule-based generator creates question-answer pairs covering all combinations of destination × days × usage level × budget
- **Fine-tuning**: Unsloth + LoRA (r=16) on Qwen2.5-3B-Instruct with 4-bit quantization; 3 epochs on T4 GPU (~20 min)
- **Deployment**: GGUF Q4_K_M served via Ollama; Gradio `ChatInterface` calls `ollama run esim-advisor`

## Supported Destinations

Japan · Korea · Thailand · China/HK/Macau · China · Singapore/Malaysia · Vietnam · Philippines · Europe · Australia · Japan+Korea · Asia-wide

## Getting Started

**Requirements:** Python 3.10+, [Ollama](https://ollama.com), Playwright, Gradio

```bash
# Install dependencies
pip install -r requirements.txt
playwright install chromium

# 1. Scrape latest eSIM plans
python scraper/chictrip_scraper.py

# 2. Build training dataset
python dataset/esim_dataset_builder.py

# 3. Fine-tune on Google Colab
#    Upload training/esim_finetune_colab.ipynb and dataset/alpaca_esim.json to Colab
#    Run all cells — downloads the GGUF file at the end

# 4. Place the downloaded .gguf file in the project root, then:
ollama create esim-advisor -f Modelfile

# 5. Launch web interface
python server/app.py
```

The Gradio interface opens at `http://localhost:7860` and generates a public share URL.

## Example Queries

- `我要去日本7天，每天中度使用，預算NT$500，推薦eSIM`
- `去歐洲14天不想計算流量，哪個方案好？`
- `韓國5天，吃到飽和每日流量哪個划算？`

## Notes

- The GGUF model file (`*.gguf`) is excluded from this repository due to size. Generate it via the Colab notebook.
- Pricing data reflects ChicTrip plans at the time of scraping and may become outdated — re-run the scraper periodically.
- The Ollama `Modelfile` system prompt can be customized for a more eSIM-specific persona.

## License

MIT
