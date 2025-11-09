@echo off
echo Starting ngrok tunnel to localhost:8000...
echo.
echo IMPORTANT: Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
echo and update backend/.env with: APP_URL=<your-ngrok-url>
echo.
echo Also update Shopify app redirect URL to: <your-ngrok-url>/auth/callback
echo.
ngrok http 8000


