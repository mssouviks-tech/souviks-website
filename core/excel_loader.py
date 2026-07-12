import pandas as pd


def load_part_numbers(filepath):
    df = pd.read_excel(filepath)

    if df.empty:
        return []

    first_column = df.iloc[:, 0]

    return (
        first_column
        .dropna()
        .astype(str)
        .str.strip()
        .tolist()
    )