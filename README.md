# Django GeoDjango Web Mapping Project

This is a starter Django project for the Advanced Web Mapping module (College Assignment).

## Features
- Django 4.x with GeoDjango support
- Spatial models for locations and areas
- REST API and CORS support
- PostgreSQL/PostGIS database configuration

## Setup
1. Clone the repository and navigate to the project folder.
2. Create and activate a Python virtual environment (e.g., `ca_env`).
3. Install dependencies (see requirements or use pip).
4. Configure your database settings in `ca_project/settings.py`.
5. Run migrations:
   ```
   python manage.py makemigrations
   python manage.py migrate
   ```
6. Create a superuser:
   ```
   python manage.py createsuperuser
   ```
7. Start the development server:
   ```
   python manage.py runserver
   ```

## Notes
- This project is a template for coursework and experimentation with web mapping and spatial data.
- The main app is `testapp`, which includes example spatial models.
- More features and documentation will be added as the project develops.

---
*Created for Advanced Web Mapping CA, 2025.*
