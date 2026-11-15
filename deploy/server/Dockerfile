# The live Pyronac site: the backend and the built frontend on one port.
# Made by deploy/publish.py, which puts backend/app and frontend/dist next to this file.
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The data first, so a code-only change reuses this layer.
COPY get_data.py data_url.txt ./
RUN python get_data.py

COPY . /app

CMD ["python", "-m", "uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8080"]
