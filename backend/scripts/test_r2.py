from io import BytesIO

from src.api.dependencies import get_object_storage


def main():
    storage = get_object_storage()
    key = "smoke-tests/r2-test.txt"

    source = BytesIO(b"StudySync R2 connectivity test")
    storage.upload(key=key, fileobj=source, content_type="text/plain")
    print("Upload: OK")

    destination = BytesIO()
    storage.download(key=key, fileobj=destination)

    if destination.getvalue() != b"StudySync R2 connectivity test":
        raise RuntimeError("Downloaded content did not match uploaded content.")

    print("Download: OK")

    storage.delete(key=key)
    print("Delete: OK")


if __name__ == "__main__":
    main()