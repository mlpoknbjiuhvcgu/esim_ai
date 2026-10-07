"""
eSIM 推薦 AI - 網頁介面
執行: python app.py
會產生一個公開網址，任何人都可以用瀏覽器開啟
"""

import subprocess
import gradio as gr

OLLAMA = r"C:\Users\user\AppData\Local\Programs\Ollama\ollama.exe"


def ask_esim(message, history: list):
    result = subprocess.run(
        [OLLAMA, "run", "esim-advisor", message],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
    )
    return result.stdout.strip() or "（無回應，請確認 Ollama 正在執行）"


demo = gr.ChatInterface(
    fn=ask_esim,
    title="eSIM 推薦助理",
    description="告訴我你要去哪裡、幾天、用量和預算，我來幫你推薦最划算的 eSIM 方案！",
    examples=[
        "我要去日本7天，每天中度使用，預算NT$500，推薦eSIM",
        "去歐洲14天不想計算流量，哪個方案好？",
        "韓國5天，吃到飽和每日流量哪個划算？",
    ],
)

if __name__ == "__main__":
    demo.launch(share=True)
