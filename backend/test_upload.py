"""Legacy manual upload probe. Importing it must never read files or upload."""
import requests


def main():
    url = "https://api-tinahstore.up.railway.app/api/v1/products/test-upload/"
    file_path = r"C:\Users\PC\Downloads\ss1.jpeg"
    with open(file_path, 'rb') as image:
        response = requests.post(url, files={'image': image}, timeout=30)
        print(response.status_code)
        print(response.json())


if __name__ == '__main__':
    main()
