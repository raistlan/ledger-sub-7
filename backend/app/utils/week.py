from datetime import date, timedelta


def get_week_start(d: date, start_day: int = 0) -> date:
    """Calculate start of the week containing date d.

    start_day: 0=Sunday, 1=Monday, ..., 6=Saturday
    Python's weekday(): Mon=0, Sun=6 → convert to Sun=0, Mon=1 with (weekday+1)%7
    Python's % operator always returns non-negative values (unlike JavaScript).
    """
    current_day_index = (d.weekday() + 1) % 7  # 0=Sunday
    days_since_start = (current_day_index - start_day) % 7
    return d - timedelta(days=days_since_start)


def get_week_end(d: date, start_day: int = 0) -> date:
    return get_week_start(d, start_day) + timedelta(days=6)
