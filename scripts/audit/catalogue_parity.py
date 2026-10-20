#!/usr/bin/env python3
"""Blocking cross-entity parity audit for the static Souviks catalogue.

The catalogue-index is the active product master. categories.json and
vehicles.json are authoritative entity/mapping files; this audit never
rewrites or guesses catalogue data.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "assets" / "data"


def load(name):
    path = DATA / name
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"[A10 parity] Cannot load {path.relative_to(ROOT)}: {exc}")
    if not isinstance(value, list):
        raise SystemExit(f"[A10 parity] {path.relative_to(ROOT)} must be a JSON array")
    return value


def text(value):
    return str(value or "").strip()


def ids(value):
    if not isinstance(value, list):
        return []
    return [text(item) for item in value if text(item)]


def active(rows):
    return [row for row in rows if row.get("active") is not False]


def main():
    catalogue = active(load("catalogue-index.json"))
    categories = active(load("categories.json"))
    vehicles = active(load("vehicles.json"))
    brands = active(load("brands.json"))
    errors = []

    def index(rows, key, label):
        result = {}
        for row in rows:
            value = text(row.get(key))
            if not value:
                errors.append(f"{label}: active record missing {key}: {row.get('id')!r}")
                continue
            if value in result:
                errors.append(f"{label}: duplicate {key} {value!r}")
            result[value] = row
        return result

    products_by_id = index(catalogue, "id", "catalogue-index")
    categories_by_id = index(categories, "id", "categories.json")
    brands_by_id = index(brands, "id", "brands.json")
    vehicles_by_id = index(vehicles, "id", "vehicles.json")

    category_ids_by_name = {
        text(row.get("name")).casefold(): key for key, row in categories_by_id.items()
        if text(row.get("name"))
    }
    brand_ids_by_name = {
        text(row.get("name")).casefold(): key for key, row in brands_by_id.items()
        if text(row.get("name"))
    }
    vehicle_ids_by_name = {}
    for key, row in vehicles_by_id.items():
        for name in (row.get("name"), row.get("model")):
            if text(name):
                vehicle_ids_by_name[text(name).casefold()] = key

    # Catalog-integrity guard for a known false classification: Valvoline 504635
    # is 15W-40 engine oil, not a suspension cross joint. Keep this explicit
    # invariant so accidental sheet/import changes fail the parity audit.
    valvoline_oil = next(
        (
            product for product in products_by_id.values()
            if text(product.get("brand_id")) == "valvoline"
            and text(product.get("part_number")) == "504635"
        ),
        None,
    )
    if valvoline_oil is None:
        errors.append("Valvoline 504635 classification invariant: product record not found")
    else:
        expected_taxonomy = ("lubricants", "engine-oil")
        actual_taxonomy = (
            text(valvoline_oil.get("category_id")),
            text(valvoline_oil.get("subcategory_id")),
        )
        if actual_taxonomy != expected_taxonomy:
            errors.append(
                "Valvoline 504635 classification invariant: expected "
                f"{expected_taxonomy!r}, got {actual_taxonomy!r}"
            )

    # Validate each active product's references against the authoritative masters.
    expected_category_products = {key: set() for key in categories_by_id}
    expected_vehicle_products = {key: set() for key in vehicles_by_id}
    for pid, product in products_by_id.items():
        category_id = text(product.get("category_id"))
        category = categories_by_id.get(category_id)
        if not category:
            errors.append(f"{pid}: category_id is missing or inactive: {category_id!r}")
        else:
            expected_category_products[category_id].add(pid)
            subcategory_id = text(product.get("subcategory_id"))
            subcategories = category.get("subcategories")
            known_subcategories = {
                text(item.get("id")) for item in subcategories
                if isinstance(item, dict) and text(item.get("id"))
            } if isinstance(subcategories, list) else set()
            if not subcategory_id:
                errors.append(f"{pid}: subcategory_id is blank")
            elif subcategory_id not in known_subcategories:
                errors.append(
                    f"{pid}: subcategory_id {subcategory_id!r} is not defined under "
                    f"category {category_id!r}"
                )

        brand_id = text(product.get("brand_id"))
        if not brand_id or brand_id not in brands_by_id:
            errors.append(f"{pid}: brand_id is missing or inactive: {brand_id!r}")

        assigned_vehicles = ids(product.get("vehicles"))
        for vehicle_name in assigned_vehicles:
            vehicle_id = vehicle_name if vehicle_name in vehicles_by_id else vehicle_ids_by_name.get(vehicle_name.casefold())
            if not vehicle_id:
                errors.append(f"{pid}: vehicle mapping is not in vehicles.json: {vehicle_name!r}")
            else:
                expected_vehicle_products[vehicle_id].add(pid)

    # The entity files publish denormalized product lists and counts. Require
    # those lists/counts to match the product master exactly, not just roughly.
    for category_id, category in categories_by_id.items():
        listed = ids(category.get("products"))
        listed_set = set(listed)
        expected = expected_category_products[category_id]
        unknown = sorted(listed_set - set(products_by_id))
        missing = sorted(expected - listed_set)
        misplaced = sorted(pid for pid in listed_set & set(products_by_id)
                           if text(products_by_id[pid].get("category_id")) != category_id)
        if unknown:
            errors.append(f"category {category_id}: products contains unknown/inactive IDs: {', '.join(unknown[:10])}")
        if missing:
            errors.append(f"category {category_id}: products omits {len(missing)} assigned IDs: {', '.join(missing[:10])}")
        if misplaced:
            errors.append(f"category {category_id}: products contains IDs assigned to another category: {', '.join(misplaced[:10])}")
        if len(listed) != len(listed_set):
            errors.append(f"category {category_id}: products contains duplicate IDs")
        if category.get("product_count") != len(expected):
            errors.append(
                f"category {category_id}: product_count {category.get('product_count')!r} "
                f"!= active assigned products {len(expected)}"
            )
        featured = ids(category.get("featured_products"))
        invalid_featured = sorted(set(featured) - expected)
        if invalid_featured:
            errors.append(f"category {category_id}: featured_products contains IDs outside category: {', '.join(invalid_featured[:10])}")

    for vehicle_id, vehicle in vehicles_by_id.items():
        listed = ids(vehicle.get("products"))
        listed_set = set(listed)
        expected = expected_vehicle_products[vehicle_id]
        unknown = sorted(listed_set - set(products_by_id))
        missing = sorted(expected - listed_set)
        misplaced = sorted(pid for pid in listed_set & set(products_by_id)
                           if not any(
                               (name.casefold() in vehicle_ids_by_name and vehicle_ids_by_name[name.casefold()] == vehicle_id)
                               or name == vehicle_id
                               for name in ids(products_by_id[pid].get("vehicles"))
                           ))
        if unknown:
            errors.append(f"vehicle {vehicle_id}: products contains unknown/inactive IDs: {', '.join(unknown[:10])}")
        if missing:
            errors.append(f"vehicle {vehicle_id}: products omits {len(missing)} assigned IDs: {', '.join(missing[:10])}")
        if misplaced:
            errors.append(f"vehicle {vehicle_id}: products contains IDs not assigned to it: {', '.join(misplaced[:10])}")
        if len(listed) != len(listed_set):
            errors.append(f"vehicle {vehicle_id}: products contains duplicate IDs")
        if vehicle.get("product_count") != len(expected):
            errors.append(
                f"vehicle {vehicle_id}: product_count {vehicle.get('product_count')!r} "
                f"!= active assigned products {len(expected)}"
            )
        featured = ids(vehicle.get("featured_products"))
        invalid_featured = sorted(set(featured) - expected)
        if invalid_featured:
            errors.append(f"vehicle {vehicle_id}: featured_products contains IDs outside vehicle: {', '.join(invalid_featured[:10])}")

    if errors:
        print(f"[A10 parity] FAILED: {len(errors)} discrepancies across {len(catalogue)} active products, {len(categories)} categories, {len(vehicles)} vehicles.")
        for error in errors[:250]:
            print(f" - {error}")
        if len(errors) > 250:
            print(f" - ... {len(errors) - 250} more discrepancies")
        raise SystemExit(1)

    print(
        f"[A10 parity] OK: {len(catalogue)} active products map consistently to "
        f"{len(categories)} categories, {len(vehicles)} vehicles and {len(brands)} brands."
    )


if __name__ == "__main__":
    main()
