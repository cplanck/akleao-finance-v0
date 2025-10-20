"""
Wrapper to run comment scraper with HTTP health check server for Cloud Run.
"""
import os
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import main

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Health check endpoint."""
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'OK')

    def log_message(self, format, *args):
        """Suppress HTTP request logs."""
        pass

def run_health_server():
    """Run HTTP server for health checks."""
    port = int(os.getenv('PORT', 8080))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    print(f"🏥 Health check server running on port {port}")
    server.serve_forever()

if __name__ == "__main__":
    # Start health check server in background thread
    health_thread = threading.Thread(target=run_health_server, daemon=True)
    health_thread.start()

    # Run the comment scraper in main thread
    main.main()
