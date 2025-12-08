#!/bin/bash
set -e

echo "Waiting for database..."
while ! pg_isready -h postgres -p 5432; do
  sleep 2
done
echo "Database is ready!"

echo "Creating superuser if not exists..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()

username = 'ronak'
email = 'ronakfeedback@gmail.com'
password = 'awm123'

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print('Superuser created: ronak / awm123')
else:
    print('Superuser already exists: ronak')
"
