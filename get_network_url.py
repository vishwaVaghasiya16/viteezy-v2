#!/usr/bin/env python3
"""
Get the network URL for the Viteezy Bot server.
This script finds your local IP address and constructs the API URL.
"""
import socket
import sys

def get_local_ip():
    """Get the local IP address of this machine."""
    try:
        # Connect to a remote address (doesn't actually connect)
        # This gets the IP address of the interface used to reach that address
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        # Fallback: try to get IP from hostname
        try:
            hostname = socket.gethostname()
            ip = socket.gethostbyname(hostname)
            if ip.startswith("127."):
                return None
            return ip
        except Exception:
            return None

def main():
    """Print the network URL for the server."""
    from app.config.settings import settings
    
    ip = get_local_ip()
    
    if not ip:
        print("❌ Could not determine local IP address")
        print("💡 You can manually find it using: ifconfig | grep 'inet ' | grep -v 127.0.0.1")
        sys.exit(1)
    
    url = f"http://{ip}:{settings.port}/api/v1"
    
    print("=" * 60)
    print("🌐 Viteezy Bot Network URL")
    print("=" * 60)
    print(f"Local IP Address: {ip}")
    print(f"Port: {settings.port}")
    print(f"\n📡 Network URL: {url}")
    print(f"\n💡 Use this URL to access the API from other devices")
    print(f"   on the same network (e.g., mobile phones, tablets)")
    print("=" * 60)

if __name__ == "__main__":
    main()

