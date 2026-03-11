"""
Tests for week calculation utilities.

CRITICAL: Must cover all 49 combinations (7 weekdays × 7 start_day values).
The +7 edge case: startDay=1 (Monday), today=Sunday (0).
Python's % always returns non-negative; JavaScript's does not — tests here verify
the Python side; frontend tests verify the JS side.
"""
from datetime import date
import pytest
from app.utils.week import get_week_start, get_week_end


# Test matrix: all 49 combinations of (date_weekday, start_day)
# date_weekday: 0=Mon, 1=Tue, ..., 6=Sun (Python convention)
# start_day: 0=Sun, 1=Mon, ..., 6=Sat (our convention)


@pytest.mark.parametrize("test_date,start_day,expected_start", [
    # start_day=0 (Sunday) - week runs Sun-Sat
    (date(2026, 3, 1), 0, date(2026, 3, 1)),   # Sunday → same day
    (date(2026, 3, 2), 0, date(2026, 3, 1)),   # Monday → prev Sunday
    (date(2026, 3, 3), 0, date(2026, 3, 1)),   # Tuesday → prev Sunday
    (date(2026, 3, 4), 0, date(2026, 3, 1)),   # Wednesday → prev Sunday
    (date(2026, 3, 5), 0, date(2026, 3, 1)),   # Thursday → prev Sunday
    (date(2026, 3, 6), 0, date(2026, 3, 1)),   # Friday → prev Sunday
    (date(2026, 3, 7), 0, date(2026, 3, 1)),   # Saturday → prev Sunday

    # start_day=1 (Monday) - week runs Mon-Sun
    (date(2026, 3, 1), 1, date(2026, 2, 23)),  # Sunday → prev Monday (the +7 edge case!)
    (date(2026, 3, 2), 1, date(2026, 3, 2)),   # Monday → same day
    (date(2026, 3, 3), 1, date(2026, 3, 2)),   # Tuesday → prev Monday
    (date(2026, 3, 4), 1, date(2026, 3, 2)),   # Wednesday → prev Monday
    (date(2026, 3, 5), 1, date(2026, 3, 2)),   # Thursday → prev Monday
    (date(2026, 3, 6), 1, date(2026, 3, 2)),   # Friday → prev Monday
    (date(2026, 3, 7), 1, date(2026, 3, 2)),   # Saturday → prev Monday

    # start_day=2 (Tuesday)
    (date(2026, 3, 1), 2, date(2026, 2, 24)),  # Sunday → prev Tuesday
    (date(2026, 3, 2), 2, date(2026, 2, 24)),  # Monday → prev Tuesday
    (date(2026, 3, 3), 2, date(2026, 3, 3)),   # Tuesday → same day
    (date(2026, 3, 4), 2, date(2026, 3, 3)),   # Wednesday → prev Tuesday
    (date(2026, 3, 5), 2, date(2026, 3, 3)),   # Thursday → prev Tuesday
    (date(2026, 3, 6), 2, date(2026, 3, 3)),   # Friday → prev Tuesday
    (date(2026, 3, 7), 2, date(2026, 3, 3)),   # Saturday → prev Tuesday

    # start_day=3 (Wednesday)
    (date(2026, 3, 1), 3, date(2026, 2, 25)),  # Sunday → prev Wednesday
    (date(2026, 3, 2), 3, date(2026, 2, 25)),  # Monday → prev Wednesday
    (date(2026, 3, 3), 3, date(2026, 2, 25)),  # Tuesday → prev Wednesday
    (date(2026, 3, 4), 3, date(2026, 3, 4)),   # Wednesday → same day
    (date(2026, 3, 5), 3, date(2026, 3, 4)),   # Thursday → prev Wednesday
    (date(2026, 3, 6), 3, date(2026, 3, 4)),   # Friday → prev Wednesday
    (date(2026, 3, 7), 3, date(2026, 3, 4)),   # Saturday → prev Wednesday

    # start_day=4 (Thursday)
    (date(2026, 3, 1), 4, date(2026, 2, 26)),  # Sunday → prev Thursday
    (date(2026, 3, 2), 4, date(2026, 2, 26)),  # Monday → prev Thursday
    (date(2026, 3, 3), 4, date(2026, 2, 26)),  # Tuesday → prev Thursday
    (date(2026, 3, 4), 4, date(2026, 2, 26)),  # Wednesday → prev Thursday
    (date(2026, 3, 5), 4, date(2026, 3, 5)),   # Thursday → same day
    (date(2026, 3, 6), 4, date(2026, 3, 5)),   # Friday → prev Thursday
    (date(2026, 3, 7), 4, date(2026, 3, 5)),   # Saturday → prev Thursday

    # start_day=5 (Friday)
    (date(2026, 3, 1), 5, date(2026, 2, 27)),  # Sunday → prev Friday
    (date(2026, 3, 2), 5, date(2026, 2, 27)),  # Monday → prev Friday
    (date(2026, 3, 3), 5, date(2026, 2, 27)),  # Tuesday → prev Friday
    (date(2026, 3, 4), 5, date(2026, 2, 27)),  # Wednesday → prev Friday
    (date(2026, 3, 5), 5, date(2026, 2, 27)),  # Thursday → prev Friday
    (date(2026, 3, 6), 5, date(2026, 3, 6)),   # Friday → same day
    (date(2026, 3, 7), 5, date(2026, 3, 6)),   # Saturday → prev Friday

    # start_day=6 (Saturday)
    (date(2026, 3, 1), 6, date(2026, 2, 28)),  # Sunday → prev Saturday
    (date(2026, 3, 2), 6, date(2026, 2, 28)),  # Monday → prev Saturday
    (date(2026, 3, 3), 6, date(2026, 2, 28)),  # Tuesday → prev Saturday
    (date(2026, 3, 4), 6, date(2026, 2, 28)),  # Wednesday → prev Saturday
    (date(2026, 3, 5), 6, date(2026, 2, 28)),  # Thursday → prev Saturday
    (date(2026, 3, 6), 6, date(2026, 2, 28)),  # Friday → prev Saturday
    (date(2026, 3, 7), 6, date(2026, 3, 7)),   # Saturday → same day
])
def test_get_week_start(test_date, start_day, expected_start):
    result = get_week_start(test_date, start_day)
    assert result == expected_start, (
        f"get_week_start({test_date}, start_day={start_day}): "
        f"expected {expected_start}, got {result}"
    )


def test_get_week_end_is_start_plus_6():
    """Week end must always be exactly 6 days after week start."""
    for start_day in range(7):
        for d in [date(2026, 3, i) for i in range(1, 8)]:
            start = get_week_start(d, start_day)
            end = get_week_end(d, start_day)
            delta = (end - start).days
            assert delta == 6, (
                f"get_week_end({d}, {start_day}): end-start = {delta}, expected 6"
            )


def test_week_start_day_1_sunday_edge_case():
    """
    The critical +7 edge case:
    startDay=1 (Monday), today=Sunday (day 0 in JS, day 6 in Python weekday)
    Week containing Sunday 2026-03-01 with Monday start = week starting Mon 2026-02-23
    """
    sunday = date(2026, 3, 1)  # Python weekday() = 6 (Sunday)
    result = get_week_start(sunday, start_day=1)
    assert result == date(2026, 2, 23), f"Got {result}, expected 2026-02-23"
