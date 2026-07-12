import customtkinter as ctk
from tkinter import filedialog

from core.excel_loader import load_part_numbers


class MainWindow:

    def __init__(self):

        ctk.set_appearance_mode("dark")

        self.root = ctk.CTk()

        self.root.title("Part Image Collector")

        self.root.geometry("1000x700")

        self.build_ui()

    def build_ui(self):

        title = ctk.CTkLabel(
            self.root,
            text="Part Image Collector",
            font=("Arial", 28, "bold")
        )

        title.pack(pady=20)

        self.import_button = ctk.CTkButton(
            self.root,
            text="Import Excel",
            command=self.import_excel
        )

        self.import_button.pack(pady=10)

        self.status = ctk.CTkLabel(
            self.root,
            text="No file loaded"
        )

        self.status.pack()

        self.queue_box = ctk.CTkTextbox(
            self.root,
            width=900,
            height=500
        )

        self.queue_box.pack(pady=20)

    def import_excel(self):

        file_path = filedialog.askopenfilename(
            filetypes=[
                ("Excel Files", "*.xlsx *.xls")
            ]
        )

        if not file_path:
            return

        parts = load_part_numbers(file_path)

        self.queue_box.delete("1.0", "end")

        for part in parts:
            self.queue_box.insert("end", f"{part}\n")

        self.status.configure(
            text=f"{len(parts)} parts loaded"
        )

    def run(self):
        self.root.mainloop()