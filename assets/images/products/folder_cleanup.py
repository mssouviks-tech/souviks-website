import os
import shutil
from pathlib import Path

# =====================================================
# CONFIGURATION
# =====================================================

ROOT_FOLDER = r"C:\users\souvi\downloads\souviks images"

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".gif",
    ".tif",
    ".tiff",
    ".avif"
}

# =====================================================

folders_scanned = 0
folders_modified = 0
files_moved = 0
files_renamed = 0
folders_deleted = 0


def is_image(file):
    return file.suffix.lower() in IMAGE_EXTENSIONS


def flatten_folder(folder):
    global files_moved, folders_deleted

    changed = False

    # Walk bottom-up
    for current, dirs, files in os.walk(folder, topdown=False):

        current = Path(current)

        if current == folder:
            continue

        # Move every file to root folder
        for file in current.iterdir():

            if not file.is_file():
                continue

            destination = folder / file.name

            # Prevent collisions
            if destination.exists():
                stem = file.stem
                ext = file.suffix
                counter = 1

                while True:
                    new_name = f"{stem}_{counter}{ext}"
                    destination = folder / new_name

                    if not destination.exists():
                        break

                    counter += 1

            shutil.move(str(file), str(destination))
            files_moved += 1
            changed = True

        # Remove empty directory
        try:
            current.rmdir()
            folders_deleted += 1
        except OSError:
            pass

    return changed


def rename_images(folder):
    global files_renamed

    images = [
        f for f in folder.iterdir()
        if f.is_file() and is_image(f)
    ]

    images.sort(key=lambda x: x.name.lower())

    if not images:
        return False

    changed = False

    temp_files = []

    # Stage 1
    for i, img in enumerate(images):
        temp = folder / f"__TEMP_RENAME__{i}{img.suffix}"
        img.rename(temp)
        temp_files.append(temp)

    # Stage 2
    for index, temp in enumerate(temp_files, start=1):
        new_name = folder / f"{index}{temp.suffix.lower()}"
        temp.rename(new_name)
        files_renamed += 1
        changed = True

    return changed


def process_folder(folder):
    global folders_modified

    modified = False

    if flatten_folder(folder):
        modified = True

    if rename_images(folder):
        modified = True

    if modified:
        folders_modified += 1


def main():
    global folders_scanned

    root = Path(ROOT_FOLDER)

    if not root.exists():
        print("Folder does not exist.")
        return

    folders = [f for f in root.iterdir() if f.is_dir()]

    total = len(folders)

    print("=" * 60)
    print("Folder Cleanup Utility")
    print("=" * 60)

    for i, folder in enumerate(folders, start=1):
        folders_scanned += 1

        print(f"[{i}/{total}] {folder.name}")

        process_folder(folder)

    print()
    print("=" * 60)
    print("Completed")
    print("=" * 60)
    print(f"Folders scanned : {folders_scanned}")
    print(f"Folders modified: {folders_modified}")
    print(f"Files moved     : {files_moved}")
    print(f"Folders deleted : {folders_deleted}")
    print(f"Images renamed  : {files_renamed}")


if __name__ == "__main__":
    main()