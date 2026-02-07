import urllib.request
import json

try:
    with urllib.request.urlopen('http://localhost:3000/models') as response:
        print(f"Status Code: {response.getcode()}")
        data = response.read()
        print(f"Response Body: {data.decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
