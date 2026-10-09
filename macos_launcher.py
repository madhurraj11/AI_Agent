"""Launch LakeLoom from Finder and open its local browser UI on macOS."""

import logging
import os
import subprocess
import threading
from pathlib import Path

from werkzeug.serving import make_server

from app import app


def _configure_logging():
    log_path = Path.home() / "Library" / "Logs" / "LakeLoom" / "launcher.log"
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(
            filename=log_path,
            level=logging.INFO,
            format="%(asctime)s %(levelname)s %(message)s",
        )
        return log_path
    except OSError:
        logging.basicConfig(level=logging.INFO)
        return None


def _show_start_error(log_path):
    log_message = f" See {log_path} for details." if log_path else ""
    message = f"LakeLoom could not start.{log_message}"
    script = f'display dialog "{message}" buttons {{"OK"}} with icon stop'
    try:
        subprocess.run(
            ["/usr/bin/osascript", "-e", script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    except OSError:
        logging.exception("Could not show the LakeLoom startup alert")


def _open_browser(url):
    try:
        subprocess.Popen(
            ["/usr/bin/open", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        logging.info("Opened LakeLoom in the default browser: %s", url)
    except OSError:
        logging.exception("Could not open the default browser for %s", url)


def main():
    log_path = _configure_logging()
    try:
        try:
            preferred_port = int(os.environ.get("LAKELOOM_PORT", "8000"))
        except ValueError:
            preferred_port = 8000

        try:
            server = make_server("127.0.0.1", preferred_port, app, threaded=True)
        except (OSError, SystemExit):
            logging.exception("Port %s is unavailable; selecting a free port", preferred_port)
            server = make_server("127.0.0.1", 0, app, threaded=True)

        url = f"http://127.0.0.1:{server.server_port}"
        logging.info("LakeLoom is running at %s", url)
        threading.Timer(1.0, _open_browser, args=(url,)).start()
        server.serve_forever()
    except Exception:
        logging.exception("LakeLoom failed during startup")
        _show_start_error(log_path)
    finally:
        if "server" in locals():
            server.server_close()


if __name__ == "__main__":
    main()
