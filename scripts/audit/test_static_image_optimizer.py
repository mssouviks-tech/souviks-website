#!/usr/bin/env python3
"""Regression tests for shared static-image and LCP stylesheet helpers."""

import unittest

from optimize_static_images import dedupe_blocking_google_font_links


FONT_URL = (
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700"
    "&family=Poppins:wght@400;500;600;700;800&display=swap"
)


class DuplicateGoogleFontStylesheetTests(unittest.TestCase):
    def test_removes_blocking_duplicate_but_keeps_async_stylesheet(self) -> None:
        html = (
            f'<link href="{FONT_URL}" rel="stylesheet" media="print" '
            'onload="this.media=\'all\'">'
            f'<link href="{FONT_URL}" rel="stylesheet">'
        )

        updated, removed = dedupe_blocking_google_font_links(html)

        self.assertEqual(removed, 1)
        self.assertEqual(updated.count(FONT_URL), 1)
        self.assertIn('media="print"', updated)
        self.assertIn("onload=", updated)

    def test_keeps_blocking_link_when_no_async_equivalent_exists(self) -> None:
        html = f'<link href="{FONT_URL}" rel="stylesheet">'

        updated, removed = dedupe_blocking_google_font_links(html)

        self.assertEqual(removed, 0)
        self.assertEqual(updated, html)

    def test_does_not_remove_a_distinct_google_font_stylesheet(self) -> None:
        other = "https://fonts.googleapis.com/css2?family=Roboto&display=swap"
        html = (
            f'<link href="{FONT_URL}" rel="stylesheet" media="print" '
            'onload="this.media=\'all\'">'
            f'<link href="{FONT_URL}" rel="stylesheet">'
            f'<link href="{other}" rel="stylesheet">'
        )

        updated, removed = dedupe_blocking_google_font_links(html)

        self.assertEqual(removed, 1)
        self.assertIn(other, updated)
        self.assertEqual(updated.count(FONT_URL), 1)


if __name__ == "__main__":
    unittest.main()
