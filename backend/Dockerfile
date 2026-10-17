FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATA_DIR=/data ASSETS_DIR=/app/assets
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# modelo pronto do alfabeto/números (ASL Landmark MLP, CC BY-NC 4.0)
COPY download_assets.py .
RUN python download_assets.py /app/assets

COPY app ./app
VOLUME ["/data"]
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
