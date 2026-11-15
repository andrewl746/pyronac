"""The live server: the backend and the built frontend on one address, with caps on downloads.

The API keeps its /api paths, so the frontend is built with VITE_API_BASE empty.
Run from the folder that holds backend/ and frontend/dist:
    python -m uvicorn serve:app --port 8080

Fly.io bills for data sent out of the server, and has no setting to cap the bill, so the caps live
here. Change the numbers below and publish again.
"""
import json
import os
import sys
import threading
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "backend"))

from app.main import app as site  # noqa: E402  (needs the path above)

# Each visitor (by IP address) may download this many CSV files per hour.
CSV_PER_HOUR = int(os.environ.get("CSV_PER_HOUR", 20))
# Everything the server sends in one calendar month (UTC). Past this the site pauses until the
# 1st of next month. 50 GB costs about $1 at Fly's North America rate.
MONTHLY_GB = float(os.environ.get("MONTHLY_GB", 50))

site.add_middleware(GZipMiddleware, minimum_size=1000)  # the app's script is 1.8 MB, about 0.5 MB zipped
# Mounted last, so every /api route is matched first.
site.mount("/", StaticFiles(directory=HERE / "frontend" / "dist", html=True), name="site")


class Caps:
    """Counts the bytes sent each month and the CSV downloads per visitor, and refuses past the caps."""

    def __init__(self, inner, csv_per_hour, monthly_bytes, clock=time.time):
        self.inner = inner
        self.csv_per_hour = csv_per_hour
        self.monthly_bytes = monthly_bytes
        self.clock = clock
        self.lock = threading.Lock()
        self.month = None
        self.sent = 0
        self.csv_times = defaultdict(deque)  # visitor -> times of their recent CSV downloads

    def _this_month(self):
        return time.strftime("%Y-%m", time.gmtime(self.clock()))

    def _over_budget(self):
        with self.lock:
            if self.month != self._this_month():
                self.month, self.sent = self._this_month(), 0
            return self.sent >= self.monthly_bytes

    def _count(self, n):
        with self.lock:
            self.sent += n

    def _csv_allowed(self, visitor):
        now = self.clock()
        with self.lock:
            times = self.csv_times[visitor]
            while times and times[0] <= now - 3600:
                times.popleft()
            if len(times) >= self.csv_per_hour:
                return False
            times.append(now)
            if len(self.csv_times) > 10_000:  # forget visitors with nothing recent
                for key in [k for k, v in self.csv_times.items() if not v]:
                    del self.csv_times[key]
            return True

    @staticmethod
    def _visitor(scope):
        for name, value in scope.get("headers", []):
            if name == b"fly-client-ip":  # set by Fly's proxy to the visitor's real address
                return value.decode()
        client = scope.get("client")
        return client[0] if client else "unknown"

    @staticmethod
    async def _refuse(send, status, message, is_csv):
        if is_csv:  # a CSV link downloads the body as a file, so make it readable
            body, kind = (message + "\n").encode(), b"text/plain; charset=utf-8"
        else:
            body, kind = json.dumps({"detail": message}).encode(), b"application/json"
        await send({"type": "http.response.start", "status": status,
                    "headers": [(b"content-type", kind), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.inner(scope, receive, send)
        path = scope["path"]
        if path == "/api/health":  # Fly's health check must always get through
            return await self.inner(scope, receive, send)
        is_csv = path.startswith("/api/") and path.endswith(".csv")

        if self._over_budget():
            return await self._refuse(send, 503, "Pyronac has reached its download limit for this month. "
                                      "It will be back on the 1st.", is_csv)
        if is_csv and not self._csv_allowed(self._visitor(scope)):
            return await self._refuse(send, 429, f"Download limit reached: {self.csv_per_hour} CSV files per "
                                      "hour. Please try again later.", is_csv)

        async def counting_send(message):
            if message["type"] == "http.response.body":
                self._count(len(message.get("body", b"")))
            await send(message)

        await self.inner(scope, receive, counting_send)


app = Caps(site, CSV_PER_HOUR, MONTHLY_GB * 1e9)
