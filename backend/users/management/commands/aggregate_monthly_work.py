from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import TimeEntry, MonthlyWorkSummary
from datetime import date, timedelta

User = get_user_model()

class Command(BaseCommand):
    help = 'Aggregate monthly work hours, store summary and delete time entries for that month'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, help='Year to aggregate (defaults to previous month)')
        parser.add_argument('--month', type=int, help='Month to aggregate (1-12)')
        parser.add_argument('--dry-run', action='store_true', help='Do not delete entries')

    def handle(self, *args, **options):
        today = date.today()
        year = options.get('year')
        month = options.get('month')
        dry_run = options.get('dry_run')
        if not year or not month:
            # previous month
            first_of_this_month = date(today.year, today.month, 1)
            prev_month_end = first_of_this_month - timedelta(days=1)
            year = prev_month_end.year
            month = prev_month_end.month

        start = date(year, month, 1)
        # calculate month_end
        next_month = start.replace(day=28) + timedelta(days=4)
        end = next_month - timedelta(days=next_month.day)

        self.stdout.write(f'Aggregating {year}-{month:02d} ({start}..{end})')

        users = User.objects.filter(is_active=True)
        for user in users:
            entries = TimeEntry.objects.filter(user=user, date__range=(start, end))
            total_seconds = 0
            for e in entries:
                total_seconds += e.duration.total_seconds()
            actual_hours = round(total_seconds / 3600, 2)

            employee = getattr(user, 'employee', None)
            weekly_target = float(employee.weekly_work_hours or 40.0) if employee else 40.0
            work_days = list(employee.work_days or ['mon','tue','wed','thu','fri']) if employee else ['mon','tue','wed','thu','fri']
            mapping = {'mon':0,'tue':1,'wed':2,'thu':3,'fri':4,'sat':5,'sun':6}

            # count workdays in whole month
            cur = start
            workdays_in_month = 0
            indices = [mapping[d] for d in work_days if d in mapping]
            while cur <= end:
                if cur.weekday() in indices:
                    workdays_in_month += 1
                cur += timedelta(days=1)

            daily_target = weekly_target / (len(indices) or 5)
            expected_hours = round(daily_target * workdays_in_month, 2)
            difference = round(actual_hours - expected_hours, 2)

            note = ''
            if difference > 0:
                note = f'+{difference}h Überschuss'
            elif difference < 0:
                note = f'{difference}h Fehlzeit'
            else:
                note = 'Ausgeglichen'

            summary, created = MonthlyWorkSummary.objects.update_or_create(
                user=user, year=year, month=month,
                defaults={
                    'actual_hours': actual_hours,
                    'expected_hours': expected_hours,
                    'difference': difference,
                    'note': note
                }
            )
            self.stdout.write(f'User {user.username}: actual={actual_hours} expected={expected_hours} diff={difference}')

            if not dry_run:
                count, _ = entries.delete()
                self.stdout.write(f'  deleted {count} time entries')

        self.stdout.write('Done')
