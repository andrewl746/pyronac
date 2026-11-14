"""Downloader checks using simulated HTTP responses; no external requests."""
import argparse
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx

import config
import download

CSV = b"latitude,longitude,acq_date,acq_time,confidence,frp\n62,-115,2023-07-01,0606,n,10\n"


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.raw = self.root / "data/raw"
        for name, value in (("ROOT", self.root), ("RAW_DIR", self.raw)):
            mock = patch.object(config, name, value)
            mock.start()
            self.addCleanup(mock.stop)

    def client(self, handler):
        client = httpx.Client(transport=httpx.MockTransport(handler))
        self.addCleanup(client.close)
        return client

    def test_2023_pair_then_second_run_makes_no_requests(self):
        requests = []

        def respond(request):
            requests.append(str(request.url))
            return httpx.Response(200, content=CSV)

        client = self.client(respond)
        for source in ("modis", "viirs-snpp"):
            self.assertTrue(download.download_one(client, "canada", source, 2023))
            target = self.raw / source / f"{source}_2023_Canada.csv"
            self.assertEqual(target.read_bytes(), CSV)
        for source in ("modis", "viirs-snpp"):
            self.assertFalse(download.download_one(client, "canada", source, 2023))
        self.assertEqual(len(requests), 2)
        self.assertTrue(requests[0].endswith("/modis/2023/modis_2023_Canada.csv"))
        self.assertFalse(list(self.raw.rglob("*.part")))

    def test_empty_existing_file_is_replaced(self):
        target = self.raw / "modis/modis_2023_Canada.csv"
        target.parent.mkdir(parents=True)
        target.touch()
        client = self.client(lambda request: httpx.Response(200, content=CSV))
        self.assertTrue(download.download_one(client, "canada", "modis", 2023))
        self.assertEqual(target.read_bytes(), CSV)

    def test_html_and_empty_responses_never_become_csv(self):
        for body in (b"<html>sign in</html>", b""):
            client = self.client(lambda request: httpx.Response(200, content=body))
            with patch.object(download.time, "sleep"), self.assertRaises(ValueError):
                download.download_one(client, "canada", "modis", 2023)
            self.assertFalse(list(self.raw.rglob("*.csv")))
            self.assertFalse(list(self.raw.rglob("*.part")))

    def test_stream_failure_never_publishes_partial_file(self):
        class BrokenStream(httpx.SyncByteStream):
            def __iter__(self):
                yield CSV
                raise httpx.ReadError("connection interrupted")

        client = self.client(lambda request: httpx.Response(200, stream=BrokenStream()))
        with patch.object(download.time, "sleep"), self.assertRaises(httpx.ReadError):
            download.download_one(client, "canada", "modis", 2023)
        self.assertFalse(list(self.raw.rglob("*.csv")))
        self.assertFalse(list(self.raw.rglob("*.part")))

    def test_404_is_not_retried(self):
        calls = []

        def respond(request):
            calls.append(request)
            return httpx.Response(404)

        with self.assertRaises(httpx.HTTPStatusError):
            download.download_one(self.client(respond), "canada", "modis", 2023)
        self.assertEqual(len(calls), 1)

    def test_temporary_server_error_is_retried(self):
        calls = []

        def respond(request):
            calls.append(request)
            return httpx.Response(503) if len(calls) == 1 else httpx.Response(200, content=CSV)

        with patch.object(download.time, "sleep"):
            self.assertTrue(download.download_one(self.client(respond), "canada", "modis", 2023))
        self.assertEqual(len(calls), 2)

    def test_cli_only_requests_available_source_years(self):
        requests = []

        def respond(request):
            requests.append(str(request.url))
            return httpx.Response(200, content=CSV)

        client = self.client(respond)
        with patch.object(download.httpx, "Client", return_value=client), patch.object(
            download.sys, "argv", ["download.py", "--years", "2003-2025"]
        ):
            self.assertEqual(download.main(), 0)
        self.assertEqual(len(requests), 45)  # 23 MODIS + 14 SNPP + 8 NOAA-20
        self.assertEqual(len(list(self.raw.rglob("*.csv"))), 45)

    def test_argument_validation(self):
        self.assertEqual(list(download.parse_years("2023")), [2023])
        self.assertEqual(list(download.parse_years("2023-2025")), [2023, 2024, 2025])
        for invalid in ("2026", "2025-2023", "2000", "bad", "2003-2012-2025"):
            with self.assertRaises(argparse.ArgumentTypeError):
                download.parse_years(invalid)
        with self.assertRaises(argparse.ArgumentTypeError):
            download.parse_sources("modis,unknown")


if __name__ == "__main__":
    unittest.main()
