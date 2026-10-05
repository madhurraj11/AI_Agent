# LakeLoom — Databricks data prep

This project is a Databricks Apps application with a local development mode. In Databricks Apps, the Flask backend reads identity headers forwarded by the Apps proxy and reports the current user's name to the UI. It never sends the forwarded access token to the browser.

The **Run preview** action uses Databricks Connect 15.4 with serverless compute. In Databricks Apps, it runs as the app's service principal; all app users share that identity, so grant it only the serverless-compute and source-table or storage permissions the app needs. Locally, it uses the Databricks Connect profile configured for the user running Flask. The UI remains in guest mode and never receives credentials. Preview returns at most 100 rows, skips output writes, and does not run Delta table management or SCD merge steps.

## Run locally

Install `requirements.txt`, configure a Databricks Connect profile for serverless compute, then run `python app.py` and open `http://localhost:8000`:

```bash
databricks auth login --configure-serverless --host https://<your-workspace-host>
python app.py
```

Complete the OAuth sign-in in the browser and use the `DEFAULT` profile, or set `DATABRICKS_CONFIG_PROFILE` to your profile name before starting LakeLoom. The preview uses your Databricks user permissions. Without a configured profile, the Run preview button stays disabled and explains how to connect.

## Build for Windows

On a Windows 10 or 11 machine, install Python 3.11 and run `build_windows.bat` from this folder. The script creates `dist\LakeLoom-Windows.zip`; extract it and run `LakeLoom.exe`. The app opens in your browser on localhost. Keep the console window open while using it, and press Ctrl+C there to stop the app. The package includes Python and the app dependencies, so Python is not needed on the target machine.

To enable Databricks preview in the packaged app, configure Databricks Connect authentication on that Windows machine first, using the Databricks CLI and the profile you intend to use. Notebook generation and export work without a Databricks connection.

You can also run the **Build Windows app** workflow from the repository's GitHub Actions tab. It uploads the same ZIP as a downloadable workflow artifact.

## Deploy to Databricks Apps

Deploy this project directory as a Databricks App. The included `app.yaml` starts the Flask app with Gunicorn. Grant `CAN USE` to the users or groups who should open it. Databricks Apps will require workspace authentication before a user can access the app. Grant the app service principal permission to use serverless compute and read only the Unity Catalog tables, volumes, or external locations needed by the preview.

Signing out is controlled by the Databricks workspace session. Use the workspace profile menu and choose **Sign out**; an app cannot revoke the user's workspace SSO session.
