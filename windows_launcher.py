"""Launch LakeLoom locally and open its browser UI on Windows."""

import os
import threading
import webbrowser

from werkzeug.serving import make_server

from app import app


def main():
    try:
        preferred_port = int(os.environ.get("LAKELOOM_PORT", "8000"))
    except ValueError:
        preferred_port = 8000

    try:
        server = make_server("127.0.0.1", preferred_port, app, threaded=True)
    except OSError:
        # Keep the app usable if another local service already owns port 8000.
        server = make_server("127.0.0.1", 0, app, threaded=True)

    url = f"http://127.0.0.1:{server.server_port}"
    print(f"LakeLoom is running at {url}")
    print("Keep this window open while using LakeLoom. Press Ctrl+C to stop it.")
    threading.Timer(0.8, webbrowser.open, args=(url,)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping LakeLoom...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
