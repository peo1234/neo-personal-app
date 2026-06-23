#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


HOST = os.getenv("NEO_API_HOST", "127.0.0.1")
PORT = int(os.getenv("NEO_API_PORT", "8787"))
TOKEN = os.getenv("NEO_API_TOKEN", "")
JOB_ID = os.getenv("NEO_HERMES_JOB_ID", "b8ade3a0a21d")
JOBS_FILE = Path(os.getenv("NEO_HERMES_JOBS_FILE", "/home/admin/.hermes/cron/jobs.json"))
HERMES_AGENT = Path(os.getenv("NEO_HERMES_AGENT", "/home/admin/.hermes/hermes-agent"))
TZ = ZoneInfo(os.getenv("NEO_TIMEZONE", "Asia/Shanghai"))
DATA_DIR = Path(os.getenv("NEO_DATA_DIR", "/home/admin/neo-api/data"))
OUTPUT_DIR = Path(os.getenv("NEO_HERMES_OUTPUT_DIR", f"/home/admin/.hermes/cron/output/{JOB_ID}"))
RECORDS_FILE = DATA_DIR / "push_records.json"
SYNC_SECONDS = int(os.getenv("NEO_SYNC_SECONDS", "1800"))


def ensure_data_dir() -> None:
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  if not RECORDS_FILE.exists():
    RECORDS_FILE.write_text("[]", encoding="utf-8")


def load_job() -> dict[str, Any]:
  with JOBS_FILE.open("r", encoding="utf-8") as file:
    data = json.load(file)
  jobs = data if isinstance(data, list) else data.get("jobs", [])
  for job in jobs:
    if job.get("id") == JOB_ID:
      return job
  raise RuntimeError(f"Hermes job not found: {JOB_ID}")


def load_records() -> list[dict[str, Any]]:
  ensure_data_dir()
  try:
    with RECORDS_FILE.open("r", encoding="utf-8") as file:
      data = json.load(file)
    return data if isinstance(data, list) else []
  except json.JSONDecodeError:
    return []


def save_records(records: list[dict[str, Any]]) -> None:
  ensure_data_dir()
  RECORDS_FILE.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def format_time(value: str | None) -> str:
  if not value:
    return "\u6682\u65e0"
  try:
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).astimezone(TZ).strftime("%m-%d %H:%M")
  except ValueError:
    return value


def record_id(value: str) -> str:
  return re.sub(r"[^0-9A-Za-z]+", "-", value).strip("-") or str(int(time.time()))


def schedule_text(job: dict[str, Any]) -> str:
  schedule = job.get("schedule") or {}
  expr = schedule.get("expr") or job.get("schedule_display") or ""
  if expr == "30 0 * * *":
    return "08:30"
  if expr == "30 23 * * *":
    return "07:30"
  return job.get("schedule_display") or expr or "\u5df2\u914d\u7f6e"


def latest_output_file() -> Path | None:
  if not OUTPUT_DIR.exists():
    return None
  files = sorted(OUTPUT_DIR.glob("*.md"), key=lambda item: item.stat().st_mtime, reverse=True)
  return files[0] if files else None


def extract_report(markdown: str) -> str:
  marker = "## Response"
  if marker in markdown:
    return markdown.split(marker, 1)[1].strip()
  return markdown.strip()


def excerpt_for(content: str) -> str:
  lines = [line.strip("#* `") for line in content.splitlines() if line.strip()]
  body = " ".join(lines[:4])
  return body[:180] + ("..." if len(body) > 180 else "")


def materialize_latest_record() -> dict[str, Any] | None:
  job = load_job()
  last_run_at = job.get("last_run_at")
  if not last_run_at:
    return None

  current_id = record_id(last_run_at)
  records = load_records()
  existing = next((item for item in records if item.get("id") == current_id and item.get("jobId") == JOB_ID), None)
  output = latest_output_file()
  content = extract_report(output.read_text(encoding="utf-8")) if output else ""

  record = {
    "id": current_id,
    "jobId": JOB_ID,
    "title": job.get("name") or "Neo Daily",
    "createdAt": format_time(last_run_at),
    "status": job.get("last_status") or "unknown",
    "channel": "\u98de\u4e66",
    "content": content,
    "excerpt": excerpt_for(content),
  }

  if existing:
    existing.update(record)
  else:
    records.insert(0, record)
  save_records(records[:50])
  return record


def records_payload() -> dict[str, Any]:
  materialize_latest_record()
  records = [item for item in load_records() if item.get("jobId") == JOB_ID]
  hydrated = [dict(record) for record in records]
  return {"records": hydrated, "latest": hydrated[0] if hydrated else None}


def status_payload() -> dict[str, Any]:
  materialize_latest_record()
  job = load_job()
  deliver = str(job.get("deliver") or "")
  origin = job.get("origin") or {}
  feishu_connected = deliver.startswith("feishu:") or (deliver == "origin" and origin.get("platform") == "feishu")
  return {
    "server": "online",
    "hermes": "ready" if job.get("enabled") else "unknown",
    "feishu": "connected" if feishu_connected else "missing",
    "schedule": schedule_text(job),
    "lastRun": format_time(job.get("last_run_at")),
    "nextRun": format_time(job.get("next_run_at")),
    "jobName": job.get("name"),
    "jobId": job.get("id"),
    "lastStatus": job.get("last_status"),
    "state": job.get("state"),
  }


def trigger_push() -> dict[str, Any]:
  sys.path.insert(0, str(HERMES_AGENT))
  from cron.jobs import trigger_job

  trigger_job(JOB_ID)
  payload = status_payload()
  payload.update({
    "ok": True,
    "message": "\u5df2\u4ea4\u7ed9 Hermes\uff0c\u5b8c\u6210\u540e\u4f1a\u540c\u6b65\u5230 neo\u3002",
  })
  return payload


def sync_loop() -> None:
  while True:
    try:
      materialize_latest_record()
    except Exception as exc:
      print(f"neo sync failed: {exc}", flush=True)
    time.sleep(SYNC_SECONDS)


class NeoHandler(BaseHTTPRequestHandler):
  def log_message(self, fmt: str, *args: Any) -> None:
    print(f"{self.address_string()} - {fmt % args}", flush=True)

  def _headers(self, status: int) -> None:
    self.send_response(status)
    self.send_header("content-type", "application/json; charset=utf-8")
    self.send_header("access-control-allow-origin", "*")
    self.send_header("access-control-allow-methods", "GET, POST, OPTIONS")
    self.send_header("access-control-allow-headers", "authorization, content-type, x-neo-token")
    self.end_headers()

  def send_json(self, status: int, payload: dict[str, Any]) -> None:
    self._headers(status)
    self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

  def authorized(self) -> bool:
    if not TOKEN:
      return False
    bearer = self.headers.get("authorization", "")
    token = self.headers.get("x-neo-token", "")
    return bearer == f"Bearer {TOKEN}" or token == TOKEN

  def do_OPTIONS(self) -> None:
    self._headers(204)

  def do_GET(self) -> None:
    self.handle_request()

  def do_POST(self) -> None:
    self.handle_request()

  def handle_request(self) -> None:
    try:
      if not self.authorized():
        return self.send_json(401, {"ok": False, "message": "Unauthorized"})

      if self.path == "/api/push/status" and self.command == "GET":
        return self.send_json(200, status_payload())

      if self.path == "/api/push/records" and self.command == "GET":
        return self.send_json(200, records_payload())

      if self.path == "/api/push/run" and self.command == "POST":
        return self.send_json(200, trigger_push())

      if self.path == "/api/push/test" and self.command == "POST":
        payload = status_payload()
        payload.update({"ok": True, "message": "\u670d\u52a1\u5668\u3001Hermes \u4e0e neo \u5f52\u6863\u5df2\u8fde\u901a\u3002"})
        return self.send_json(200, payload)

      return self.send_json(404, {"ok": False, "message": "Not found"})
    except Exception as exc:
      return self.send_json(500, {"ok": False, "message": str(exc)})


def main() -> None:
  if not TOKEN:
    raise SystemExit("NEO_API_TOKEN is required")
  ensure_data_dir()
  threading.Thread(target=sync_loop, daemon=True).start()
  server = ThreadingHTTPServer((HOST, PORT), NeoHandler)
  print(f"neo-api listening on http://{HOST}:{PORT}", flush=True)
  server.serve_forever()


if __name__ == "__main__":
  main()
